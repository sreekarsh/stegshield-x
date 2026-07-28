import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import * as crypto from "crypto"
import * as argon2 from "argon2"

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: { name: string; permissions: string[]; expiresAt?: string }) {
    if (!dto.name?.trim()) throw new BadRequestException("Key name is required")
    const rawKey = "sk_" + crypto.randomBytes(32).toString("hex")
    const keyHash = await argon2.hash(rawKey)
    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name.trim(),
        key: keyHash,
        permissions: dto.permissions || [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    })
    return { id: created.id, name: created.name, key: rawKey, permissions: created.permissions, expiresAt: created.expiresAt, createdAt: created.createdAt }
  }

  async getAll(userId: string, skip = 0, take = 50) {
    const [keys, total] = await Promise.all([
      this.prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.apiKey.count({ where: { userId } }),
    ])
    return {
      keys: keys.map(k => ({
        id: k.id, name: k.name, key: "sk_****",
        permissions: k.permissions, isActive: k.isActive,
        lastUsed: k.lastUsed, expiresAt: k.expiresAt,
        createdAt: k.createdAt, updatedAt: k.updatedAt,
      })),
      total, skip, take,
    }
  }

  async update(id: string, userId: string, dto: { name?: string; permissions?: string[]; isActive?: boolean }) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } })
    if (!key) throw new NotFoundException("API key not found")
    if (key.userId !== userId) throw new ForbiddenException("You do not own this API key")
    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.permissions !== undefined ? { permissions: dto.permissions } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    })
    return {
      id: updated.id, name: updated.name, key: "sk_****",
      permissions: updated.permissions, isActive: updated.isActive,
      lastUsed: updated.lastUsed, expiresAt: updated.expiresAt,
      createdAt: updated.createdAt, updatedAt: updated.updatedAt,
    }
  }

  async revoke(id: string, userId: string) {
    return this.update(id, userId, { isActive: false })
  }

  async reactivate(id: string, userId: string) {
    return this.update(id, userId, { isActive: true })
  }

  async delete(id: string, userId: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id } })
    if (!key) throw new NotFoundException("API key not found")
    if (key.userId !== userId) throw new ForbiddenException("You do not own this API key")
    await this.prisma.apiKey.delete({ where: { id } })
    return { message: "API key deleted" }
  }

  async validate(rawKey: string): Promise<{ userId: string; keyId: string; permissions: string[] } | null> {
    const candidates = await this.prisma.apiKey.findMany({
      where: {
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })
    for (const stored of candidates) {
      const match = await argon2.verify(stored.key, rawKey)
      if (match) {
        await this.prisma.apiKey.update({ where: { id: stored.id }, data: { lastUsed: new Date() } })
        return { userId: stored.userId, keyId: stored.id, permissions: stored.permissions }
      }
    }
    return null
  }

  async updateLastUsed(keyId: string) {
    await this.prisma.apiKey.update({ where: { id: keyId }, data: { lastUsed: new Date() } })
  }
}
