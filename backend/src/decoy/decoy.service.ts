import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import * as argon2 from "argon2"

@Injectable()
export class DecoyService {
  constructor(private prisma: PrismaService) {}

  async setup(userId: string, dto: { fakePassword: string; realVaultId: string; fakeVaultId?: string }) {
    if (!dto.fakePassword || dto.fakePassword.length < 6) {
      throw new BadRequestException("Password must be at least 6 characters")
    }
    if (!dto.realVaultId) {
      throw new BadRequestException("Real vault ID is required")
    }
    const vault = await this.prisma.evidence.findFirst({ where: { id: dto.realVaultId, userId } })
      || await this.prisma.stegoFile.findFirst({ where: { id: dto.realVaultId, userId } })
    if (!vault) throw new ForbiddenException("Real vault not found or does not belong to you")

    if (dto.fakeVaultId) {
      const fake = await this.prisma.evidence.findFirst({ where: { id: dto.fakeVaultId, userId } })
        || await this.prisma.stegoFile.findFirst({ where: { id: dto.fakeVaultId, userId } })
      if (!fake) throw new BadRequestException("Fake vault not found or does not belong to you")
    }

    const hashed = await argon2.hash(dto.fakePassword)
    const existing = await this.prisma.decoyVault.findUnique({ where: { userId } })
    const data = { fakePassword: hashed, realVaultId: dto.realVaultId, fakeVaultId: dto.fakeVaultId ?? null }
    if (existing) {
      return this.prisma.decoyVault.update({ where: { userId }, data })
    }
    return this.prisma.decoyVault.create({ data: { userId, ...data } })
  }

  async getStatus(userId: string) {
    const vault = await this.prisma.decoyVault.findUnique({ where: { userId } })
    return {
      configured: !!vault,
      fakePassword: vault?.fakePassword ? "••••••••" : null,
      realVaultId: vault?.realVaultId || null,
      fakeVaultId: vault?.fakeVaultId || null,
      createdAt: vault?.createdAt || null,
    }
  }

  async verify(userId: string, dto: { password: string }) {
    if (!dto.password) throw new BadRequestException("Password is required")
    const vault = await this.prisma.decoyVault.findUnique({ where: { userId } })
    if (!vault) throw new NotFoundException("No decoy vault configured")
    const match = await argon2.verify(vault.fakePassword, dto.password)
    if (!match) {
      return { valid: false, message: "Invalid password" }
    }
    return { valid: true, message: "Decoy vault unlocked", realVaultId: vault.realVaultId, fakeVaultId: vault.fakeVaultId }
  }

  async remove(userId: string) {
    const vault = await this.prisma.decoyVault.findUnique({ where: { userId } })
    if (!vault) throw new NotFoundException("No decoy vault configured")
    await this.prisma.decoyVault.delete({ where: { userId } })
    return { message: "Decoy vault removed" }
  }
}
