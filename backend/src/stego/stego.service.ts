import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common"
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"
import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import { PrismaService } from "../prisma/prisma.service"

const MIME_TO_FORMAT: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPEG",
  "image/bmp": "BMP",
  "image/gif": "GIF",
  "audio/wav": "WAV",
  "audio/mpeg": "MP3",
  "video/mp4": "MP4",
  "application/pdf": "PDF",
}

const ALGORITHM_BY_TYPE: Record<string, string> = {
  PNG: "LSB-spatial",
  JPEG: "LSB-spatial",
  BMP: "LSB-spatial",
  GIF: "LSB-spatial",
  WAV: "LSB-audio",
  MP3: "append-stego",
  MP4: "append-stego",
  PDF: "append-stego",
}

function embedLSB(carrier: Buffer, payload: Buffer): Buffer {
  const pixels = new Uint8Array(carrier)
  const headerSize = 32
  const totalBits = headerSize + payload.length * 8
  if (totalBits > pixels.length * 8) {
    throw new BadRequestException("Message too large for carrier file")
  }

  for (let b = 0; b < headerSize; b++) {
    const bit = (payload.length >> (headerSize - 1 - b)) & 1
    pixels[b] = (pixels[b] & 0xFE) | bit
  }

  for (let i = 0; i < payload.length; i++) {
    for (let b = 7; b >= 0; b--) {
      const idx = headerSize + i * 8 + (7 - b)
      pixels[idx] = (pixels[idx] & 0xFE) | ((payload[i] >> b) & 1)
    }
  }

  return Buffer.from(pixels)
}

function extractLSB(carrier: Buffer): Buffer {
  const pixels = new Uint8Array(carrier)
  const headerSize = 32

  let payloadLength = 0
  for (let b = 0; b < headerSize; b++) {
    payloadLength = (payloadLength << 1) | (pixels[b] & 1)
  }

  if (payloadLength === 0 || payloadLength > 1024 * 1024) {
    throw new BadRequestException("Invalid or empty payload in carrier")
  }

  const totalNeededBits = headerSize + payloadLength * 8
  if (totalNeededBits > pixels.length * 8) {
    throw new BadRequestException("Carrier data appears corrupted — payload length exceeds file size")
  }

  const result = new Uint8Array(payloadLength)
  for (let i = 0; i < payloadLength; i++) {
    let byte = 0
    for (let b = 0; b < 8; b++) {
      const idx = headerSize + i * 8 + b
      byte = (byte << 1) | (pixels[idx] & 1)
    }
    result[i] = byte
  }

  return Buffer.from(result)
}

function xorDecrypt(data: Buffer, key: string): Buffer {
  const keyBytes = Buffer.from(key, "utf-8")
  const result = Buffer.alloc(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length]
  }
  return result
}

@Injectable()
export class StegoService {
  private readonly uploadDir: string

  constructor(private prisma: PrismaService) {
    this.uploadDir = join(process.cwd(), "uploads", "stego")
    if (!existsSync(this.uploadDir)) {
      require("fs").mkdirSync(this.uploadDir, { recursive: true })
    }
  }

  async embed(userId: string, dto: { carrierId: string; message: string; encrypt?: boolean }) {
    if (!dto.carrierId || !dto.message) {
      throw new BadRequestException("carrierId and message are required")
    }

    const carrier = await this.prisma.evidence.findUnique({ where: { id: dto.carrierId } })
    if (!carrier) {
      throw new NotFoundException("Carrier file not found")
    }
    if (!existsSync(carrier.filePath)) {
      throw new NotFoundException("Carrier file not found on disk")
    }

    const mimeKey = carrier.type?.toLowerCase() || "UNKNOWN"
    const format = MIME_TO_FORMAT[mimeKey]
    if (!format) {
      throw new BadRequestException(
        `Unsupported carrier type '${carrier.type}'. Supported: ${Object.values(MIME_TO_FORMAT).join(", ")}`,
      )
    }

    const carrierBuffer = readFileSync(carrier.filePath)
    let messageBuffer = Buffer.from(dto.message, "utf-8")
    let encryptionKeyHex: string | undefined = undefined

    if (dto.encrypt) {
      const key = randomBytes(32)
      encryptionKeyHex = key.toString("hex")
      const iv = randomBytes(12)
      const cipher = createCipheriv("aes-256-gcm", key, iv)
      const encrypted = Buffer.concat([cipher.update(messageBuffer), cipher.final()])
      const tag = cipher.getAuthTag()
      const version = Buffer.from([0x01])
      messageBuffer = Buffer.concat([version, iv, tag, encrypted])
    }

    const stegoBuffer = embedLSB(carrierBuffer, messageBuffer)
    const stegoFileName = `stego_${carrier.id}_${Date.now()}.bin`
    const stegoFilePath = join(this.uploadDir, stegoFileName)
    writeFileSync(stegoFilePath, stegoBuffer)

    const record = await this.prisma.stegoFile.create({
      data: {
        userId,
        name: `stego_${carrier.name}`,
        carrierFile: dto.carrierId,
        carrierType: format,
        hiddenDataSize: dto.message.length,
        algorithm: ALGORITHM_BY_TYPE[format] || "LSB-spatial",
        encryption: dto.encrypt ? "AES-256-GCM" : "none",
      },
    })

    return {
      id: record.id,
      name: record.name,
      algorithm: record.algorithm,
      encryption: record.encryption,
      encryptionKey: encryptionKeyHex,
      hiddenDataSize: record.hiddenDataSize,
      stegoFile: stegoFilePath,
    }
  }

  async extract(userId: string, dto: { fileId: string; key?: string }) {
    if (!dto.fileId) {
      throw new BadRequestException("fileId is required")
    }

    const record = await this.prisma.stegoFile.findFirst({
      where: { id: dto.fileId, userId },
    })
    if (!record) {
      throw new NotFoundException("Stego record not found or access denied")
    }

    const carrier = await this.prisma.evidence.findUnique({ where: { id: record.carrierFile } })
    if (!carrier || !existsSync(carrier.filePath)) {
      throw new NotFoundException("Original carrier file not found on disk")
    }

    const carrierBuffer = readFileSync(carrier.filePath)
    const payload = extractLSB(carrierBuffer)

    let message: string
    if (payload[0] === 0x01 && payload.length > 29) {
      if (!dto.key) {
        throw new BadRequestException("Decryption key is required for encrypted stego payload")
      }
      const iv = payload.subarray(1, 13)
      const tag = payload.subarray(13, 29)
      const encrypted = payload.subarray(29)

      try {
        const key = Buffer.from(dto.key, "hex")
        const decipher = createDecipheriv("aes-256-gcm", key, iv)
        decipher.setAuthTag(tag)
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
        message = decrypted.toString("utf-8")
      } catch {
        throw new BadRequestException("Decryption failed — wrong key or corrupted data")
      }
    } else if (dto.key) {
      message = xorDecrypt(payload, dto.key).toString("utf-8").replace(/\0+$/, "")
    } else {
      message = payload.toString("utf-8").replace(/\0+$/, "")
    }

    return {
      message,
      fileId: dto.fileId,
      algorithm: record.algorithm,
      encryption: record.encryption,
      hiddenDataSize: record.hiddenDataSize,
    }
  }

  async getFiles(userId: string, decoyMode = false, fakeVaultId?: string | null) {
    const where: any = { userId }
    if (decoyMode) {
      where.id = fakeVaultId || "__none__"
    }
    return this.prisma.stegoFile.findMany({ where, orderBy: { createdAt: "desc" } })
  }
}
