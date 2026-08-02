import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { createHash, createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";

const pbkdf2Sync: (password: string, salt: string, iterations: number, keylen: number, digest: string) => Buffer =
  (require("crypto") as any).pbkdf2Sync;
import { createReadStream, unlinkSync, readFileSync, writeFileSync, existsSync, statSync, readdirSync } from "fs";
import { stat } from "fs/promises";
import { join, extname } from "path";
import { PrismaService } from "../prisma/prisma.service";
import { sanitizeIp } from "../common/utils";
import { AuditService } from "../audit/audit.service";
import { AuditActions } from "../audit/audit.constants";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { R2Service } from "../storage/r2.service";

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
  docx: { magic: [0x50, 0x4b, 0x03, 0x04], mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ".docx" },
  xlsx: { magic: [0x50, 0x4b, 0x03, 0x04], mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ".xlsx" },
  pptx: { magic: [0x50, 0x4b, 0x03, 0x04], mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", ext: ".pptx" },
};

const ENC_IV_LENGTH = 12;
const ENC_TAG_LENGTH = 16;
const ALLOWED_MIMES = Object.values(MAGIC_BYTES).map(m => m.mime);
const MAX_FILE_SIZE_BY_PLAN: Record<string, number> = {
  FREE: 50 * 1024 * 1024,
  PRO: 500 * 1024 * 1024,
  ENTERPRISE: 2 * 1024 * 1024 * 1024,
};

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EvidenceWithCustody {
  id: string;
  caseId: string | null;
  userId: string;
  name: string;
  type: string;
  hash: string;
  hashAlgorithm: string;
  size: number;
  filePath: string | null;
  fileData?: Buffer | null;
  status: string;
  createdAt: Date;
  lastAccessedAt: Date | null;
  lastModifiedAt: Date | null;
  custody: CustodyEntry[];
  user?: { id: string; name: string; email: string };
  case?: { id: string; name: string } | null;
}

export interface CustodyEntry {
  id: string;
  evidenceId: string;
  userId: string;
  userName: string;
  action: string;
  signature: string;
  timestamp: Date;
}

export interface CreateEvidenceDto {
  caseId?: string;
  file: Express.Multer.File;
}

export interface UpdateEvidenceDto {
  name?: string;
  caseId?: string;
  status?: string;
}

export interface BulkOperationDto {
  ids: string[];
  action: "delete" | "archive" | "status" | "export";
  status?: string;
}

@Injectable()
export class EvidenceService {
  private readonly uploadDir: string;
  private readonly aiServiceUrl: string;
  private readonly maxRetries = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly audit: AuditService,
    private readonly r2: R2Service,
  ) {
    this.uploadDir = this.config.get("UPLOAD_DIR") || join(process.cwd(), "uploads", "evidence");
    this.aiServiceUrl = this.config.get("AI_SERVICE_URL") || "http://localhost:8000";
    this.ensureUploadDir();
    this.ensureTempDir();
  }

  private ensureUploadDir() {
    if (!existsSync(this.uploadDir)) {
      require("fs").mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private ensureTempDir() {
    const tempDir = join(this.uploadDir, "temp");
    if (!existsSync(tempDir)) {
      require("fs").mkdirSync(tempDir, { recursive: true });
    }
  }

  private getSecretKey(): string {
    const key = this.config.get("EVIDENCE_ENCRYPTION_KEY") || this.config.get("SECRET_KEY");
    if (!key) {
      throw new InternalServerErrorException("Encryption key not configured");
    }
    return key;
  }

  private getUserPlan(userId: string): Promise<string> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizations: { select: { organization: { select: { plan: true } } } } },
    }).then(u => u?.organizations[0]?.organization?.plan || "FREE");
  }

  private detectMime(bytes: Buffer): { mime: string; ext: string } | null {
    for (const [, { magic, mime, ext }] of Object.entries(MAGIC_BYTES)) {
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
    if (detected) {
      return detected;
    }
    const ext = extname(file.originalname).toLowerCase() || ".bin";
    const mime = file.mimetype || "application/octet-stream";
    return { mime, ext };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  private async computeHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filePath);
      stream.on("data", chunk => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  private deriveKey(salt: string): Buffer {
    return pbkdf2Sync(this.getSecretKey(), salt, 100000, 32, "sha256");
  }

  private encryptFile(raw: Buffer, salt: string): Buffer {
    const key = this.deriveKey(salt);
    const iv = randomBytes(ENC_IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: ENC_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private decryptFile(data: Buffer, salt: string): Buffer {
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

  private async scanForThreats(filePath: string): Promise<{ clean: boolean; threats: string[]; threatScore: number }> {
    try {
      const fileBuffer = readFileSync(filePath);
      const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`;
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="scan.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`),
        fileBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);
      const apiKey = this.config.get("AI_API_KEY") || "stegshield-ai-key-change-in-production";
      const response = await firstValueFrom(
        this.http.post<{ threat_score: number; threat_level: string; indicators: { description: string }[] }>(
          `${this.aiServiceUrl}/analyze/threat`,
          body,
          {
            headers: {
              "Content-Type": `multipart/form-data; boundary=${boundary}`,
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            timeout: 30000,
          },
        ),
      );
      const { threat_score, indicators } = response.data;
      return {
        clean: threat_score < 40,
        threats: indicators?.map((i: { description: string }) => i.description) || [],
        threatScore: threat_score,
      };
    } catch {
      return { clean: true, threats: [], threatScore: 0 };
    }
  }

  private async logAudit(userId: string, action: string, resource: string, resourceId?: string, metadata?: any, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null)
    const actionKey = (AuditActions as Record<string, string>)[action] || action
    await this.audit.log(
      userId,
      user?.name || "system",
      actionKey,
      resource,
      sanitizeIp(ip),
      "evidence-service",
      { resourceId, ...metadata },
    );
  }

  async create(userId: string, file: Express.Multer.File, caseId?: string): Promise<EvidenceWithCustody> {
    try {
      const plan = await this.getUserPlan(userId);
      const maxSize = MAX_FILE_SIZE_BY_PLAN[plan] || MAX_FILE_SIZE_BY_PLAN.FREE;
      const { mime, ext } = this.validateFile(file, maxSize);

      const rawBytes = readFileSync(file.path);
      const hash = await this.computeHash(file.path);
      const fileStats = await stat(file.path);
      const user = await this.prisma.user.findUnique({ where: { id: userId } });

      const encrypted = this.encryptFile(rawBytes, file.originalname);
      const r2Key = `evidence/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}.enc`;

      let filePath = r2Key
      let fileData: Buffer | undefined

      if (this.r2.isConfigured) {
        await this.r2.upload(r2Key, encrypted, mime)
      } else {
        filePath = join(this.uploadDir, `${file.originalname}`)
        fileData = encrypted
      }

      const evidence = await this.prisma.evidence.create({
        data: {
          userId,
          caseId: caseId || undefined,
          name: file.originalname,
          type: mime,
          hash: `sha256:${hash}`,
          hashAlgorithm: "sha256",
          size: fileStats.size,
          filePath,
          fileData,
          status: "COLLECTED",
          lastAccessedAt: new Date(),
          lastModifiedAt: new Date(),
        },
      });

      unlinkSync(file.path);

      const custodySignature = createHmac("sha256", this.getSecretKey())
        .update(`${evidence.id}:COLLECTED:${userId}:${Date.now()}`)
        .digest("hex");

      await this.prisma.custodyEntry.create({
        data: {
          evidenceId: evidence.id,
          userId,
          userName: user?.name || "Unknown",
          action: "COLLECTED",
          signature: custodySignature,
        },
      });

      this.logAudit(userId, "EVIDENCE_UPLOAD", "evidence", evidence.id, { caseId: evidence.caseId, size: fileStats.size, mime }).catch(() => {})

      return this.findById(userId, evidence.id);
    } catch (error) {
      if (file && file.path && existsSync(file.path)) {
        try { unlinkSync(file.path); } catch {}
      }
      throw error;
    }
  }

  async findAll(userId: string, page = 1, limit = 20, filters?: { caseId?: string; status?: string; search?: string }, decoyMode = false, fakeVaultId?: string | null): Promise<PaginatedResult<EvidenceWithCustody>> {
    const skip = (page - 1) * limit;
    const where: any = { userId };

    if (decoyMode) {
      where.id = fakeVaultId || "__none__";
    }

    if (filters?.caseId) where.caseId = filters.caseId;
    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { caseId: { contains: filters.search, mode: "insensitive" } },
        { hash: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.evidence.findMany({
        where,
        include: { custody: { orderBy: { timestamp: "desc" } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.evidence.count({ where }),
    ]);

    return {
      items: items as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(userId: string, evidenceId: string, decoyMode = false, fakeVaultId?: string | null): Promise<EvidenceWithCustody> {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { custody: { orderBy: { timestamp: "desc" } }, user: { select: { id: true, name: true, email: true } } },
    });
    if (!evidence) throw new NotFoundException("Evidence not found");
    if (evidence.userId !== userId) throw new ForbiddenException("Access denied");
    if (decoyMode && evidenceId !== fakeVaultId) throw new NotFoundException("Evidence not found");
    return evidence as any;
  }

  async download(userId: string, evidenceId: string, decoyMode = false, fakeVaultId?: string | null): Promise<{ buffer: Buffer; name: string; type: string }> {
    const evidence = await this.findById(userId, evidenceId, decoyMode, fakeVaultId);

    let decrypted: Buffer;
    try {
      if (evidence.fileData) {
        decrypted = this.decryptFile(evidence.fileData, evidence.id);
      } else if (evidence.filePath && this.r2.isConfigured) {
        const r2Data = await this.r2.download(evidence.filePath);
        decrypted = this.decryptFile(r2Data, evidence.id);
      } else {
        throw new NotFoundException("Evidence file data not found. This file may have been uploaded before the storage migration. Please re-upload the file.")
      }
    } catch (err: any) {
      const msg = err?.message || "Unknown error"
      if (msg.includes("NoSuchKey") || msg.includes("NotFound") || msg.includes("404")) {
        throw new NotFoundException(`File not found in storage: ${msg}`)
      }
      throw new ForbiddenException(`Download failed: ${msg}`)
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const accessSignature = createHmac("sha256", this.getSecretKey())
      .update(`${evidence.id}:ACCESSED:${userId}:${Date.now()}`)
      .digest("hex");

    await this.prisma.custodyEntry.create({
      data: { evidenceId: evidence.id, userId, userName: user?.name || "Unknown", action: "ACCESSED", signature: accessSignature },
    });

    await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: { lastAccessedAt: new Date() },
    });

    await this.logAudit(userId, "EVIDENCE_DOWNLOAD", "evidence", evidenceId);

    return { buffer: decrypted, name: evidence.name, type: evidence.type };
  }

  async updateStatus(userId: string, evidenceId: string, status: string): Promise<EvidenceWithCustody> {
    const evidence = await this.prisma.evidence.findUnique({ where: { id: evidenceId } });
    if (!evidence) throw new NotFoundException("Evidence not found");
    if (evidence.userId !== userId) throw new ForbiddenException("Access denied");

    const validStatuses = ["COLLECTED", "ANALYZING", "VERIFIED", "SUBMITTED", "ARCHIVED"];
    if (!validStatuses.includes(status)) throw new BadRequestException("Invalid status");

    const updated = await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: { status: status as any, lastModifiedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const sig = createHmac("sha256", this.getSecretKey())
      .update(`${evidence.id}:STATUS_CHANGED:${status}:${userId}:${Date.now()}`)
      .digest("hex");

    await this.prisma.custodyEntry.create({
      data: { evidenceId: evidence.id, userId, userName: user?.name || "Unknown", action: `STATUS_CHANGED:${status}`, signature: sig },
    });

    await this.logAudit(userId, "EVIDENCE_STATUS_CHANGE", "evidence", evidenceId, { from: evidence.status, to: status });

    return this.findById(userId, evidenceId);
  }

  async update(userId: string, evidenceId: string, data: UpdateEvidenceDto): Promise<EvidenceWithCustody> {
    const evidence = await this.prisma.evidence.findUnique({ where: { id: evidenceId } });
    if (!evidence) throw new NotFoundException("Evidence not found");
    if (evidence.userId !== userId) throw new ForbiddenException("Access denied");

    const { status, ...updateData } = data;
    const updated = await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: { ...updateData, lastModifiedAt: new Date() },
    });

    if (data.name && data.name !== evidence.name) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      const sig = createHmac("sha256", this.getSecretKey())
        .update(`${evidence.id}:RENAMED:${data.name}:${userId}:${Date.now()}`)
        .digest("hex");
      await this.prisma.custodyEntry.create({
        data: { evidenceId: evidence.id, userId, userName: user?.name || "Unknown", action: `RENAMED:${data.name}`, signature: sig },
      });
      await this.logAudit(userId, "EVIDENCE_RENAME", "evidence", evidenceId, { from: evidence.name, to: data.name });
    }

    return this.findById(userId, evidenceId);
  }

  async bulkOperation(userId: string, dto: BulkOperationDto): Promise<{ success: string[]; failed: { id: string; error: string }[] }> {
    const results = { success: [] as string[], failed: [] as { id: string; error: string }[] };

    for (const id of dto.ids) {
      try {
        const evidence = await this.prisma.evidence.findUnique({ where: { id } });
        if (!evidence) {
          results.success.push(id)
          continue
        }
        if (evidence.userId !== userId) {
          results.failed.push({ id, error: "Access denied" })
          continue
        }

        switch (dto.action) {
          case "delete":
            try {
              if (evidence.filePath && evidence.filePath.startsWith("evidence/") && this.r2.isConfigured) {
                await this.r2.delete(evidence.filePath)
              } else if (evidence.filePath) {
                try { unlinkSync(evidence.filePath) } catch {}
              }
            } catch (storageError: any) {
              console.warn(`Failed to delete storage for evidence ${id}: ${storageError.message}`)
            }
            await this.prisma.custodyEntry.deleteMany({ where: { evidenceId: id } });
            await this.prisma.evidenceShare.deleteMany({ where: { evidenceId: id } });
            await this.prisma.forensicsReport.deleteMany({ where: { evidenceId: id } });
            await this.prisma.evidence.delete({ where: { id } }).catch(() => {});
            await this.logAudit(userId, "EVIDENCE_DELETE", "evidence", id);
            break;
          case "archive":
            await this.prisma.evidence.update({ where: { id }, data: { status: "ARCHIVED", lastModifiedAt: new Date() } });
            await this.logAudit(userId, "EVIDENCE_ARCHIVE", "evidence", id);
            break;
          case "status":
            if (!dto.status) throw new BadRequestException("Status required");
            await this.updateStatus(userId, id, dto.status);
            break;
          case "export":
            // handled separately
            break;
        }
        results.success.push(id);
      } catch (e: any) {
        results.failed.push({ id, error: e.message });
      }
    }
    return results;
  }

  async exportManifest(userId: string, evidenceIds: string[]): Promise<Buffer> {
    const items = await this.prisma.evidence.findMany({
      where: { id: { in: evidenceIds }, userId },
      include: { custody: { orderBy: { timestamp: "asc" } } },
    });

    const manifest = {
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      evidenceCount: items.length,
      items: items.map(e => ({
        id: e.id,
        name: e.name,
        caseId: e.caseId,
        hash: e.hash,
        size: e.size,
        type: e.type,
        status: e.status,
        createdAt: e.createdAt,
        lastAccessedAt: e.lastAccessedAt,
        lastModifiedAt: e.lastModifiedAt,
        chainOfCustody: e.custody.map(c => ({
          action: c.action,
          userName: c.userName,
          userId: c.userId,
          timestamp: c.timestamp,
          signature: c.signature,
        })),
      })),
    };

    return Buffer.from(JSON.stringify(manifest, null, 2));
  }

  async getCases(userId: string) {
    return this.prisma.evidence.groupBy({
      by: ["caseId"],
      where: { userId },
      _count: { caseId: true },
      _max: { createdAt: true },
    });
  }

  async createCase(userId: string, name: string) {
    const normalized = name.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (!normalized) throw new BadRequestException("Invalid case name");
    const existing = await this.prisma.case.findUnique({ where: { id: normalized } });
    if (existing) throw new BadRequestException("Case already exists");
    return this.prisma.case.create({
      data: { id: normalized, userId, name: name.trim() },
    });
  }

  async getStats(userId: string) {
    const [total, byStatus, totalSize, cases] = await Promise.all([
      this.prisma.evidence.count({ where: { userId } }),
      this.prisma.evidence.groupBy({ by: ["status"], where: { userId }, _count: { status: true } }),
      this.prisma.evidence.aggregate({ where: { userId }, _sum: { size: true } }),
      this.prisma.evidence.groupBy({ by: ["caseId"], where: { userId }, _count: { caseId: true } }),
    ]);
    return { total, byStatus: byStatus.map(s => ({ status: s.status, count: s._count.status })), totalSize: totalSize._sum.size || 0, caseCount: cases.length };
  }

  async verifyIntegrity(userId: string, evidenceId: string): Promise<{ valid: boolean; expected: string; actual: string }> {
    const evidence = await this.findById(userId, evidenceId);
    if (!evidence.fileData && !(evidence.filePath && this.r2.isConfigured)) {
      return { valid: false, expected: evidence.hash, actual: "FILE_DATA_MISSING" };
    }
    let decrypted: Buffer;
    try {
      if (evidence.fileData) {
        decrypted = this.decryptFile(evidence.fileData, evidence.id);
      } else {
        const r2Data = await this.r2.download(evidence.filePath!);
        decrypted = this.decryptFile(r2Data, evidence.id);
      }
    } catch {
      return { valid: false, expected: evidence.hash, actual: "DECRYPTION_FAILED" };
    }
    const actualHash = `sha256:${createHash("sha256").update(decrypted).digest("hex")}`;
    return { valid: actualHash === evidence.hash, expected: evidence.hash, actual: actualHash };
  }
}