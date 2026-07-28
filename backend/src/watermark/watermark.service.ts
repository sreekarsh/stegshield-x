import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { pbkdf2Sync } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { stat, unlink } from "fs/promises";
import { join } from "path";
import sharp from "sharp";
import * as opentype from "opentype.js";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditActions } from "../audit/audit.constants";
import { ConfigService } from "@nestjs/config";

const MAGIC_BYTES: { magic: number[]; mime: string; ext: string }[] = [
  { magic: [0x89, 0x50, 0x4e, 0x47], mime: "image/png", ext: ".png" },
  { magic: [0xff, 0xd8, 0xff], mime: "image/jpeg", ext: ".jpg" },
  { magic: [0x52, 0x49, 0x46, 0x46], mime: "image/webp", ext: ".webp" },
  { magic: [0x42, 0x4d], mime: "image/bmp", ext: ".bmp" },
  { magic: [0x49, 0x49, 0x2a, 0x00], mime: "image/tiff", ext: ".tiff" },
];

const ENC_IV_LENGTH = 12;
const ENC_TAG_LENGTH = 16;
const ALLOWED_MIMES = Object.values(MAGIC_BYTES).map(m => m.mime);
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export interface WatermarkResult {
  id: string;
  fileId: string;
  type: string;
  text: string;
  originalPath: string;
  watermarkedPath?: string;
  originalMime?: string;
  createdAt: Date;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class WatermarkService {
  private readonly uploadDir: string;
  private readonly tempDir: string;
  private fontCache: opentype.Font | null = null;
  private fontLoading = false;
  private fontPromise: Promise<opentype.Font> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {
    this.uploadDir = this.config.get("UPLOAD_DIR") || join(process.cwd(), "uploads", "watermarks");
    this.tempDir = join(this.uploadDir, "temp");
    this.ensureDirs();
  }

  private ensureDirs() {
    for (const dir of [this.uploadDir, this.tempDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private async safeUnlink(path: string, retries = 3, delay = 100): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        if (existsSync(path)) {
          await unlink(path);
        }
        return;
      } catch (err: any) {
        if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'ENOENT') {
          if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
        } else {
          throw err;
        }
      }
    }
  }

  private getSecretKey(): string {
    const key = this.config.get("WATERMARK_ENCRYPTION_KEY") || this.config.get("SECRET_KEY");
    if (!key) throw new InternalServerErrorException("Encryption key not configured");
    return key;
  }

  private detectMime(bytes: Buffer): { mime: string; ext: string } | null {
    for (const { magic, mime, ext } of MAGIC_BYTES) {
      if (bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b)) {
        return { mime, ext };
      }
    }
    return null;
  }

  private validateFile(file: Express.Multer.File, maxSize: number): { mime: string; ext: string } {
    if (file.size > maxSize) {
      throw new BadRequestException(`File too large. Maximum size: ${this.formatBytes(maxSize)}`);
    }
    const detected = this.detectMime(readFileSync(file.path));
    if (!detected) {
      throw new BadRequestException("Unsupported file type. File signature not recognized.");
    }
    if (!ALLOWED_MIMES.includes(detected.mime)) {
      throw new BadRequestException(`File type ${detected.mime} not allowed`);
    }
    return detected;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  private deriveKey(salt: string): Buffer {
    return pbkdf2Sync(this.getSecretKey(), salt, 100000, 32, "sha256");
  }

  private encrypt(raw: Buffer, salt: string): Buffer {
    const key = this.deriveKey(salt);
    const iv = randomBytes(ENC_IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: ENC_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private decrypt(data: Buffer, salt: string): Buffer {
    const key = this.deriveKey(salt);
    const iv = data.subarray(0, ENC_IV_LENGTH);
    const authTag = data.subarray(ENC_IV_LENGTH, ENC_IV_LENGTH + ENC_TAG_LENGTH);
    const ciphertext = data.subarray(ENC_IV_LENGTH + ENC_TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: ENC_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new Error("Decryption authentication failed");
    }
  }

  // LSB Steganography for invisible watermarks
  private embedLSB(imageBuffer: Buffer, payload: Buffer): Buffer {
    const pixels = new Uint8Array(imageBuffer);
    const headerSize = 32;
    const totalBits = headerSize + payload.length * 8;

    if (totalBits > pixels.length) {
      throw new BadRequestException("Payload is too large to fit in this image");
    }

    for (let b = 0; b < headerSize; b++) {
      const bit = (payload.length >> (headerSize - 1 - b)) & 1;
      pixels[b] = (pixels[b] & 0xFE) | bit;
    }

    for (let i = 0; i < payload.length; i++) {
      for (let b = 7; b >= 0; b--) {
        const pixelIdx = headerSize + i * 8 + (7 - b);
        pixels[pixelIdx] = (pixels[pixelIdx] & 0xFE) | ((payload[i] >> b) & 1);
      }
    }

    return Buffer.from(pixels);
  }

  private extractLSB(imageBuffer: Buffer): Buffer {
    const pixels = new Uint8Array(imageBuffer);
    const headerSize = 32;

    if (pixels.length <= headerSize) {
      throw new Error("Image too small to contain LSB watermark data");
    }

    let payloadLength = 0;
    for (let b = 0; b < headerSize; b++) {
      payloadLength = (payloadLength << 1) | (pixels[b] & 1);
    }

    if (payloadLength === 0 || payloadLength > 65536) {
      throw new Error("Invalid payload length in LSB data");
    }

    const totalBitsNeeded = headerSize + payloadLength * 8;
    if (totalBitsNeeded > pixels.length) {
      throw new Error("LSB payload length exceeds image capacity — corrupted data");
    }

    const payloadBytes = new Uint8Array(payloadLength);
    for (let i = 0; i < payloadLength; i++) {
      let byte = 0;
      for (let b = 7; b >= 0; b--) {
        const pixelIdx = headerSize + i * 8 + (7 - b);
        byte = (byte << 1) | (pixels[pixelIdx] & 1);
      }
      payloadBytes[i] = byte;
    }

    return Buffer.from(payloadBytes);
  }

  private preparePayload(text: string, salt: string): Buffer {
    const textBytes = Buffer.from(text, "utf8");
    const lengthBytes = Buffer.alloc(4);
    lengthBytes.writeUInt32BE(textBytes.length, 0);
    const combined = Buffer.concat([lengthBytes, textBytes]);
    return this.encrypt(combined, salt);
  }

  private parsePayload(payload: Buffer, salt: string): string {
    const decrypted = this.decrypt(payload, salt);
    const length = decrypted.readUInt32BE(0);
    const textBytes = decrypted.subarray(4, 4 + length);
    return textBytes.toString("utf8");
  }

  private async getFont(): Promise<opentype.Font> {
    if (this.fontCache) return this.fontCache;
    if (this.fontLoading) return this.fontPromise!;
    this.fontLoading = true;
    this.fontPromise = this.loadFont();
    return this.fontPromise;
  }

  private async loadFont(): Promise<opentype.Font> {
    const candidates = [
      "C:\\Windows\\Fonts\\arial.ttf",
      "C:\\Windows\\Fonts\\Arial.ttf",
      "C:\\Windows\\Fonts\\segoeui.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "/usr/share/fonts/TTF/DejaVuSans.ttf",
      "/System/Library/Fonts/Helvetica.ttc",
      "/Library/Fonts/Arial.ttf",
    ];
    for (const fp of candidates) {
      try {
        if (existsSync(fp)) {
          const font = fp.endsWith(".ttc")
            ? opentype.parse(readFileSync(fp), 0)
            : opentype.parse(readFileSync(fp));
          this.fontCache = font;
          return font;
        }
      } catch { /* try next */ }
    }
    throw new InternalServerErrorException("No suitable font found for watermark");
  }

  private async applyVisibleWatermark(
    inputPath: string,
    outputPath: string,
    text: string,
    options: { x: number; y: number; opacity: number; fontSize: number; color: string },
  ): Promise<void> {
    const image = sharp(inputPath).rotate();
    const metadata = await image.metadata();
    const imgWidth = metadata.width || 800;
    const imgHeight = metadata.height || 600;

    const absX = Math.round((options.x / 100) * imgWidth);
    const absY = Math.round((options.y / 100) * imgHeight);
    const computedFontSize = Math.max(8, Math.round((options.fontSize / 100) * imgWidth));

    const fontFamilies = "Arial, 'Helvetica Neue', Helvetica, sans-serif";
    const padding = Math.round(computedFontSize * 0.5);

    const estTextW = Math.round(text.length * computedFontSize * 0.7);
    const estTextH = Math.round(computedFontSize * 1.5);
    const svgW = Math.min(estTextW + padding * 2, imgWidth);
    const svgH = Math.min(estTextH + padding * 2, imgHeight);

    const hex = options.color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) || 255;
    const g = parseInt(hex.substring(2, 4), 16) || 255;
    const b = parseInt(hex.substring(4, 6), 16) || 255;
    const alpha = Math.max(0, Math.min(1, (options.opacity / 100)));
    const strokeWidth = Math.max(1, Math.round(computedFontSize * 0.04));

    const escapedText = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    const svg = `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
      <text 
        x="50%" 
        y="50%" 
        font-family="${fontFamilies}" 
        font-size="${computedFontSize}px" 
        font-weight="bold" 
        text-anchor="middle" 
        dominant-baseline="central" 
        fill="rgba(${r},${g},${b},${alpha})" 
        stroke="rgba(0,0,0,${alpha})" 
        stroke-width="${strokeWidth}"
      >${escapedText}</text>
    </svg>`;

    const left = Math.max(0, Math.min(imgWidth - svgW, absX - Math.round(svgW / 2)));
    const top  = Math.max(0, Math.min(imgHeight - svgH, absY - Math.round(svgH / 2)));

    try {
      await image
        .composite([{ input: Buffer.from(svg), top, left }])
        .toFile(outputPath);
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Failed to composite watermark SVG onto image: ${err?.message || err}`,
      );
    }
  }

  private async logAudit(userId: string, action: string, resource: string, resourceId?: string, metadata?: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null)
    const actionKey = (AuditActions as Record<string, string>)[action] || action
    await this.audit.log(
      userId,
      user?.name || "system",
      actionKey,
      resource,
      "0.0.0.0",
      "watermark-service",
      { resourceId, ...metadata },
    );
  }

  private mimeToExt(mime: string | undefined): string {
    if (!mime) return ".png";
    if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
    if (mime.includes("png")) return ".png";
    if (mime.includes("webp")) return ".webp";
    if (mime.includes("bmp")) return ".bmp";
    if (mime.includes("tiff")) return ".tiff";
    return ".png";
  }

  private getCleanDownloadName(fileId: string, prefix: "watermarked" | "original", defaultExt: string): string {
    const base = fileId.replace(/-\d+$/, "");
    const baseWithoutExt = base.replace(/\.[^/.]+$/, "");
    const ext = defaultExt.startsWith(".") ? defaultExt : `.${defaultExt}`;
    return `${prefix}-${baseWithoutExt || "image"}${ext}`;
  }

  async createInvisible(userId: string, file: Express.Multer.File, text: string): Promise<WatermarkResult> {
    if (!text || text.trim().length === 0) throw new BadRequestException("Watermark text is required");
    
    const { mime } = this.validateFile(file, MAX_FILE_SIZE);
    const fileStats = await stat(file.path);
    
    const watermark = await this.prisma.watermark.create({
      data: {
        userId,
        fileId: file.originalname + "-" + Date.now(),
        type: "INVISIBLE",
        text: text.trim(),
        originalPath: "",
        watermarkedPath: "",
        originalMime: mime,
        originalSize: fileStats.size,
      },
    });

    const watermarkedPath = join(this.uploadDir, `${watermark.id}_watermarked.png`);
    const encPath = join(this.uploadDir, `${watermark.id}.enc`);
    
    // Get raw pixels with auto-orientation based on EXIF
    const { data: pixelBuffer, info } = await sharp(file.path)
      .rotate()
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const payload = this.preparePayload(text.trim(), watermark.id);
    
    let watermarkedPngBuffer: Buffer;
    try {
      const watermarkedPixels = this.embedLSB(pixelBuffer, payload);
      watermarkedPngBuffer = await sharp(watermarkedPixels, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 3,
        },
      })
        .png({ 
          compressionLevel: 9,
          progressive: false,
          adaptiveFiltering: false,
          force: true,
        })
        .toBuffer();
    } catch (err: any) {
      await this.safeUnlink(file.path).catch(() => {});
      await this.prisma.watermark.delete({ where: { id: watermark.id } }).catch(() => {});
      throw new BadRequestException(`Failed to embed invisible watermark: ${err?.message || err}`);
    }
    
    writeFileSync(watermarkedPath, watermarkedPngBuffer);
    
    const originalBuffer = readFileSync(file.path);
    const encrypted = this.encrypt(originalBuffer, watermark.id);
    writeFileSync(encPath, encrypted);
    await this.safeUnlink(file.path);
    
    await this.prisma.watermark.update({
      where: { id: watermark.id },
      data: { originalPath: encPath, watermarkedPath },
    });

    await this.logAudit(userId, "WATERMARK_INVISIBLE_EMBED", "watermark", watermark.id, { text: text.trim() });

    return {
      id: watermark.id,
      fileId: watermark.fileId,
      type: "INVISIBLE",
      text: watermark.text,
      originalPath: encPath,
      watermarkedPath,
      createdAt: watermark.createdAt,
    };
  }

  async createVisible(
    userId: string,
    file: Express.Multer.File,
    text: string,
    options: { x: number; y: number; opacity: number; fontSize: number; color: string },
  ): Promise<WatermarkResult> {
    if (!text || text.trim().length === 0) throw new BadRequestException("Watermark text is required");
    
    const { mime, ext } = this.validateFile(file, MAX_FILE_SIZE);
    const fileStats = await stat(file.path);
    
    const x = Math.max(0, Math.min(100, options.x ?? 50));
    const y = Math.max(0, Math.min(100, options.y ?? 50));
    const opacity = Math.max(10, Math.min(100, options.opacity ?? 50));
    const fontSize = Math.max(1, Math.min(200, options.fontSize ?? 24));
    const color = options.color || "#ffffff";
    
    const watermark = await this.prisma.watermark.create({
      data: {
        userId,
        fileId: file.originalname + "-" + Date.now(),
        type: "VISIBLE",
        text: text.trim(),
        positionX: x,
        positionY: y,
        opacity,
        fontSize,
        fontColor: color,
        originalPath: "",
        watermarkedPath: "",
        originalMime: mime,
        originalSize: fileStats.size,
      },
    });

    const watermarkedPath = join(this.uploadDir, `${watermark.id}_watermarked${ext}`);
    const encPath = join(this.uploadDir, `${watermark.id}.enc`);
    
    try {
      await this.applyVisibleWatermark(file.path, watermarkedPath, text.trim(), { x, y, opacity, fontSize, color });
    } catch (err: any) {
      // Clean up temp file and DB record on failure
      if (existsSync(file.path)) await this.safeUnlink(file.path);
      await this.prisma.watermark.delete({ where: { id: watermark.id } }).catch(() => {});
      throw new BadRequestException(`Failed to apply watermark: ${err?.message || err}`);
    }
    
    const originalBuffer = readFileSync(file.path);
    const encrypted = this.encrypt(originalBuffer, watermark.id);
    writeFileSync(encPath, encrypted);
    await this.safeUnlink(file.path);
    
    await this.prisma.watermark.update({
      where: { id: watermark.id },
      data: { originalPath: encPath, watermarkedPath },
    });

    await this.logAudit(userId, "WATERMARK_VISIBLE_EMBED", "watermark", watermark.id, { text: text.trim(), options });

    return {
      id: watermark.id,
      fileId: watermark.fileId,
      type: "VISIBLE",
      text: watermark.text,
      originalPath: encPath,
      watermarkedPath,
      createdAt: watermark.createdAt,
    };
  }

  async findAll(userId: string, page = 1, limit = 20): Promise<PaginatedResult<WatermarkResult>> {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const skip = (safePage - 1) * safeLimit;
    const [items, total] = await Promise.all([
      this.prisma.watermark.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
      this.prisma.watermark.count({ where: { userId } }),
    ]);
    return { items: items as any, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
  }

  async getStats(userId: string): Promise<{ total: number; invisible: number; visible: number }> {
    const [total, invisible, visible] = await Promise.all([
      this.prisma.watermark.count({ where: { userId } }),
      this.prisma.watermark.count({ where: { userId, type: "INVISIBLE" } }),
      this.prisma.watermark.count({ where: { userId, type: "VISIBLE" } }),
    ]);
    return { total, invisible, visible };
  }

  async findById(userId: string, id: string): Promise<WatermarkResult> {
    const watermark = await this.prisma.watermark.findUnique({ where: { id } });
    if (!watermark) throw new NotFoundException("Watermark not found");
    if (watermark.userId !== userId) throw new ForbiddenException("Access denied");
    return watermark as any;
  }

  async extractInvisible(userId: string, id: string): Promise<{ text: string; verified: boolean }> {
    const watermark = await this.findById(userId, id);
    if (watermark.type !== "INVISIBLE") throw new BadRequestException("Not an invisible watermark");
    if (!watermark.watermarkedPath || !existsSync(watermark.watermarkedPath)) {
      throw new NotFoundException("Watermarked file not found");
    }

    try {
      // Read raw RGB pixels from the watermarked PNG file
      const { data: pixelBuffer } = await sharp(watermark.watermarkedPath)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      const extractedPayload = this.extractLSB(pixelBuffer);
      const text = this.parsePayload(extractedPayload, watermark.id);
      return { text, verified: text === watermark.text };
    } catch {
      return { text: "", verified: false };
    }
  }

  async downloadWatermarked(userId: string, id: string): Promise<{ buffer: Buffer; name: string; mime: string }> {
    const watermark = await this.findById(userId, id);
    if (!watermark.watermarkedPath || !existsSync(watermark.watermarkedPath)) {
      throw new NotFoundException("Watermarked file not found");
    }
    const buffer = readFileSync(watermark.watermarkedPath);
    const ext = watermark.type === "INVISIBLE" ? ".png" : this.mimeToExt(watermark.originalMime);
    const name = this.getCleanDownloadName(watermark.fileId, "watermarked", ext);
    const mime = watermark.type === "INVISIBLE" ? "image/png" : (watermark.originalMime || "image/png");
    return { buffer, name, mime };
  }

  async downloadOriginal(userId: string, id: string): Promise<{ buffer: Buffer; name: string; mime: string }> {
    const watermark = await this.findById(userId, id);
    if (!watermark.originalPath || !existsSync(watermark.originalPath)) {
      throw new NotFoundException("Original file not found");
    }
    const encrypted = readFileSync(watermark.originalPath);
    const decrypted = this.decrypt(encrypted, watermark.id);
    const ext = this.mimeToExt(watermark.originalMime);
    const name = this.getCleanDownloadName(watermark.fileId, "original", ext);
    return { buffer: decrypted, name, mime: watermark.originalMime || "image/png" };
  }

  async delete(userId: string, id: string): Promise<{ success: boolean }> {
    const watermark = await this.findById(userId, id);
    if (watermark.originalPath && existsSync(watermark.originalPath)) unlinkSync(watermark.originalPath);
    if (watermark.watermarkedPath && existsSync(watermark.watermarkedPath)) unlinkSync(watermark.watermarkedPath);
    await this.prisma.watermark.delete({ where: { id } });
    await this.logAudit(userId, "WATERMARK_DELETE", "watermark", id);
    return { success: true };
  }

  async generateVisiblePreview(
    file: Express.Multer.File,
    text: string,
    options: { x: number; y: number; opacity: number; fontSize: number; color: string },
  ): Promise<{ buffer: Buffer; mime: string }> {
    if (!text || text.trim().length === 0) throw new BadRequestException("Watermark text is required");
    
    const { mime, ext } = this.validateFile(file, MAX_FILE_SIZE);
    
    const tempOutputPath = join(this.tempDir, `preview_${Date.now()}_${Math.random().toString(36).slice(2)}.png`);
    
    try {
      await this.applyVisibleWatermark(file.path, tempOutputPath, text.trim(), options);
      const buffer = readFileSync(tempOutputPath);
      await this.safeUnlink(tempOutputPath);
      return { buffer, mime: "image/png" };
    } catch (err: any) {
      if (existsSync(tempOutputPath)) await this.safeUnlink(tempOutputPath);
      throw new BadRequestException(`Failed to generate preview: ${err?.message || err}`);
    } finally {
      if (file.path && existsSync(file.path)) await this.safeUnlink(file.path);
    }
  }
}