import { Injectable, UnauthorizedException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { JwtService } from "@nestjs/jwt"
import { MailService } from "../mail/mail.service"
import { NotificationsService } from "../notifications/notifications.service"
import { sanitizeIp } from "../common/utils"
import * as argon2 from "argon2"

@Injectable()
export class PanicService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mail: MailService,
    private notifications: NotificationsService,
  ) {}

  async verifyPassword(userId: string, password: string): Promise<{ panicToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } })
    if (user?.password) {
      if (!password) throw new UnauthorizedException("Password is required")
      const valid = await argon2.verify(user.password, password)
      if (!valid) throw new UnauthorizedException("Password is incorrect")
    }
    const panicToken = this.jwtService.sign(
      { sub: userId, type: "panic_verify" },
      { expiresIn: "5m" },
    )
    return { panicToken }
  }

  private async audit(userId: string, action: string, metadata?: any, ip?: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
      await this.prisma.auditLog.create({
        data: {
          userId,
          userName: user?.name || "unknown",
          action,
          resource: "panic",
          ip: sanitizeIp(ip),
          userAgent: "panic-mode",
          metadata: metadata || undefined,
        },
      })
    } catch (err) {
      console.error("Panic audit failed:", err)
    }
  }

  private async sendAlert(userId: string, action: string, ip?: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
      const actionLabels: Record<string, string> = {
        destroy_keys: "Destroy Encryption Keys",
        logout_all: "Logout All Devices",
        revoke_tokens: "Revoke All API Tokens",
        clear_audit_attempt_blocked: "Clear Audit Logs (blocked)",
      }
      const label = actionLabels[action] || action
      await this.notifications.create(
        userId,
        "Panic Mode Triggered",
        `${label} was executed from your account${ip ? ` (IP: ${ip})` : ""}. If this was not you, contact the security team immediately.`,
        "warning",
      ).catch(() => {})
      if (!user?.email) return
      await this.mail.sendPanicAlert({ to: user.email, userName: user.name || "User", action, ip: ip || "Unknown" })
    } catch (err) {
      console.error("Panic email alert failed:", err)
    }
  }

  async contactSecurity(userId: string, message: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    await this.mail.sendSecurityReport({
      fromEmail: user?.email || "unknown",
      userName: user?.name || "Unknown user",
      message,
      ip,
    })
    await this.audit(userId, "panic.contact_security", { messageLength: message.length }, ip)
    return { message: "Your report has been sent to the security team" }
  }

  async destroyKeys(userId: string, ip?: string) {
    const result = await this.prisma.encryptionKey.updateMany({
      where: { userId },
      data: { isActive: false, rotatedAt: new Date() },
    })
    await this.audit(userId, "panic.destroy_keys", { count: result.count }, ip)
    await this.sendAlert(userId, "destroy_keys", ip)
    return { message: `All encryption keys destroyed (${result.count} keys)` }
  }

  async logoutAll(userId: string, ip?: string) {
    const [sessionResult] = await this.prisma.$transaction([
      this.prisma.session.updateMany({ where: { userId }, data: { isCurrent: false } }),
      this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
    ])
    await this.audit(userId, "panic.logout_all", { sessions: sessionResult.count }, ip)
    await this.sendAlert(userId, "logout_all", ip)
    return { message: "All sessions terminated — you have been logged out" }
  }

  async revokeTokens(userId: string, ip?: string) {
    const result = await this.prisma.apiKey.updateMany({ where: { userId }, data: { expiresAt: new Date() } })
    await this.audit(userId, "panic.revoke_tokens", { count: result.count }, ip)
    await this.sendAlert(userId, "revoke_tokens", ip)
    return { message: `All API tokens revoked (${result.count} tokens)` }
  }

  async clearAudit(userId: string, ip?: string) {
    await this.audit(userId, "panic.clear_audit_attempt", { attempted: true, blocked: true }, ip)
    await this.sendAlert(userId, "clear_audit_attempt_blocked", ip)
    return { message: "Audit log clearing is disabled to preserve evidence integrity. Contact your administrator if you need logs removed." }
  }
}
