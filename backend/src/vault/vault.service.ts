import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { existsSync, unlinkSync } from "fs"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class VaultService {
  constructor(private prisma: PrismaService) {}

  async getAll(userId: string, page = 1, limit = 100, decoyMode = false, fakeVaultId?: string | null) {
    const safePage = Math.max(1, page)
    const safeLimit = Math.max(1, Math.min(100, limit))
    const skip = (safePage - 1) * safeLimit

    if (decoyMode) {
      if (fakeVaultId) {
        const evidence = await this.prisma.evidence.findMany({ where: { userId, id: fakeVaultId }, orderBy: { createdAt: "desc" } })
        const stego = await this.prisma.stegoFile.findMany({ where: { userId, id: fakeVaultId }, orderBy: { createdAt: "desc" } })
        return { evidence, stegoFiles: stego, decoyMode: true, total: evidence.length + stego.length, page: safePage, limit: safeLimit, totalPages: 1 }
      }
      return { evidence: [], stegoFiles: [], decoyMode: true, total: 0, page: safePage, limit: safeLimit, totalPages: 0 }
    }

    const [evidence, stego, totalEvidence, totalStego] = await Promise.all([
      this.prisma.evidence.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip, take: safeLimit }),
      this.prisma.stegoFile.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip, take: safeLimit }),
      this.prisma.evidence.count({ where: { userId } }),
      this.prisma.stegoFile.count({ where: { userId } }),
    ])
    const total = totalEvidence + totalStego
    return { evidence, stegoFiles: stego, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) }
  }

  async delete(userId: string, source: string, id: string) {
    if (source === "evidence") {
      const item = await this.prisma.evidence.findUnique({ where: { id } })
      if (!item) throw new NotFoundException("Evidence not found")
      if (item.userId !== userId) throw new ForbiddenException("Access denied")
      if (existsSync(item.filePath)) unlinkSync(item.filePath)
      await this.prisma.$transaction([
        this.prisma.custodyEntry.deleteMany({ where: { evidenceId: id } }),
        this.prisma.evidenceShare.deleteMany({ where: { evidenceId: id } }),
        this.prisma.forensicsReport.updateMany({ where: { evidenceId: id }, data: { evidenceId: null } }),
        this.prisma.evidence.delete({ where: { id } }),
      ])
      return { message: "Evidence deleted" }
    }
    if (source === "stego") {
      const item = await this.prisma.stegoFile.findUnique({ where: { id } })
      if (!item) throw new NotFoundException("Stego file not found")
      if (item.userId !== userId) throw new ForbiddenException("Access denied")
      await this.prisma.stegoFile.delete({ where: { id } })
      return { message: "Stego file deleted" }
    }
    throw new BadRequestException("Invalid source type")
  }

  async rename(userId: string, source: string, id: string, name: string) {
    if (!name || !name.trim()) throw new BadRequestException("Name is required")
    if (source === "evidence") {
      const item = await this.prisma.evidence.findUnique({ where: { id } })
      if (!item) throw new NotFoundException("Evidence not found")
      if (item.userId !== userId) throw new ForbiddenException("Access denied")
      return this.prisma.evidence.update({ where: { id }, data: { name: name.trim() } })
    }
    if (source === "stego") {
      const item = await this.prisma.stegoFile.findUnique({ where: { id } })
      if (!item) throw new NotFoundException("Stego file not found")
      if (item.userId !== userId) throw new ForbiddenException("Access denied")
      return this.prisma.stegoFile.update({ where: { id }, data: { name: name.trim() } })
    }
    throw new BadRequestException("Invalid source type")
  }
}
