import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { AuditService } from "../audit/audit.service"
import { MailService } from "../mail/mail.service"
import { AuditActions } from "../audit/audit.constants"
import { UpdateUserDto } from "./dto/update-user.dto"
import * as argon2 from "argon2"

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private mail: MailService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { lastActive: "desc" },
          take: 1,
          select: { lastActive: true, ip: true, device: true, browser: true },
        },
      },
    })
    if (!user) throw new NotFoundException("User not found")
    const { password, mfaSecret, sessions, ...rest } = user
    const lastSession = sessions?.[0] || null
    return {
      ...rest,
      lastLogin: lastSession?.lastActive || null,
      lastLoginDevice: lastSession?.device || null,
      lastLoginBrowser: lastSession?.browser || null,
    }
  }

  async update(id: string, dto: UpdateUserDto & { currentPassword?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException("User not found")

    if (dto.email && dto.email !== user.email) {
      if (!dto.currentPassword) {
        throw new BadRequestException("Current password required to change email")
      }
      if (!user.password) {
        throw new BadRequestException("Cannot change email on OAuth-only accounts")
      }
      const valid = await argon2.verify(user.password, dto.currentPassword)
      if (!valid) {
        throw new UnauthorizedException("Current password is incorrect")
      }

      const oldEmail = user.email
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: { email: dto.email, isVerified: false },
      })

      await this.audit.logSimple(user.id, user.name, AuditActions.USER_EMAIL_CHANGED, "user", { oldEmail, newEmail: dto.email })

      this.mail.sendEmailChangedNotification(oldEmail, user.name, dto.email)

      const { password, mfaSecret, ...rest } = updatedUser
      return rest
    }

    const { currentPassword, ...updateData } = dto
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
    })
    const { password, mfaSecret, ...rest } = updatedUser
    return rest
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException("User not found")

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId.slice(0, 8)}@stegshield.local`,
        name: "Deleted User",
        password: null,
        avatar: null,
        phone: null,
        location: null,
        jobTitle: null,
        department: null,
        bio: null,
        socialLinks: Prisma.DbNull,
        googleId: null,
        githubId: null,
        isVerified: false,
        isMFAEnabled: false,
        mfaSecret: null,
        settings: Prisma.DbNull,
        tokenVersion: { increment: 1 },
      },
    })

    await this.audit.logSimple(user.id, user.name, AuditActions.USER_DELETED, "user", { userId })

    return { message: "Account deleted" }
  }

  async exportData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizations: { include: { organization: true } },
        stegoFiles: true,
        evidence: true,
        cases: true,
        keys: true,
        sessions: true,
        auditLogs: { take: 100, orderBy: { createdAt: "desc" } },
        notifications: { take: 100, orderBy: { createdAt: "desc" } },
        apiKeys: true,
        trustScores: true,
      },
    })
    if (!user) throw new UnauthorizedException("User not found")

    const { password, mfaSecret, ...safeUser } = user
    return { exportedAt: new Date().toISOString(), user: safeUser }
  }

  async updateSettings(userId: string, settings: Record<string, any>) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException("User not found")

    const existingSettings = (user.settings as Record<string, any>) || {}
    const merged = { ...existingSettings, ...settings }

    await this.prisma.user.update({
      where: { id: userId },
      data: { settings: merged },
    })

    await this.audit.logSimple(user.id, user.name, AuditActions.USER_SETTINGS_UPDATED, "user", { keys: Object.keys(settings) })

    return { settings: merged }
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        select: { id: true, email: true, name: true, role: true, isVerified: true, createdAt: true },
      }),
      this.prisma.user.count(),
    ])
    return { users, total, page, limit }
  }

  async search(q: string, excludeUserId: string) {
    if (!q || q.length < 1) return { users: [] }

    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: excludeUserId } },
          {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: { id: true, email: true, name: true, avatar: true, role: true },
      take: 20,
    })

    return { users }
  }
}
