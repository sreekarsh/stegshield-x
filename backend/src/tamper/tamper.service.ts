import { Injectable, HttpException, HttpStatus, Logger } from "@nestjs/common"
import { createHash } from "crypto"
import { stat, readFile, unlink } from "fs/promises"
import { existsSync } from "fs"
import { PrismaService } from "../prisma/prisma.service"
import { AiService } from "../ai/ai.service"

const MAX_MEMORY_FILE_SIZE = 100 * 1024 * 1024

export interface TamperResult {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  sha256: string
  tamperProbability: number | null
  tamperScore: number | null
  tamperAnalysis: string | null
  deepfakeProbability: number | null
  deepfakeConfidence: number | null
  deepfakeAnalysis: string | null
  deepfakeFeatures: string[]
  threatScore: number
  threatLevel: string
  threatBreakdown: Record<string, boolean>
  malwareHeaders: any[]
  malwareStrings: string[]
  avgEntropy: number
  maxEntropy: number
  entropySuspicious: boolean
  lsbRatio: number
  lsbDeviation: number
  stegoSuspicion: boolean
  structureValid: boolean
  structureIssues: string[]
  elaAvailable: boolean
  elaScore: number | null
  elaProbability: number | null
  overallRisk: string
  degraded: boolean
  timestamp: string
}

@Injectable()
export class TamperService {
  private readonly logger = new Logger(TamperService.name)

  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  async analyzeFile(userId: string, filePath: string, originalName: string, mimeType: string): Promise<TamperResult> {
    if (!existsSync(filePath)) {
      throw new HttpException("File not found", HttpStatus.NOT_FOUND)
    }

    const fileStats = await stat(filePath)
    if (fileStats.size > MAX_MEMORY_FILE_SIZE) {
      await unlink(filePath).catch(() => {})
      throw new HttpException(`File too large for analysis (max ${MAX_MEMORY_FILE_SIZE / 1024 / 1024}MB)`, HttpStatus.PAYLOAD_TOO_LARGE)
    }
    const buffer = await readFile(filePath)
    const sha256 = createHash("sha256").update(buffer).digest("hex")

    let advanced: any = {}
    let deepfakeData: any = {}
    let degraded = false

    try { advanced = await this.ai.analyzeAdvancedTamper(buffer, originalName) }
    catch (e) { this.logger.error(`Advanced tamper analysis failed for ${originalName}: ${(e as any)?.message ?? e}`); degraded = true }
    try { deepfakeData = await this.ai.detectDeepfake(buffer, originalName) }
    catch (e) { this.logger.error(`Deepfake detection failed for ${originalName}: ${(e as any)?.message ?? e}`); degraded = true }

    await unlink(filePath).catch((e) => this.logger.warn(`Failed to delete uploaded file ${filePath}: ${e.message}`))

    const entropyData = advanced.entropy_analysis || {}
    const malwareData = advanced.malware_scan || {}
    const threatData = advanced.threat_assessment || {}
    const fileStruct = advanced.file_structure || { valid: true, issues: [] }
    const elaData = advanced.ela || {}
    const lsbData = advanced.lsb_analysis || {}
    const tamperResult = advanced.tamper_analysis
    const tamperValid = tamperResult && !tamperResult.error

    const tp = tamperValid ? (tamperResult.tamper_probability ?? null) : null
    const ts = tamperValid ? (tamperResult.tamper_score ?? null) : null
    const ta = tamperValid ? (tamperResult.analysis ?? null) : null
    const dp = deepfakeData?.deepfake_probability ?? null
    const dc = deepfakeData?.confidence ?? null
    const da = deepfakeData?.analysis ?? null
    const df = deepfakeData?.features_analyzed ?? []

    const avgEntropy = entropyData.average_entropy ?? 0
    const maxEntropy = entropyData.max_entropy ?? 0
    const entropySusp = entropyData.suspicious_segments ?? false

    const lsbR = lsbData.lsb_ratio ?? 0.5
    const lsbD = lsbData.lsb_deviation ?? 0
    const stegoS = lsbData.stego_suspicion ?? false

    const structValid = fileStruct.valid ?? true
    const structIssues = fileStruct.issues ?? []

    const elaAvail = elaData.ela_available ?? false
    const elaS = elaData.ela_score ?? null
    const elaP = elaData.ela_probability ?? null

    const threatScore = threatData.threat_score ?? 0
    const threatLevel = threatData.threat_level ?? "unknown"
    const threatBreakdown = threatData.threat_breakdown ?? {}
    const malHeaders = malwareData.headers ?? []
    const malStrings = malwareData.strings ?? []

    const COMPRESSED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "zip", "gz", "7z", "rar", "pdf"])
    const ext = (originalName.split(".").pop() || "").toLowerCase()
    const isCompressedFormat = COMPRESSED_EXTENSIONS.has(ext)
    const realEntropySuspicious = isCompressedFormat ? (entropySusp && maxEntropy > 7.99) : entropySusp

    const overallScore = Math.max(
      threatScore,
      realEntropySuspicious ? 35 : (!isCompressedFormat && avgEntropy > 7.5 ? 20 : 0),
      stegoS ? 25 : 0,
      (tp ?? 0) > 0.5 ? 40 : (tp ?? 0) > 0.35 ? 20 : 0,
      (dp ?? 0) > 0.6 ? 40 : (dp ?? 0) > 0.35 ? 20 : 0,
      malwareData.has_malware_indicators ? 40 : 0,
      !structValid ? 20 : 0,
    )

    const overallRisk = overallScore >= 70 ? "critical"
      : overallScore >= 40 ? "high"
      : overallScore >= 20 ? "medium"
      : "low"

    const report = await this.prisma.tamperReport.create({
      data: {
        userId,
        fileName: originalName,
        fileType: mimeType || "unknown",
        fileSize: fileStats.size || buffer.length,
        sha256,
        tamperProbability: tp,
        tamperScore: ts,
        tamperAnalysis: ta,
        deepfakeProbability: dp,
        deepfakeConfidence: dc,
        deepfakeAnalysis: da,
        deepfakeFeatures: df,
        threatScore,
        threatLevel,
        threatBreakdown,
        malwareHeaders: malHeaders,
        malwareStrings: malStrings,
        avgEntropy,
        maxEntropy,
        entropySuspicious: entropySusp,
        lsbRatio: lsbR,
        lsbDeviation: lsbD,
        stegoSuspicion: stegoS,
        structureValid: structValid,
        structureIssues: structIssues,
        elaAvailable: elaAvail,
        elaScore: elaS,
        elaProbability: elaP,
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
      tamperProbability: report.tamperProbability,
      tamperScore: report.tamperScore,
      tamperAnalysis: report.tamperAnalysis,
      deepfakeProbability: report.deepfakeProbability,
      deepfakeConfidence: report.deepfakeConfidence,
      deepfakeAnalysis: report.deepfakeAnalysis,
      deepfakeFeatures: (report.deepfakeFeatures as string[]) || [],
      threatScore: report.threatScore,
      threatLevel: report.threatLevel,
      threatBreakdown: (report.threatBreakdown as Record<string, boolean>) || {},
      malwareHeaders: (report.malwareHeaders as any[]) || [],
      malwareStrings: (report.malwareStrings as string[]) || [],
      avgEntropy: report.avgEntropy,
      maxEntropy: report.maxEntropy,
      entropySuspicious: report.entropySuspicious,
      lsbRatio: report.lsbRatio,
      lsbDeviation: report.lsbDeviation,
      stegoSuspicion: report.stegoSuspicion,
      structureValid: report.structureValid,
      structureIssues: (report.structureIssues as string[]) || [],
      elaAvailable: report.elaAvailable,
      elaScore: report.elaScore,
      elaProbability: report.elaProbability,
      overallRisk: report.overallRisk,
      degraded: report.degraded,
      timestamp: report.analyzedAt.toISOString(),
    }
  }

  async getReports(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.prisma.tamperReport.findMany({
        where: { userId },
        orderBy: { analyzedAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.tamperReport.count({ where: { userId } }),
    ])
    return { items, total, page, limit }
  }

  async getReport(id: string, userId: string) {
    const report = await this.prisma.tamperReport.findFirst({ where: { id, userId } })
    if (!report) throw new HttpException("Report not found", HttpStatus.NOT_FOUND)
    return report
  }

  async deleteReport(id: string, userId: string) {
    const report = await this.prisma.tamperReport.findFirst({ where: { id, userId } })
    if (!report) throw new HttpException("Report not found", HttpStatus.NOT_FOUND)
    await this.prisma.tamperReport.delete({ where: { id } })
    return { deleted: true }
  }
}
