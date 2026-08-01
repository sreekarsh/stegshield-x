import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { Prisma } from "@prisma/client"
import { AuditAction } from "./audit.constants"
import { sanitizeIp } from "../common/utils"

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    userId: string,
    userName: string,
    action: string,
    resource: string,
    ip?: string,
    userAgent?: string,
    metadata?: any,
  ) {
    const cleanIp = sanitizeIp(ip || metadata?.ip)
    return this.prisma.auditLog.create({
      data: {
        userId,
        userName,
        action,
        resource,
        ip: cleanIp,
        userAgent: userAgent || metadata?.userAgent || "Browser",
        metadata,
      },
    })
  }

  async logWithUser(
    user: { id: string; name: string } | null | undefined,
    action: string,
    resource: string,
    ip?: string,
    userAgent?: string,
    metadata?: any,
  ) {
    const clientIp = sanitizeIp(ip || metadata?.ip)
    return this.log(
      user?.id || "system",
      user?.name || "system",
      action,
      resource,
      clientIp,
      userAgent || "",
      metadata,
    )
  }

  async logSimple(userId: string, userName: string, action: AuditAction | string, resource: string, metadata?: any, ip?: string, userAgent?: string) {
    const clientIp = sanitizeIp(ip || metadata?.ip)
    return this.log(userId, userName, action, resource, clientIp, userAgent || "", metadata)
  }

  async getLogs(page = 1, limit = 50, search?: string, action?: string, from?: string, to?: string) {
    const where: Prisma.AuditLogWhereInput = {}

    const filters: Prisma.AuditLogWhereInput[] = []
    if (search) {
      filters.push({
        OR: [
          { userName: { contains: search, mode: "insensitive" as const } },
          { action: { contains: search, mode: "insensitive" as const } },
          { resource: { contains: search, mode: "insensitive" as const } },
          { ip: { contains: search, mode: "insensitive" as const } },
          { resourceId: { contains: search, mode: "insensitive" as const } },
        ],
      })
    }
    if (action) {
      filters.push({ action })
    }
    if (from || to) {
      const dateFilter: Prisma.DateTimeFilter = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to)
      filters.push({ createdAt: dateFilter })
    }
    if (filters.length > 0) {
      where.AND = filters
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
      this.prisma.auditLog.count({ where }),
    ])
    return { logs, total, page, limit }
  }

  async cleanOldLogs(retentionDays: number): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - retentionDays)
    const result = await this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })
    return result.count
  }
}
