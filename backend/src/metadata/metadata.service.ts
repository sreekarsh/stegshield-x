import { Injectable, HttpException, HttpStatus } from "@nestjs/common"
import { stat, readFile, writeFile, unlink } from "fs/promises"
import { existsSync, mkdirSync } from "fs"
import { join, extname } from "path"
import { AiService } from "../ai/ai.service"

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".tif", ".avif", ".heic", ".heif"]

const EXIF_TAG_NAMES: Record<number, string> = {
  0x010F: "make", 0x0110: "model", 0x011A: "x_resolution", 0x011B: "y_resolution",
  0x0128: "resolution_unit", 0x0131: "software", 0x0132: "datetime",
  0x013B: "artist", 0x8298: "copyright", 0x8769: "exif_offset",
  0x8825: "gps_info", 0x9003: "datetime_original", 0x9004: "datetime_digitized",
  0x920A: "focal_length", 0x829D: "f_number", 0x829A: "exposure_time",
  0x9207: "metering_mode", 0x9209: "flash", 0xA402: "exposure_mode",
  0xA403: "white_balance", 0xA406: "scene_capture_type",
  0xA408: "contrast", 0xA409: "saturation", 0xA40A: "sharpness",
}

const EXIF_CATEGORIES: Record<string, number[]> = {
  Camera: [0x010F, 0x0110, 0x920A, 0x829D, 0x829A, 0x9207, 0x9209, 0xA402, 0xA403, 0xA406, 0x0132],
  Software: [0x0131, 0x013B],
  Copyright: [0x8298, 0x013B],
  Thumbnail: [0x0201, 0x0202, 0x0203],
  GPS: [0x8825],
  Timestamp: [0x0132, 0x9003, 0x9004],
}

function parseExifBuffer(exifBuffer: Buffer): { fields: Record<string, string>; categories: Record<string, Record<string, string>>; gpsLat: number | null; gpsLon: number | null } {
  const fields: Record<string, string> = {}
  const categories: Record<string, Record<string, string>> = {}
  let gpsLat: number | null = null
  let gpsLon: number | null = null

  if (!exifBuffer || exifBuffer.length < 8) {
    return { fields, categories, gpsLat, gpsLon }
  }

  const view = new DataView(exifBuffer.buffer, exifBuffer.byteOffset, exifBuffer.byteLength)
  const byteOrder = view.getUint16(0)
  const le = byteOrder === 0x4949
  const tiffOffset = 8

  if (tiffOffset + 8 > exifBuffer.length) {
    return { fields, categories, gpsLat, gpsLon }
  }

  const ifdOffset = view.getUint32(tiffOffset + 4, le)
  const ifdStart = tiffOffset + ifdOffset
  if (ifdStart + 2 > exifBuffer.length) {
    return { fields, categories, gpsLat, gpsLon }
  }

  const numEntries = view.getUint16(ifdStart, le)
  const entries: { tag: number; type: number; count: number; valueOffset: number }[] = []

  for (let i = 0; i < numEntries; i++) {
    const entryStart = ifdStart + 2 + i * 12
    if (entryStart + 12 > exifBuffer.length) break
    const tag = view.getUint16(entryStart, le)
    const type = view.getUint16(entryStart + 2, le)
    const count = view.getUint32(entryStart + 4, le)
    const valueOffset = count > 4 ? view.getUint32(entryStart + 8, le) + tiffOffset : entryStart + 8
    entries.push({ tag, type, count, valueOffset })
  }

  for (const entry of entries) {
    const tagName = EXIF_TAG_NAMES[entry.tag]
    if (!tagName) continue

    let value: string
    try {
      if (entry.tag === 0x8825) {
        value = "GPS data present"
        if (entry.valueOffset + 4 <= exifBuffer.length) {
          const gpsIfdOffset = view.getUint32(entry.valueOffset - tiffOffset + tiffOffset, le)
          const gpsIfdStart = tiffOffset + gpsIfdOffset
          if (gpsIfdStart + 2 <= exifBuffer.length) {
            const gpsEntries = view.getUint16(gpsIfdStart, le)
            let latRef = "N"
            let lonRef = "E"
            const latParts: number[] = []
            const lonParts: number[] = []
            for (let j = 0; j < gpsEntries; j++) {
              const ge = gpsIfdStart + 2 + j * 12
              if (ge + 12 > exifBuffer.length) break
              const gTag = view.getUint16(ge, le)
              const gCount = view.getUint32(ge + 4, le)
              const gOffset = gCount > 4 ? view.getUint32(ge + 8, le) + tiffOffset : ge + 8
              if (gTag === 1) latRef = String.fromCharCode(view.getUint8(gOffset))
              if (gTag === 3) lonRef = String.fromCharCode(view.getUint8(gOffset))
              if (gTag === 2) {
                for (let k = 0; k < Math.min(gCount, 3); k++) {
                  const p = gOffset + k * 8
                  if (p + 8 <= exifBuffer.length) {
                    const num = view.getUint32(p, le)
                    const den = view.getUint32(p + 4, le)
                    latParts.push(den ? num / den : 0)
                  }
                }
              }
              if (gTag === 4) {
                for (let k = 0; k < Math.min(gCount, 3); k++) {
                  const p = gOffset + k * 8
                  if (p + 8 <= exifBuffer.length) {
                    const num = view.getUint32(p, le)
                    const den = view.getUint32(p + 4, le)
                    lonParts.push(den ? num / den : 0)
                  }
                }
              }
            }
            if (latParts.length === 3) {
              gpsLat = latParts[0] + latParts[1] / 60 + latParts[2] / 3600
              if (latRef === "S") gpsLat = -gpsLat
            }
            if (lonParts.length === 3) {
              gpsLon = lonParts[0] + lonParts[1] / 60 + lonParts[2] / 3600
              if (lonRef === "W") gpsLon = -gpsLon
            }
          }
        }
      } else if (entry.type === 2) {
        const bytes: number[] = []
        for (let j = 0; j < entry.count - 1 && entry.valueOffset + j < exifBuffer.length; j++) {
          bytes.push(view.getUint8(entry.valueOffset + j))
        }
        value = String.fromCharCode(...bytes).replace(/\0+$/, "")
      } else if (entry.type === 3) {
        value = entry.count === 1 ? String(view.getUint16(entry.valueOffset, le)) : String(view.getUint16(entry.valueOffset, le))
      } else if (entry.type === 4) {
        value = entry.count === 1 ? String(view.getUint32(entry.valueOffset, le)) : String(view.getUint32(entry.valueOffset, le))
      } else if (entry.type === 5) {
        const num = view.getUint32(entry.valueOffset, le)
        const den = view.getUint32(entry.valueOffset + 4, le)
        value = den ? `${num}/${den}` : String(num)
      } else {
        continue
      }

      if (!value || value === "0") continue
      fields[tagName] = value

      for (const [cat, tags] of Object.entries(EXIF_CATEGORIES)) {
        if (tags.includes(entry.tag)) {
          categories[cat] = categories[cat] || {}
          categories[cat][tagName] = value
          break
        }
      }
    } catch {
      // skip unparseable tags
    }
  }

  return { fields, categories, gpsLat, gpsLon }
}

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

      const hasExif = !!meta.exif && Buffer.isBuffer(meta.exif) && meta.exif.length > 0
      const hasIcc = !!meta.icc
      const hasIptc = !!meta.iptc
      const hasXmp = !!meta.xmp

      let exifFields: Record<string, string> = {}
      let exifCategories: Record<string, Record<string, string>> = {}
      let gpsLat: number | null = null
      let gpsLon: number | null = null

      if (hasExif) {
        const parsed = parseExifBuffer(meta.exif)
        exifFields = parsed.fields
        exifCategories = parsed.categories
        gpsLat = parsed.gpsLat
        gpsLon = parsed.gpsLon
      }

      const allFields = { ...exifFields, ...fields }
      const allCategories = { ...exifCategories, ...categories }
      const totalFields = Object.keys(allFields).length

      const riskIndicators: string[] = []
      if (meta.density && meta.density < 72) riskIndicators.push("Low resolution may indicate processing")
      if (hasExif) riskIndicators.push("EXIF metadata present — may contain location or device info")
      if (hasIptc) riskIndicators.push("IPTC metadata present — may contain author/copyright data")
      if (hasIcc) riskIndicators.push("ICC color profile present — may encode printer/device info")
      if (hasXmp) riskIndicators.push("XMP metadata present — may contain extended editing history")
      if (meta.orientation && meta.orientation !== 1) riskIndicators.push("Non-standard orientation — may indicate editing")
      if (gpsLat !== null && gpsLon !== null) riskIndicators.push("GPS coordinates embedded — reveals exact photo location")

      return {
        is_image: true,
        has_exif: hasExif,
        total_fields: totalFields,
        fields: allFields,
        categories: allCategories,
        gps_coordinates: gpsLat !== null && gpsLon !== null ? { latitude: gpsLat, longitude: gpsLon } : null,
        risk_level: (gpsLat !== null && gpsLon !== null) ? "high" : hasExif ? "medium" : "low",
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

      const format = (meta.format || "png").toLowerCase()
      let cleanBuffer: Buffer
      if (format === "jpeg" || format === "jpg") {
        cleanBuffer = await sharp(buffer).jpeg({ exif: false, icc_profile: false }).toBuffer()
      } else if (format === "png") {
        cleanBuffer = await sharp(buffer).png({ exif: false }).toBuffer()
      } else if (format === "webp") {
        cleanBuffer = await sharp(buffer).webp({ exif: false }).toBuffer()
      } else {
        cleanBuffer = await sharp(buffer).toBuffer()
      }

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
