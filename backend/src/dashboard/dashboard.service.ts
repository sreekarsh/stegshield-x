import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import * as os from "os"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

const startTime = Date.now()

function getUptime(): string {
  const diff = Date.now() - startTime
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(userId: string) {
    const [userEvidence, userEvidenceSize, userMessages, userKeys, userCases, userReports, userSessions, allUsers] = await Promise.all([
      this.prisma.evidence.count({ where: { userId } }),
      this.prisma.evidence.aggregate({ where: { userId }, _sum: { size: true } }),
      this.prisma.message.count({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
      this.prisma.encryptionKey.count({ where: { userId } }),
      this.prisma.case.count({ where: { userId } }),
      this.prisma.forensicsReport.count({ where: { userId } }),
      this.prisma.session.count({ where: { userId, isCurrent: true } }),
      this.prisma.user.count(),
    ])

    const userBytes = userEvidenceSize._sum.size || 0

    const dbHealthy = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false)
    const health = dbHealthy ? "healthy" : "down"

    return {
      users: allUsers,
      evidence: userEvidence,
      messages: userMessages,
      keys: userKeys,
      cases: userCases,
      reports: userReports,
      storageUsed: formatBytes(userBytes),
      storageBytes: userBytes,
      systemHealth: health,
      uptime: getUptime(),
      activeSessions: userSessions,
    }
  }
}
