import { Injectable, UnauthorizedException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { JwtService } from "@nestjs/jwt"
import { MailService } from "../mail/mail.service"
import * as argon2 from "argon2"

@Injectable()
export class PanicService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mail: MailService,
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
          ip: ip || "0.0.0.0",
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
      if (!user?.email) return
      await this.mail.sendPanicAlert({ to: user.email, userName: user.name || "User", action, ip: ip || "Unknown" })
    } catch (err) {
      console.error("Panic email alert failed:", err)
    }
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
