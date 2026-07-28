import { Injectable, NotFoundException, ForbiddenException, BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { createHash, createCipheriv, createDecipheriv, randomBytes, createHmac, generateKeyPair } from "crypto";

import { pbkdf2Sync } from "crypto";
import { createReadStream, unlinkSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from "fs";
import { stat } from "fs/promises";
import { join } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

const MAGIC_BYTES: Record<string, { magic: number[]; mime: string; ext: string }> = {
  pdf: { magic: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf", ext: ".pdf" },
  png: { magic: [0x89, 0x50, 0x4e, 0x47], mime: "image/png", ext: ".png" },
  jpeg: { magic: [0xff, 0xd8, 0xff], mime: "image/jpeg", ext: ".jpg" },
  zip: { magic: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip", ext: ".zip" },
  gif: { magic: [0x47, 0x49, 0x46, 0x38], mime: "image/gif", ext: ".gif" },
  webp: { magic: [0x52, 0x49, 0x46, 0x46], mime: "image/webp", ext: ".webp" },
  bmp: { magic: [0x42, 0x4d], mime: "image/bmp", ext: ".bmp" },
  tiff: { magic: [0x49, 0x49, 0x2a, 0x00], mime: "image/tiff", ext: ".tiff" },
  mp3: { magic: [0x49, 0x44, 0x33], mime: "audio/mpeg", ext: ".mp3" },
  mp4: { magic: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], mime: "video/mp4", ext: ".mp4" },
  wav: { magic: [0x52, 0x49, 0x46, 0x46], mime: "audio/wav", ext: ".wav" },
};

const ENC_IV_LENGTH = 12;
const ENC_TAG_LENGTH = 16;
const ALLOWED_MIMES = Object.values(MAGIC_BYTES).map(m => m.mime);
const MAX_FILE_SIZE = 500 * 1024 * 1024;

export type Algorithm = "AES-256-GCM" | "AES-256-CBC" | "ChaCha20-Poly1305";

export interface EncryptionResult {
  encryptedData: Buffer;
  iv: Buffer;
  authTag?: Buffer;
  algorithm: Algorithm;
  keyId: string;
  key?: Buffer;
}

export interface KeyPairResult {
  publicKey: string;
  privateKey: string;
}

@Injectable()
export class EncryptionService {
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadDir = this.config.get("UPLOAD_DIR") || join(process.cwd(), "uploads", "encryption");
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private getSecretKey(): string {
    const key = this.config.get("ENCRYPTION_MASTER_KEY") || this.config.get("SECRET_KEY");
    if (!key) throw new InternalServerErrorException("Encryption master key not configured");
    return key;
  }

  private getAlgorithmConfig(algorithm: Algorithm): { name: string; ivLength: number; tagLength: number } {
    switch (algorithm) {
      case "AES-256-GCM":
        return { name: "aes-256-gcm", ivLength: 12, tagLength: 16 };
      case "AES-256-CBC":
        return { name: "aes-256-cbc", ivLength: 16, tagLength: 0 };
      case "ChaCha20-Poly1305":
        return { name: "chacha20-poly1305", ivLength: 12, tagLength: 16 };
      default:
        return { name: "aes-256-gcm", ivLength: 12, tagLength: 16 };
    }
  }

  private deriveKey(salt: string): Buffer {
    return pbkdf2Sync(this.getSecretKey(), salt, 100000, 32, "sha256");
  }

  async generateAESKey(algorithm: Algorithm, userId: string): Promise<{ algorithm: Algorithm; keyId: string }> {
    const key = randomBytes(32);
    
    const keyRecord = await this.prisma.encryptionKey.create({
      data: {
        userId,
        algorithm,
        keySize: 256,
        isActive: true,
      },
    });

    const encryptedKey = this.encrypt(key, keyRecord.id);
    const updated = await this.prisma.encryptionKey.update({
      where: { id: keyRecord.id },
      data: { encryptedKey: encryptedKey.toString("base64") },
    });

    return {
      algorithm,
      keyId: updated.id,
    };
  }

  async getUserKeys(userId: string) {
    return this.prisma.encryptionKey.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getKeyById(keyId: string, userId?: string): Promise<{ key: Buffer; algorithm: Algorithm }> {
    const record = await this.prisma.encryptionKey.findUnique({ where: { id: keyId } });
    if (!record) throw new NotFoundException("Key not found");
    if (userId && record.userId !== userId) throw new ForbiddenException("Access denied");
    if (!record.isActive) throw new ForbiddenException("Key has been revoked");
    if (!record.encryptedKey) throw new InternalServerErrorException("Encryption key is invalid");

    const key = this.decrypt(Buffer.from(record.encryptedKey, "base64"), record.id);
    return { key, algorithm: record.algorithm as Algorithm };
  }

  async rotateKey(userId: string, keyId: string): Promise<{ algorithm: Algorithm; keyId: string }> {
    const record = await this.prisma.encryptionKey.findUnique({ where: { id: keyId } });
    if (!record || record.userId !== userId) throw new NotFoundException("Key not found");

    const newKey = randomBytes(32);

    const encryptedKey = this.encrypt(newKey, record.id);

    const [newRecord] = await this.prisma.$transaction([
      this.prisma.encryptionKey.create({
        data: {
          userId,
          algorithm: record.algorithm,
          keySize: 256,
          isActive: true,
          encryptedKey: encryptedKey.toString("base64"),
        },
      }),
      this.prisma.encryptionKey.update({
        where: { id: keyId },
        data: { isActive: false, rotatedAt: new Date() },
      }),
    ]);

    return { algorithm: record.algorithm as Algorithm, keyId: newRecord.id };
  }

  async revokeKey(userId: string, keyId: string): Promise<{ success: boolean }> {
    const record = await this.prisma.encryptionKey.findUnique({ where: { id: keyId } });
    if (!record || record.userId !== userId) throw new NotFoundException("Key not found");
    
    await this.prisma.encryptionKey.update({
      where: { id: keyId },
      data: { isActive: false, rotatedAt: new Date() },
    });
    return { success: true };
  }

  async generateRSAKeyPair(userId: string, keySize = 2048): Promise<KeyPairResult> {
    return new Promise((resolve, reject) => {
      generateKeyPair("rsa", {
        modulusLength: keySize,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      }, (err, publicKey, privateKey) => {
        if (err) reject(err);
        else resolve({ publicKey, privateKey });
      });
    });
  }

  private encrypt(raw: Buffer, salt: string): Buffer {
    const key = this.deriveKey(salt);
    const iv = randomBytes(ENC_IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private decrypt(data: Buffer, salt: string): Buffer {
    const key = this.deriveKey(salt);
    const iv = data.subarray(0, ENC_IV_LENGTH);
    const authTag = data.subarray(ENC_IV_LENGTH, ENC_IV_LENGTH + ENC_TAG_LENGTH);
    const ciphertext = data.subarray(ENC_IV_LENGTH + ENC_TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new Error("Decryption failed — invalid key or corrupted data");
    }
  }

  private detectMime(bytes: Buffer): { mime: string; ext: string } | null {
    for (const [, { magic, mime, ext }] of Object.entries(MAGIC_BYTES)) {
      if (bytes.length >= magic.length && magic.every((b, i) => bytes[i] === b)) {
        return { mime, ext };
      }
    }
    return null;
  }

  private validateFile(file: Express.Multer.File): { mime: string; ext: string } {
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File too large. Maximum size: ${this.formatBytes(MAX_FILE_SIZE)}`);
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

  async encryptFileBuffer(
    filePath: string,
    algorithm: Algorithm = "AES-256-GCM",
    keyId?: string,
    userId?: string,
  ): Promise<EncryptionResult> {
    const { mime, ext } = this.detectMime(readFileSync(filePath)) || { mime: "application/octet-stream", ext: ".enc" };
    const buffer = readFileSync(filePath);
    
    let key: Buffer;
    let usedKeyId: string;
    
    if (keyId) {
      const { key: foundKey } = await this.getKeyById(keyId, userId);
      key = foundKey;
      usedKeyId = keyId;
    } else {
      // Generate ephemeral key without persisting to DB
      const config = this.getAlgorithmConfig(algorithm);
      key = randomBytes(32);
      usedKeyId = "ephemeral-" + randomBytes(8).toString("hex");
    }

    const config = this.getAlgorithmConfig(algorithm);
    const iv = randomBytes(config.ivLength);
    const cipher = config.tagLength > 0
      ? createCipheriv(config.name, key, iv, { authTagLength: config.tagLength } as any)
      : createCipheriv(config.name, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = config.tagLength > 0 ? (cipher as any).getAuthTag() : undefined;

    return { encryptedData: encrypted, iv, authTag, algorithm, keyId: usedKeyId, key: keyId ? undefined : key };
  }

  async decryptFileBuffer(
    encryptedPath: string,
    key: Buffer,
    algorithm: Algorithm,
    iv: Buffer,
    authTag?: Buffer,
  ): Promise<Buffer> {
    const config = this.getAlgorithmConfig(algorithm);
    const encryptedData = readFileSync(encryptedPath);
    
    const decipher = config.tagLength > 0
      ? createDecipheriv(config.name, key, iv, { authTagLength: config.tagLength } as any)
      : createDecipheriv(config.name, key, iv);
    if (authTag) (decipher as any).setAuthTag(authTag);
    
    try {
      return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    } catch {
      throw new Error("Decryption failed — wrong key, corrupted data, or unsupported algorithm");
    }
  }

  async decryptBuffer(
    params: { encryptedData: Buffer; iv: Buffer; authTag?: Buffer; algorithm: Algorithm; key: Buffer }
  ): Promise<Buffer> {
    const { encryptedData, iv, authTag, algorithm, key } = params;
    const config = this.getAlgorithmConfig(algorithm);
    const decipher = config.tagLength > 0
      ? createDecipheriv(config.name, key, iv, { authTagLength: config.tagLength } as any)
      : createDecipheriv(config.name, key, iv);
    if (authTag) (decipher as any).setAuthTag(authTag);
    
    try {
      return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    } catch {
      throw new Error("Decryption failed");
    }
  }
}