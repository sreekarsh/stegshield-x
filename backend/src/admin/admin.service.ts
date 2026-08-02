import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { MailService } from "../mail/mail.service"
import { Prisma } from "@prisma/client"
import * as os from "os"
import { sanitizeIp } from "../common/utils"

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function getUptime(startTime: number): string {
  const diff = Date.now() - startTime
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

const startTime = Date.now()
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000"
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@stegshield.local"

async function checkAiHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}

let lastCpuTimes: { idle: number; total: number } | null = null

function getCpuUsage(): number {
  try {
    const cpus = os.cpus()
    if (cpus.length === 0) return 0
    let idle = 0, total = 0
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type as keyof typeof cpu.times]
      }
      idle += cpu.times.idle
    }
    if (lastCpuTimes) {
      const idleDelta = idle - lastCpuTimes.idle
      const totalDelta = total - lastCpuTimes.total
      if (totalDelta > 0) {
        return Math.round((1 - idleDelta / totalDelta) * 100)
      }
    }
    lastCpuTimes = { idle, total }
    return 0
  } catch {
    return 0
  }
}

function getMemoryUsage(): number {
  const total = os.totalmem()
  const free = os.freemem()
  return Math.round(((total - free) / total) * 100)
}

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async getStats() {
    const [users, verifiedUsers, evidence, messages, keys, storageAgg, sessions, orgs, reports] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isVerified: true } }),
      this.prisma.evidence.count(),
      this.prisma.message.count(),
      this.prisma.encryptionKey.count(),
      this.prisma.evidence.aggregate({ _sum: { size: true } }),
      this.prisma.session.count({ where: { isCurrent: true } }),
      this.prisma.organization.count(),
      this.prisma.forensicsReport.count(),
    ])

    const totalBytes = storageAgg._sum.size || 0

    const [dbResult, aiCheck1, aiCheck2] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      checkAiHealth(AI_SERVICE_URL),
      checkAiHealth(AI_SERVICE_URL.replace(/:\d+$/, ":8000")),
    ])

    const dbHealthy = dbResult.status === "fulfilled"
    const aiHealthy = aiCheck1.status === "fulfilled" && aiCheck1.value ? true
      : aiCheck2.status === "fulfilled" && aiCheck2.value ? true : false
    const health = dbHealthy && aiHealthy ? "healthy" : dbHealthy ? "degraded" : "down"

    return {
      users, verifiedUsers, evidence, messages, keys,
      storageUsed: formatBytes(totalBytes),
      storageBytes: totalBytes,
      systemHealth: health,
      uptime: getUptime(startTime),
      activeSessions: sessions,
      organizations: orgs,
      forensicsReports: reports,
    }
  }

  async getAnalytics(period: string) {
    const now = new Date()
    let startDate: Date

    const validPeriods = ["24h", "7d", "30d", "90d"]
    const effectivePeriod = validPeriods.includes(period) ? period : "7d"

    switch (effectivePeriod) {
      case "24h": startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); break
      case "7d": startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
      case "30d": startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
      case "90d": startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break
      default: startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    const [newUsers, newMessages, newEvidence, newSessions, auditActions, recentLogs] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      this.prisma.message.count({ where: { createdAt: { gte: startDate } } }),
      this.prisma.evidence.count({ where: { createdAt: { gte: startDate } } }),
      this.prisma.session.count({ where: { createdAt: { gte: startDate } } }),
      this.prisma.auditLog.groupBy({
        by: ["action"],
        _count: { action: true },
        where: { createdAt: { gte: startDate } },
        orderBy: { _count: { action: "desc" } },
        take: 10,
      }),
      this.prisma.auditLog.findMany({
        select: { id: true, userName: true, action: true, resource: true, createdAt: true },
        where: { createdAt: { gte: startDate } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ])

    const activityTimeline = recentLogs.map((log) => ({
      time: log.createdAt.toISOString(),
      user: log.userName,
      action: log.action,
      resource: log.resource,
    }))

    return {
      period: effectivePeriod,
      newUsers, newMessages, newEvidence, newSessions,
      topActions: auditActions.map((a) => ({ action: a.action, count: a._count })),
      activityTimeline,
    }
  }

  async getAuditLogs(page: number = 1, limit: number = 20, search?: string, action?: string) {
    const where: Prisma.AuditLogWhereInput = {}
    if (search) {
      where.OR = [
        { userName: { contains: search, mode: "insensitive" as const } },
        { resource: { contains: search, mode: "insensitive" as const } },
        { ip: { contains: search, mode: "insensitive" as const } },
      ]
    }
    if (action) where.action = action

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return { logs, total, page, limit }
  }

  async getSessions(page: number = 1, limit: number = 20) {
    const [sessions, total] = await Promise.all([
      this.prisma.session.findMany({
        orderBy: { lastActive: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.session.count(),
    ])

    return { sessions, total, page, limit }
  }

  async getUsers(page: number = 1, limit: number = 10, search?: string) {
    const where: Prisma.UserWhereInput = search
      ? { OR: [{ email: { contains: search, mode: "insensitive" as const } }, { name: { contains: search, mode: "insensitive" as const } }] }
      : {}
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, role: true, isVerified: true,
          isMFAEnabled: true, createdAt: true, updatedAt: true,
          _count: { select: { sessions: true, evidence: true, auditLogs: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ])
    return { users, total }
  }

  async updateUser(id: string, dto: Record<string, unknown>) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException("User not found")

    if (user.email && user.email.toLowerCase() === "sreekarsh44@gmail.com") {
      if (dto.role && dto.role !== "OWNER") {
        throw new BadRequestException("Master OWNER account (sreekarsh44@gmail.com) cannot be demoted.")
      }
    }

    const allowedFields = ["role", "isVerified"]
    const updateData: Record<string, unknown> = {}
    for (const key of Object.keys(dto)) {
      if (allowedFields.includes(key)) updateData[key] = dto[key]
    }
    if (Object.keys(updateData).length === 0) throw new BadRequestException("No valid fields to update")

    return this.prisma.user.update({
      where: { id },
      data: updateData as any,
      select: { id: true, email: true, name: true, role: true, isVerified: true, createdAt: true },
    })
  }

  async deleteUser(id: string, requestingUserId: string) {
    if (id === requestingUserId) {
      throw new BadRequestException("You cannot delete your own account")
    }
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException("User not found")
    if (user.email && user.email.toLowerCase() === "sreekarsh44@gmail.com") {
      throw new BadRequestException("Master Head account (sreekarsh44@gmail.com) cannot be deleted.")
    }
    await this.prisma.$transaction([
      this.prisma.evidenceShare.deleteMany({ where: { OR: [{ sharedById: id }, { sharedWithId: id }] } }),
      this.prisma.custodyEntry.deleteMany({ where: { userId: id } }),
      this.prisma.forensicsReport.deleteMany({ where: { userId: id } }),
      this.prisma.evidence.deleteMany({ where: { userId: id } }),
      this.prisma.case.deleteMany({ where: { userId: id } }),
      this.prisma.organizationUser.deleteMany({ where: { userId: id } }),
      this.prisma.stegoFile.deleteMany({ where: { userId: id } }),
      this.prisma.sharedLink.deleteMany({ where: { userId: id } }),
      this.prisma.watermark.deleteMany({ where: { userId: id } }),
      this.prisma.timeCapsule.deleteMany({ where: { userId: id } }),
      this.prisma.decoyVault.deleteMany({ where: { userId: id } }),
      this.prisma.secretLanguage.deleteMany({ where: { userId: id } }),
      this.prisma.trustScore.deleteMany({ where: { userId: id } }),
      this.prisma.report.deleteMany({ where: { userId: id } }),
      this.prisma.tamperReport.deleteMany({ where: { userId: id } }),
      this.prisma.session.deleteMany({ where: { userId: id } }),
      this.prisma.notification.deleteMany({ where: { userId: id } }),
      this.prisma.auditLog.deleteMany({ where: { userId: id } }),
      this.prisma.encryptionKey.deleteMany({ where: { userId: id } }),
      this.prisma.apiKey.deleteMany({ where: { userId: id } }),
      this.prisma.contact.deleteMany({ where: { OR: [{ ownerId: id }, { contactId: id }] } }),
      this.prisma.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } }),
      this.prisma.user.delete({ where: { id } }),
    ])
    return { message: "User deleted" }
  }

  async getMonitoring() {
    const [dbResult] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
    ])
    const dbHealthy = dbResult.status === "fulfilled"

    let aiHealthy = await checkAiHealth(AI_SERVICE_URL)
    if (!aiHealthy) {
      aiHealthy = await checkAiHealth(AI_SERVICE_URL.replace(/:\d+$/, ":8000"))
    }

    const cpus = os.cpus()
    const cpuCores = cpus.length
    const cpuUsage = getCpuUsage()
    const memUsage = getMemoryUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    const storageAgg = await this.prisma.evidence.aggregate({ _sum: { size: true } })
    const totalStorageBytes = storageAgg._sum.size || 0

    const processMem = process.memoryUsage()

    return {
      cpu: cpuUsage,
      cpuCores,
      memory: memUsage,
      memoryUsed: formatBytes(usedMem),
      memoryTotal: formatBytes(totalMem),
      processMemoryUsed: formatBytes(processMem.heapUsed),
      processMemoryTotal: formatBytes(processMem.heapTotal),
      storage: totalStorageBytes > 0 ? Math.round((totalStorageBytes / (100 * 1024 * 1024 * 1024)) * 100) : 0,
      storageUsed: formatBytes(totalStorageBytes),
      storageTotal: "100 GB",
      activeConnections: await this.prisma.session.count({ where: { isCurrent: true } }),
      uptime: getUptime(startTime),
      dbHealthy,
      aiHealthy,
      platform: os.platform(),
      hostname: os.hostname(),
    }
  }

  async broadcastNotification(
    dto: { title: string; message: string; type?: string },
    adminUserId: string,
    ip?: string,
  ) {
    const { title, message, type = "info" } = dto
    if (!title || !message) throw new BadRequestException("Title and message are required")

    const users = await this.prisma.user.findMany({ select: { id: true, email: true } })

    await this.prisma.notification.createMany({
      data: users.map((u) => ({
        userId: u.id,
        title,
        message,
        type,
      })),
    })

    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        userName: "Admin",
        action: "BROADCAST_NOTIFICATION",
        resource: "Notification",
        ip: sanitizeIp(ip),
        userAgent: "Admin Panel",
        metadata: { title, type, recipientCount: users.length },
      },
    })

    return { message: `Notification sent to ${users.length} users` }
  }

  async getSystemConfig() {
    return {
      adminEmail: ADMIN_EMAIL,
      appUrl: process.env.APP_URL || "http://localhost:3000",
      aiServiceUrl: AI_SERVICE_URL,
      registrationEnabled: true,
      mfaRequired: false,
      maxUploadSize: "10MB",
      sessionTimeout: "7d",
      maintenanceMode: false,
      allowOAuth: true,
    }
  }

  async updateSystemConfig(dto: Record<string, unknown>) {
    const allowedKeys = ["maintenanceMode", "registrationEnabled", "mfaRequired", "maxUploadSize", "sessionTimeout", "allowOAuth"]
    const attemptedKeys = Object.keys(dto).filter(k => allowedKeys.includes(k))
    if (!attemptedKeys.length) throw new BadRequestException("No valid configuration keys provided")
    return { message: "System configuration updated", updatedKeys: attemptedKeys }
  }

  async revokeSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } })
    if (!session) throw new NotFoundException("Session not found")
    await this.prisma.session.delete({ where: { id: sessionId } })
    return { message: "Session revoked successfully" }
  }
}
