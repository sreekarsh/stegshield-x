import { Injectable, HttpException, HttpStatus } from "@nestjs/common"
import { stat, readFile, writeFile, unlink } from "fs/promises"
import { existsSync, mkdirSync } from "fs"
import { join, extname } from "path"
import { AiService } from "../ai/ai.service"

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".tif", ".avif", ".heic", ".heif"]

@Injectable()
export class MetadataService {
  constructor(private ai: AiService) {}

  async analyze(userId: string, filePath: string, originalName: string) {
    if (!existsSync(filePath)) {
      throw new HttpException("File not found", HttpStatus.NOT_FOUND)
    }

    const buffer = await readFile(filePath)
    const fileStats = await stat(filePath)

    const aiResult = await this.ai.analyzeExif(buffer, originalName).catch(async () => {
      return this.localAnalyze(buffer, originalName)
    })

    await unlink(filePath).catch(() => {})

    return {
      fileName: originalName,
      fileSize: fileStats.size,
      isImage: aiResult.is_image ?? false,
      hasExif: aiResult.has_exif ?? false,
      totalFields: aiResult.total_fields ?? 0,
      fields: aiResult.fields ?? {},
      categories: aiResult.categories ?? {},
      gpsCoordinates: aiResult.gps_coordinates ?? null,
      riskLevel: aiResult.risk_level ?? "low",
      risks: aiResult.risks ?? [],
      recommendations: aiResult.recommendations ?? [],
      timestamp: new Date().toISOString(),
    }
  }

  async clean(userId: string, filePath: string, originalName: string): Promise<{
    fileName: string
    cleaned: boolean
    removedCategories: string[]
    removedFieldsCount: number
    originalSize: number
    cleanedSize: number
    sizeReduction: number
    cleanedFilePath: string
    timestamp: string
  }> {
    if (!existsSync(filePath)) {
      throw new HttpException("File not found", HttpStatus.NOT_FOUND)
    }

    const buffer = await readFile(filePath)
    const fileStats = await stat(filePath)

    const result = await this.ai.cleanMetadata(buffer, originalName).catch(async () => {
      return this.localClean(buffer, originalName)
    })

    const cleanedDir = join(process.cwd(), "uploads", "metadata-cleaned")
    if (!existsSync(cleanedDir)) {
      mkdirSync(cleanedDir, { recursive: true })
    }

    const safeOriginal = originalName.replace(/[^a-zA-Z0-9._-]/g, "_")
    const cleanedFileName = `cleaned-${userId}-${Date.now()}-${safeOriginal}`
    const cleanedFilePath = join(cleanedDir, cleanedFileName)

    const base64Str = result?.cleaned_file_base64 as string | undefined
    if (!base64Str || base64Str.length === 0) {
      throw new HttpException("Cleaning failed - no data returned", HttpStatus.INTERNAL_SERVER_ERROR)
    }
    const cleanBuffer = Buffer.from(base64Str, "base64")
    await writeFile(cleanedFilePath, cleanBuffer)

    await unlink(filePath).catch(() => {})

    const cleanedStat = await stat(cleanedFilePath)

    return {
      fileName: originalName,
      cleaned: result?.cleaned ?? false,
      removedCategories: result?.removed_categories ?? [],
      removedFieldsCount: result?.removed_fields_count ?? 0,
      originalSize: fileStats.size,
      cleanedSize: cleanedStat.size,
      sizeReduction: fileStats.size - cleanedStat.size,
      cleanedFilePath: cleanedFileName,
      timestamp: new Date().toISOString(),
    }
  }

  private async localAnalyze(buffer: Buffer, originalName: string): Promise<any> {
    const ext = extname(originalName).toLowerCase()

    if (!IMAGE_EXTENSIONS.includes(ext)) {
      return {
        is_image: false,
        has_exif: false,
        total_fields: 0,
        fields: {},
        categories: {},
        gps_coordinates: null,
        risk_level: "unknown",
        risks: ["Local fallback: format not supported — start AI service for full analysis"],
        recommendations: ["Start the AI service for comprehensive metadata analysis of non-image files"],
      }
    }

    let sharp: any
    try {
      sharp = (await import("sharp")).default
    } catch {
      return {
        is_image: true,
        has_exif: false,
        total_fields: 0,
        fields: {},
        categories: {},
        gps_coordinates: null,
        risk_level: "unknown",
        risks: ["Local fallback: sharp library unavailable"],
        recommendations: ["Install sharp or start the AI service for metadata analysis"],
      }
    }

    try {
      const meta = await sharp(buffer).withMetadata().metadata()
      const fields: Record<string, string> = {}
      const categories: Record<string, Record<string, string>> = {}

      if (meta.format) {
        fields["Format"] = meta.format.toUpperCase()
        categories["File"] = { Format: meta.format.toUpperCase() }
      }
      if (meta.width) {
        fields["Width"] = `${meta.width}px`
        categories["Dimensions"] = { ...categories["Dimensions"], Width: `${meta.width}px` }
      }
      if (meta.height) {
        fields["Height"] = `${meta.height}px`
        categories["Dimensions"] = { ...categories["Dimensions"], Height: `${meta.height}px` }
      }
      if (meta.density) {
        fields["Density"] = `${meta.density} DPI`
        categories["Resolution"] = { Density: `${meta.density} DPI` }
      }
      if (meta.channels) {
        const channelNames: Record<number, string> = { 1: "Grayscale", 3: "RGB", 4: "CMYK" }
        const val = channelNames[meta.channels] || `${meta.channels} channels`
        fields["Color Space"] = val
        categories["Color"] = { ...categories["Color"], "Color Space": val }
      }
      if (meta.orientation) {
        const val = `Orientation ${meta.orientation}`
        fields["Orientation"] = val
        categories["Camera"] = { Orientation: val }
      }
      if (meta.alpha) {
        const val = meta.alpha ? "Yes" : "No"
        fields["Alpha"] = val
        categories["Color"] = { ...categories["Color"], Alpha: val }
      }
      if (meta.hasAlpha) {
        fields["Has Alpha"] = "Yes"
        categories["Color"] = { ...categories["Color"], "Has Alpha": "Yes" }
      }
      if (meta.isAnimation) {
        fields["Animation"] = "Yes"
        categories["Format"] = { ...categories["Format"], Animation: "Yes" }
      }
      if (meta.pages) {
        const val = `${meta.pages}`
        fields["Pages"] = val
        categories["Format"] = { ...categories["Format"], Pages: val }
      }
      if (meta.pageHeight) {
        const val = `${meta.pageHeight}px`
        fields["Page Height"] = val
        categories["Dimensions"] = { ...categories["Dimensions"], "Page Height": val }
      }

      const hasExif = meta.exif !== undefined && meta.exif !== null && Buffer.isBuffer(meta.exif) && meta.exif.length > 0
      const hasIcc = meta.icc !== undefined && meta.icc !== null
      const hasIptc = meta.iptc !== undefined && meta.iptc !== null
      const hasXmp = meta.xmp !== undefined && meta.xmp !== null
      const totalFields = Object.keys(fields).length

      const riskIndicators: string[] = []
      if (meta.density && meta.density < 72) riskIndicators.push("Low resolution may indicate processing")
      if (hasExif) riskIndicators.push("EXIF metadata present — may contain location or device info")
      if (hasIptc) riskIndicators.push("IPTC metadata present — may contain author/copyright data")
      if (meta.orientation && meta.orientation !== 1) riskIndicators.push("Non-standard orientation — may indicate editing")

      return {
        is_image: true,
        has_exif: hasExif,
        total_fields: totalFields,
        fields,
        categories,
        gps_coordinates: null,
        risk_level: hasExif ? "medium" : "low",
        risks: riskIndicators,
        recommendations: hasExif
          ? ["Consider stripping EXIF before sharing publicly", "Run metadata cleaning to remove location/device data"]
          : ["No sensitive metadata detected"],
      }
    } catch {
      return {
        is_image: true,
        has_exif: false,
        total_fields: 0,
        fields: {},
        categories: {},
        gps_coordinates: null,
        risk_level: "unknown",
        risks: ["Local fallback: failed to parse image metadata"],
        recommendations: ["Start the AI service for comprehensive metadata analysis"],
      }
    }
  }

  private async localClean(buffer: Buffer, originalName: string): Promise<any> {
    const ext = extname(originalName).toLowerCase()

    if (!IMAGE_EXTENSIONS.includes(ext)) {
      throw new HttpException(
        "Local fallback: metadata cleaning for non-image files requires the AI service to be running. Start it with: uvicorn main:app --host 0.0.0.0 --port 8000",
        HttpStatus.SERVICE_UNAVAILABLE,
      )
    }

    let sharp: any
    try {
      sharp = (await import("sharp")).default
    } catch {
      throw new HttpException("Local fallback: sharp library not available for image processing", HttpStatus.SERVICE_UNAVAILABLE)
    }

    try {
      const meta = await sharp(buffer).withMetadata().metadata()
      const fieldsCount = (meta.exif ? 1 : 0) + (meta.icc ? 1 : 0) + (meta.iptc ? 1 : 0) + (meta.xmp ? 1 : 0)

      const cleanBuffer = await sharp(buffer).toBuffer()

      const removedCategories: string[] = []
      if (meta.exif) removedCategories.push("EXIF")
      if (meta.icc) removedCategories.push("ICC Profile")
      if (meta.iptc) removedCategories.push("IPTC")
      if (meta.xmp) removedCategories.push("XMP")

      return {
        cleaned: true,
        cleaned_file_base64: cleanBuffer.toString("base64"),
        removed_categories: removedCategories,
        removed_fields_count: fieldsCount,
      }
    } catch (err: any) {
      throw new HttpException(
        `Local fallback: failed to clean metadata — ${err.message || "unknown error"}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }
}
