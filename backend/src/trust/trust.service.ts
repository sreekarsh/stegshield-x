import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"

function grade(avg: number): string {
  if (avg >= 90) return "A+"
  if (avg >= 80) return "A"
  if (avg >= 70) return "B+"
  if (avg >= 60) return "B"
  if (avg >= 50) return "C"
  if (avg >= 35) return "D"
  return "F"
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v))
}

const DOCUMENT_EXTS = new Set(["pdf", "doc", "docx", "txt", "rtf", "odt", "xls", "xlsx", "ppt", "pptx", "csv"])
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "bmp", "gif", "webp", "tiff", "tif", "svg", "ico"])
const AUDIO_EXTS = new Set(["wav", "mp3", "flac", "ogg", "aac", "wma", "m4a"])
const VIDEO_EXTS = new Set(["mp4", "avi", "mkv", "mov", "wmv", "flv", "webm"])
const COMPRESSED_EXTS = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "enc", "gpg"])
const EXECUTABLE_EXTS = new Set(["exe", "dll", "bat", "cmd", "ps1", "vbs", "scr", "jar", "msi", "sh", "elf", "app"])

function getExt(fileName: string): string {
  const name = fileName.trim()
  const i = name.lastIndexOf(".")
  return i >= 0 ? name.slice(i + 1).trim().toLowerCase() : ""
}

@Injectable()
export class TrustService {
  constructor(private prisma: PrismaService) {}

  async score(userId: string, fileId: string, data?: { fileName?: string; size?: number; type?: string }) {
    if (!fileId) throw new BadRequestException("fileId is required")
    const size = typeof data?.size === "number" && !isNaN(data.size) ? Math.max(0, data.size) : 0
    const safeSize = typeof data?.size === "number" && !isNaN(data.size) ? Math.min(Math.max(0, Math.floor(data.size)), 2147483647) : null
    const type = (data?.type ?? "").trim().toLowerCase()
    const fileName = (data?.fileName ?? fileId).trim()
    const ext = getExt(fileName)

    const isExecutable = EXECUTABLE_EXTS.has(ext)
      || type.includes("executable") || type.includes("x-msdownload")
      || type.includes("x-dosexec") || type.includes("vnd.microsoft.portable-executable")
      || type.includes("x-msdos-program")

    const isDocument = DOCUMENT_EXTS.has(ext) || type.includes("pdf") || type.includes("document") || type.includes("officedocument")
    const isImage = IMAGE_EXTS.has(ext) || type.startsWith("image/")
    const isAudio = AUDIO_EXTS.has(ext) || type.startsWith("audio/")
    const isVideo = VIDEO_EXTS.has(ext) || type.startsWith("video/")
    const isCompressed = COMPRESSED_EXTS.has(ext) || type.includes("zip") || type.includes("compress") || type.includes("gzip")

    const isPlaintext = ["txt", "csv", "log", "json", "xml", "html", "js", "ts", "py", "css", "md", "yaml", "yml", "ini", "cfg", "conf"]
      .includes(ext) || type.includes("text/") || type.includes("json") || type.includes("xml")

    const isSensitiveMedia = isImage || isAudio || isVideo

    let encryptionScore = 50
    if (isCompressed) encryptionScore = 75
    else if (isExecutable) encryptionScore = 30
    else if (isPlaintext) encryptionScore = 45
    else if (isSensitiveMedia) encryptionScore = 55
    else if (isDocument) encryptionScore = 60

    let privacyScore = 50
    if (isPlaintext) privacyScore = 70
    else if (isDocument) privacyScore = 55
    else if (isSensitiveMedia) privacyScore = 40
    else if (isExecutable) privacyScore = 35
    else if (isCompressed) privacyScore = 45

    let integrityScore = 80
    if (isCompressed) integrityScore = 90
    else if (isDocument) integrityScore = 85
    else if (isSensitiveMedia) integrityScore = 75
    else if (isExecutable) integrityScore = 65
    else integrityScore = 80

    let rawThreatScore = 0
    if (isExecutable) rawThreatScore += 25
    if (size > 100_000_000) rawThreatScore += 15
    else if (size > 50_000_000) rawThreatScore += 10
    else if (size > 10_000_000) rawThreatScore += 5
    if (size === 0 || !fileName) rawThreatScore += 10

    let rawStegoRisk = 0
    if (isSensitiveMedia) rawStegoRisk += 20
    else if (isDocument) rawStegoRisk += 8
    else if (isCompressed) rawStegoRisk += 10
    if (size > 50_000_000) rawStegoRisk += 10
    else if (size > 10_000_000) rawStegoRisk += 5

    const clampedEncryption = clamp(encryptionScore)
    const clampedPrivacy = clamp(privacyScore)
    const clampedIntegrity = clamp(integrityScore)
    const clampedThreat = clamp(rawThreatScore)
    const clampedStego = clamp(rawStegoRisk)

    const avg = Math.round((clampedEncryption + clampedPrivacy + clampedIntegrity + (100 - clampedThreat) + (100 - clampedStego)) / 5)
    const overallGrade = grade(avg)

    return this.prisma.trustScore.upsert({
      where: { userId_fileId: { userId, fileId } },
      update: {
        encryptionScore: clampedEncryption,
        privacyScore: clampedPrivacy,
        integrityScore: clampedIntegrity,
        threatScore: clampedThreat,
        stegoRisk: clampedStego,
        overallGrade,
        fileName,
        fileSize: safeSize,
        fileType: type || null,
      },
      create: {
        fileId,
        userId,
        fileName,
        fileSize: safeSize,
        fileType: type || null,
        encryptionScore: clampedEncryption,
        privacyScore: clampedPrivacy,
        integrityScore: clampedIntegrity,
        threatScore: clampedThreat,
        stegoRisk: clampedStego,
        overallGrade,
      },
    })
  }

  async getScore(userId: string, fileId: string) {
    const score = await this.prisma.trustScore.findFirst({ where: { fileId, userId } })
    if (!score) throw new NotFoundException("No trust score found for this file")
    return score
  }

  async getAllScores(userId: string) {
    return this.prisma.trustScore.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })
  }

  async deleteScore(userId: string, fileId: string) {
    const score = await this.prisma.trustScore.findFirst({ where: { fileId, userId } })
    if (!score) throw new NotFoundException("No trust score found for this file")
    await this.prisma.trustScore.delete({ where: { id: score.id } })
    return { deleted: true }
  }
}
