import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto"
import { PrismaService } from "../prisma/prisma.service"

const ENC_IV_LENGTH = 12
const ENC_TAG_LENGTH = 16

@Injectable()
export class TimeCapsuleService {
  constructor(private prisma: PrismaService) {}

  private getSecretKey(): string {
    if (!process.env.SECRET_KEY) {
      throw new Error("SECRET_KEY environment variable is not set")
    }
    return process.env.SECRET_KEY
  }

  private deriveKey(salt: string): Buffer {
    return createHmac("sha256", this.getSecretKey())
      .update(salt)
      .digest()
  }

  private encryptAtRest(plaintext: string, salt: string): string {
    const key = this.deriveKey(salt)
    const iv = randomBytes(ENC_IV_LENGTH)
    const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: ENC_TAG_LENGTH })
    const input = Buffer.from(plaintext, "utf-8")
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()])
    const authTag = cipher.getAuthTag()
    return Buffer.concat([iv, authTag, encrypted]).toString("base64")
  }

  private decryptAtRest(data: string, salt: string): string {
    const key = this.deriveKey(salt)
    const buf = Buffer.from(data, "base64")
    const iv = buf.subarray(0, ENC_IV_LENGTH)
    const authTag = buf.subarray(ENC_IV_LENGTH, ENC_IV_LENGTH + ENC_TAG_LENGTH)
    const ciphertext = buf.subarray(ENC_IV_LENGTH + ENC_TAG_LENGTH)
    const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: ENC_TAG_LENGTH })
    decipher.setAuthTag(authTag)
    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8")
    } catch {
      throw new Error("Decryption authentication failed")
    }
  }

  async create(userId: string, dto: { title: string; encryptedData: string; unlockDate: string; useClientEncryption?: boolean }) {
    if (!dto.title?.trim()) throw new BadRequestException("Title is required")
    if (!dto.encryptedData) throw new BadRequestException("Secret data is required")
    const unlock = new Date(dto.unlockDate)
    if (isNaN(unlock.getTime())) throw new BadRequestException("Invalid unlock date")
    if (unlock <= new Date()) throw new BadRequestException("Unlock date must be in the future")

    if (dto.useClientEncryption) {
      return this.prisma.timeCapsule.create({
        data: {
          userId,
          title: dto.title.trim(),
          encryptedData: dto.encryptedData,
          unlockDate: unlock,
        },
        select: { id: true, title: true, unlockDate: true, isOpened: true, createdAt: true },
      })
    }

    const salt = `capsule-${userId}-${Date.now()}`
    const encryptedAtRest = this.encryptAtRest(dto.encryptedData, salt)
    return this.prisma.timeCapsule.create({
      data: {
        userId,
        title: dto.title.trim(),
        encryptedData: encryptedAtRest,
        salt,
        unlockDate: unlock,
      },
      select: { id: true, title: true, unlockDate: true, isOpened: true, createdAt: true },
    })
  }

  async getAll(userId: string, skip = 0, take = 50) {
    const [capsules, total] = await Promise.all([
      this.prisma.timeCapsule.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: { id: true, title: true, unlockDate: true, isOpened: true, createdAt: true, openedAt: true },
      }),
      this.prisma.timeCapsule.count({ where: { userId } }),
    ])
    return { capsules, total, skip, take }
  }

  async open(id: string, userId: string) {
    const capsule = await this.prisma.timeCapsule.findUnique({ where: { id } })
    if (!capsule) throw new NotFoundException("Capsule not found")
    if (capsule.userId !== userId) throw new ForbiddenException("Access denied")
    if (new Date() < capsule.unlockDate) {
      throw new ForbiddenException("Capsule is still sealed until " + capsule.unlockDate.toISOString())
    }

    if (capsule.salt) {
      await this.prisma.timeCapsule.update({
        where: { id },
        data: { isOpened: true, openedAt: new Date() },
      })
      const decrypted = this.decryptAtRest(capsule.encryptedData, capsule.salt)
      return {
        id: capsule.id,
        title: capsule.title,
        encryptedData: decrypted,
        unlockDate: capsule.unlockDate,
        isOpened: true,
        createdAt: capsule.createdAt,
        openedAt: new Date(),
      }
    }

    await this.prisma.timeCapsule.update({
      where: { id },
      data: { isOpened: true, openedAt: new Date() },
    })
    return {
      id: capsule.id,
      title: capsule.title,
      encryptedData: capsule.encryptedData,
      unlockDate: capsule.unlockDate,
      isOpened: true,
      createdAt: capsule.createdAt,
      openedAt: new Date(),
    }
  }

  async delete(id: string, userId: string) {
    const capsule = await this.prisma.timeCapsule.findUnique({ where: { id } })
    if (!capsule) throw new NotFoundException("Capsule not found")
    if (capsule.userId !== userId) throw new ForbiddenException("Access denied")
    await this.prisma.timeCapsule.delete({ where: { id } })
    return { message: "Capsule deleted" }
  }
}
