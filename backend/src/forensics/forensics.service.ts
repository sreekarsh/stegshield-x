import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common"
import { createHash } from "crypto"
import { existsSync } from "fs"
import { stat, readFile, unlink } from "fs/promises"
import { PrismaService } from "../prisma/prisma.service"
import { AiService } from "../ai/ai.service"
import * as path from "path"

const MAX_MEMORY_FILE_SIZE = 100 * 1024 * 1024

export interface ForensicsResult {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  sha256: string
  md5: string
  entropy: number
  entropyRatio: number
  entropySuspicious: boolean
  stegoProbability: number
  stegoRisk: string
  lsbRatio: number
  lsbDeviation: number
  stegoSuspicion: boolean
  tamperProbability: number | null
  tamperScore: number | null
  tamperAnalysis: string | null
  deepfakeProbability: number | null
  deepfakeConfidence: number | null
  deepfakeAnalysis: string | null
  threatScore: number
  threatLevel: string
  threatBreakdown: Record<string, boolean> | null
  malwareIndicators: boolean
  executableHeaders: any[]
  maliciousStrings: string[]
  fileStructureValid: boolean
  fileStructureIssues: any[]
  metadataAnomalies: any[]
  elaScore: number | null
  elaAvailable: boolean | null
  elaProbability: number | null
  extractedStrings: string[]
  embeddedFiles: any[]
  overallRisk: string
  degraded: boolean
  timestamp: string
}

@Injectable()
export class ForensicsService {
  private readonly logger = new Logger(ForensicsService.name)

  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  async analyzeFile(userId: string, filePath: string, originalName: string, mimeType: string): Promise<ForensicsResult> {
    if (!existsSync(filePath)) {
      throw new HttpException("File not found", HttpStatus.NOT_FOUND)
    }

    const fileStats = await stat(filePath)
    if (fileStats.size > MAX_MEMORY_FILE_SIZE) {
      throw new HttpException(`File too large for in-memory analysis (max ${MAX_MEMORY_FILE_SIZE / 1024 / 1024}MB)`, HttpStatus.PAYLOAD_TOO_LARGE)
    }
    const buffer = await readFile(filePath)
    const sha256 = this.computeHash(buffer)
    const md5 = this.computeMd5(buffer)

    const strings = this.extractStrings(buffer)
    const embedded = this.detectEmbeddedFiles(buffer)

    let advanced: any = { entropy_analysis: {}, lsb_analysis: {}, malware_scan: {}, threat_assessment: {} }
    let tamperData: any = null
    let deepfakeData: any = null
    let stegoData: any = null
    let degraded = false

    try {
      advanced = await this.ai.analyzeAdvancedTamper(buffer, originalName)
    } catch (e) {
      this.logger.error(`Advanced tamper analysis failed for ${originalName}: ${(e as any)?.message ?? e}`)
      degraded = true
    }

    try {
      tamperData = await this.ai.detectTamper(buffer, originalName)
    } catch (e) {
      this.logger.error(`Tamper detection failed for ${originalName}: ${(e as any)?.message ?? e}`)
      degraded = true
    }

    try {
      deepfakeData = await this.ai.detectDeepfake(buffer, originalName)
    } catch (e) {
      this.logger.error(`Deepfake detection failed for ${originalName}: ${(e as any)?.message ?? e}`)
      degraded = true
    }

    try {
      stegoData = await this.ai.analyzeStego(buffer, originalName)
    } catch (e) {
      this.logger.error(`Stego analysis failed for ${originalName}: ${(e as any)?.message ?? e}`)
      degraded = true
    }

    try {
      await unlink(filePath)
    } catch (e) {
      this.logger.warn(`Failed to delete uploaded file ${filePath}: ${(e as any)?.message ?? e}`)
    }

    const entropyData = advanced.entropy_analysis || {}
    const lsbData = advanced.lsb_analysis || {}
    const malwareData = advanced.malware_scan || {}
    const threatData = advanced.threat_assessment || {}
    const fileStruct = advanced.file_structure || { valid: true, issues: [] }
    const elaData = advanced.ela || { ela_score: 0, ela_available: false, ela_probability: 0 }
    const tamperResult = advanced.tamper_analysis || tamperData || {}

    const entropy = entropyData.average_entropy ?? (() => {
      const data = new Uint8Array(buffer)
      const freq = new Array(256).fill(0)
      for (const b of data) freq[b]++
      let e = 0
      for (const count of freq) {
        if (count === 0) continue
        const p = count / data.length
        e -= p * Math.log2(p)
      }
      return e
    })()

    const COMPRESSED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "zip", "gz", "7z", "rar", "pdf", "mp3", "mp4", "mov"])
    const ext = path.extname(originalName).toLowerCase().replace(".", "")
    const isCompressedFormat = COMPRESSED_EXTENSIONS.has(ext) || (mimeType && (mimeType.includes("png") || mimeType.includes("jpeg") || mimeType.includes("zip") || mimeType.includes("pdf")))

    const entropyThreshold = isCompressedFormat ? 7.995 : 7.5
    const entropySuspicious = entropy > entropyThreshold

    const stegoProb = stegoData?.stego_probability ?? (lsbData.stego_suspicion ? 0.6 : 0.1)
    const lsbRatio = lsbData.lsb_ratio ?? 0.5
    const lsbDev = lsbData.lsb_deviation ?? 0
    const stegoRisk = stegoProb > 0.6 ? "high" : stegoProb > 0.3 ? "medium" : "low"

    const entropyScoreContrib = isCompressedFormat ? (entropy > 7.995 ? 25 : 0) : (entropy > 7.5 ? 30 : 0)
    const rawThreatScore = threatData.threat_score ?? 0
    const overallScore = Math.max(
      rawThreatScore,
      entropyScoreContrib,
      stegoProb > 0.6 ? 40 : stegoProb > 0.3 ? 25 : 0,
      (tamperResult.tamper_probability || 0) > 0.6 ? 35 : (tamperResult.tamper_probability || 0) > 0.4 ? 20 : 0,
      (deepfakeData?.deepfake_probability || 0) > 0.6 ? 40 : (deepfakeData?.deepfake_probability || 0) > 0.3 ? 20 : 0,
      malwareData.has_malware_indicators ? 30 : 0,
      !fileStruct.valid ? 15 : 0,
    )

    const overallRisk = overallScore >= 70 ? "critical"
      : overallScore >= 40 ? "high"
      : overallScore >= 20 ? "medium"
      : "low"

    const threatBreakdown = {
      high_entropy: entropySuspicious,
      lsb_anomaly: lsbDev > 0.05,
      image_tampering: (tamperResult.tamper_probability || 0) > 0.5,
      ela_anomaly: (elaData.ela_probability || 0) > 0.5,
      file_corruption: !fileStruct.valid,
      malware_indicators: malwareData.has_malware_indicators ?? false,
    }

    const report = await this.prisma.forensicsReport.create({
      data: {
        userId,
        fileName: originalName,
        fileType: mimeType || path.extname(originalName).slice(1).toUpperCase() || "UNKNOWN",
        fileSize: fileStats.size,
        sha256,
        md5,
        entropy,
        entropyRatio: entropy / 8,
        entropySuspicious,
        stegoProbability: stegoProb,
        stegoRisk,
        lsbRatio,
        lsbDeviation: lsbDev,
        stegoSuspicion: lsbDev > 0.05,
        tamperProbability: tamperResult.tamper_probability ?? null,
        tamperScore: tamperResult.tamper_score ?? null,
        tamperAnalysis: tamperResult.analysis ?? null,
        deepfakeProbability: deepfakeData?.deepfake_probability ?? null,
        deepfakeConfidence: deepfakeData?.confidence ?? null,
        deepfakeAnalysis: deepfakeData?.analysis ?? null,
        threatScore: overallScore,
        threatLevel: overallRisk,
        threatBreakdown,
        malwareIndicators: malwareData.has_malware_indicators ?? false,
        executableHeaders: malwareData.headers ?? [],
        maliciousStrings: malwareData.strings ?? [],
        fileStructureValid: fileStruct.valid ?? true,
        fileStructureIssues: fileStruct.issues ?? [],
        metadataAnomalies: [],
        elaScore: elaData.ela_score ?? null,
        elaAvailable: elaData.ela_available ?? null,
        elaProbability: elaData.ela_probability ?? null,
        extractedStrings: strings,
        embeddedFiles: embedded,
        overallRisk,
        degraded,
      },
    })

    return {
      id: report.id,
      fileName: report.fileName,
      fileType: report.fileType,
      fileSize: report.fileSize,
      sha256: report.sha256,
      md5: report.md5 ?? "",
      entropy: report.entropy,
      entropyRatio: report.entropyRatio,
      entropySuspicious: report.entropySuspicious,
      stegoProbability: report.stegoProbability,
      stegoRisk: report.stegoRisk,
      lsbRatio: report.lsbRatio,
      lsbDeviation: report.lsbDeviation,
      stegoSuspicion: report.stegoSuspicion,
      tamperProbability: report.tamperProbability,
      tamperScore: report.tamperScore,
      tamperAnalysis: report.tamperAnalysis,
      deepfakeProbability: report.deepfakeProbability,
      deepfakeConfidence: report.deepfakeConfidence,
      deepfakeAnalysis: report.deepfakeAnalysis,
      threatScore: report.threatScore,
      threatLevel: report.threatLevel,
      threatBreakdown: report.threatBreakdown as any,
      malwareIndicators: report.malwareIndicators,
      executableHeaders: report.executableHeaders as any,
      maliciousStrings: report.maliciousStrings as any,
      fileStructureValid: report.fileStructureValid,
      fileStructureIssues: report.fileStructureIssues as any,
      metadataAnomalies: report.metadataAnomalies as any,
      elaScore: report.elaScore,
      elaAvailable: report.elaAvailable,
      elaProbability: report.elaProbability,
      extractedStrings: report.extractedStrings as any,
      embeddedFiles: report.embeddedFiles as any,
      overallRisk: report.overallRisk,
      degraded: report.degraded,
      timestamp: report.analyzedAt.toISOString(),
    }
  }

  async getReports(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.prisma.forensicsReport.findMany({
        where: { userId },
        orderBy: { analyzedAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.forensicsReport.count({ where: { userId } }),
    ])
    return { items, total, page, limit }
  }

  async getReport(id: string, userId: string) {
    const report = await this.prisma.forensicsReport.findFirst({
      where: { id, userId },
    })
    if (!report) throw new HttpException("Report not found", HttpStatus.NOT_FOUND)
    return report
  }

  async deleteReport(id: string, userId: string) {
    const report = await this.prisma.forensicsReport.findFirst({
      where: { id, userId },
    })
    if (!report) throw new HttpException("Report not found", HttpStatus.NOT_FOUND)
    await this.prisma.forensicsReport.delete({ where: { id } })
    return { deleted: true }
  }

  private computeHash(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex")
  }

  private computeMd5(buffer: Buffer): string {
    return createHash("md5").update(buffer).digest("hex")
  }

  private extractStrings(buffer: Buffer): string[] {
    const strings: string[] = []
    let current = ""
    for (const byte of buffer) {
      if (byte >= 32 && byte <= 126) {
        current += String.fromCharCode(byte)
      } else {
        if (current.length >= 6) strings.push(current)
        current = ""
      }
    }
    if (current.length >= 6) strings.push(current)
    return strings.slice(0, 50)
  }

  private detectEmbeddedFiles(buffer: Buffer): any[] {
    const signatures: { name: string; magic: number[]; ext: string; minLen?: number }[] = [
      { name: "PNG Image", magic: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], ext: "png" },
      { name: "JPEG Image", magic: [0xFF, 0xD8, 0xFF], ext: "jpg" },
      { name: "GIF Image", magic: [0x47, 0x49, 0x46, 0x38], ext: "gif text" },
      { name: "ZIP Archive", magic: [0x50, 0x4B, 0x03, 0x04], ext: "zip" },
      { name: "PDF Document", magic: [0x25, 0x50, 0x44, 0x46], ext: "pdf" },
      { name: "ELF Binary", magic: [0x7F, 0x45, 0x4C, 0x46], ext: "elf" },
      { name: "RIFF (AVI/WAV)", magic: [0x52, 0x49, 0x46, 0x46], ext: "avi" },
      { name: "SQLite DB", magic: [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6F, 0x72, 0x6D, 0x61, 0x74, 0x20, 0x33, 0x00], ext: "sqlite" },
      { name: "7z Archive", magic: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], ext: "7z" },
      { name: "RAR Archive", magic: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00], ext: "rar" },
    ]

    const found: any[] = []
    for (const sig of signatures) {
      let offset = 0
      while (true) {
        const idx = buffer.indexOf(Buffer.from(sig.magic), offset)
        if (idx === -1) break
        if (idx > 0) {
          found.push({ type: sig.name, offset: idx, extension: sig.ext })
        }
        offset = idx + 1
        if (found.length >= 20) break
      }
    }
    return found
  }
}
