import { Injectable, UnauthorizedException, ConflictException, InternalServerErrorException, BadRequestException, NotFoundException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { AuditService } from "../audit/audit.service"
import { AuditActions } from "../audit/audit.constants"
import { MailService } from "../mail/mail.service"
import * as argon2 from "argon2"
import * as crypto from "crypto"
import { v4 as uuid } from "uuid"
import { sanitizeIp } from "../common/utils"

const ADMIN_EMAILS = process.env.ADMIN_EMAIL
  ? process.env.ADMIN_EMAIL.split(",").map(e => e.trim().toLowerCase())
  : []

const MFA_KEY: string = process.env.SECRET_KEY || process.env.JWT_SECRET || "stegshield_default_secret_key_mfa_encryption_32bytes"
const REFRESH_SECRET: string = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || "stegshield_default_refresh_token_secret_32bytes"
const RESET_SECRET: string = process.env.RESET_TOKEN_SECRET || process.env.JWT_SECRET || "stegshield_default_reset_token_secret_32bytes"
const MFA_CHALLENGE_SECRET: string = process.env.MFA_CHALLENGE_SECRET || process.env.JWT_SECRET || "stegshield_mfa_challenge_secret_key_32bytes_long"

const PASSWORD_MIN_LENGTH = 8

function validatePassword(password: string): void {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    throw new BadRequestException(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  }
  if (password.length > 128) {
    throw new BadRequestException("Password must not exceed 128 characters")
  }
}

function generateBase32Secret(length: number = 20): string {
  const bytes = crypto.randomBytes(length)
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let bits = 0
  let val = 0
  let result = ""
  for (let i = 0; i < bytes.length; i++) {
    val = (val << 8) | bytes[i]
    bits += 8
    while (bits >= 5) {
      result += alphabet[(val >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    result += alphabet[(val << (5 - bits)) & 31]
  }
  return result
}

function encryptMFASecret(plaintext: string): string {
  const key = crypto.createHash("sha256").update(MFA_KEY).digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString("base64")
}

function decryptMFASecret(encoded: string): string {
  const key = crypto.createHash("sha256").update(MFA_KEY).digest()
  const buf = Buffer.from(encoded, "base64")
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc) + decipher.final("utf8")
}

@Injectable()
export class AuthService {
  private resetJwtService: JwtService

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private audit: AuditService,
    private mail: MailService,
  ) {
    this.resetJwtService = new JwtService({
      secret: RESET_SECRET,
      signOptions: { expiresIn: "1h" },
    })
  }

  async register(dto: { email: string; password: string; name: string }, ip?: string) {
    validatePassword(dto.password)
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException("Email already in use")

    const hashedPassword = await argon2.hash(dto.password)
    const userCount = await this.prisma.user.count()
    const isMasterHead = dto.email.toLowerCase() === "sreekarsh44@gmail.com"
    const isAdminEmail = ADMIN_EMAILS.includes(dto.email.toLowerCase())
    const defaultRole = isMasterHead ? "OWNER" : (isAdminEmail || userCount === 0) ? "ADMIN" : "INVESTIGATOR"
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: defaultRole as any,
        isVerified: isMasterHead || isAdminEmail ? true : undefined,
      },
    })

    await this.prisma.organization.create({
      data: {
        name: `${dto.name}'s Team`,
        slug: "team-" + user.id.slice(0, 8),
        members: { create: { userId: user.id, role: isMasterHead ? "ADMIN" : "ADMIN" } },
      },
    })

    const tokens = await this.generateTokens(user.id, user.email)
    await this.createSession(user.id, "New registration", { ip })

    await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_REGISTER, "user", { email: user.email, ip })

    return { user: this.sanitizeUser(user), ...tokens }
  }

  async login(dto: { email: string; password: string }, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (!user) throw new UnauthorizedException("Invalid credentials")
    if (!user.password) throw new UnauthorizedException("Account uses OAuth login")

    const valid = await argon2.verify(user.password, dto.password)
    let isDecoyLogin = false
    let decoyInfo: { fakeVaultId: string | null; realVaultId: string } | null = null

    if (!valid) {
      const decoy = await this.prisma.decoyVault.findUnique({ where: { userId: user.id } })
      if (decoy && (await argon2.verify(decoy.fakePassword, dto.password))) {
        isDecoyLogin = true
        decoyInfo = { fakeVaultId: decoy.fakeVaultId, realVaultId: decoy.realVaultId }
      } else {
        throw new UnauthorizedException("Invalid credentials")
      }
    }

    let promoted = false
    const isMasterHead = user.email.toLowerCase() === "sreekarsh44@gmail.com"
    if (isMasterHead && user.role !== "OWNER") {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: "OWNER", isVerified: true },
      })
      user.role = "OWNER"
      promoted = true
    } else if (user.role !== "ADMIN" && user.role !== "OWNER") {
      const adminCount = await this.prisma.user.count({ where: { role: { in: ["ADMIN", "OWNER"] } } })
      const isAdminEmail = ADMIN_EMAILS.includes(user.email.toLowerCase())
      if (isAdminEmail || adminCount === 0) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN", isVerified: isAdminEmail ? true : undefined },
        })
        user.role = "ADMIN"
        promoted = true
      }
    }

    if (user.isMFAEnabled) {
      const challengeToken = this.jwtService.sign(
        { sub: user.id, email: user.email, purpose: "mfa-challenge" },
        { secret: MFA_CHALLENGE_SECRET, expiresIn: "5m" },
      )
      await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_MFA_CHALLENGE, "user", { email: user.email, ip })
      return { mfaRequired: true, mfaToken: challengeToken }
    }

    const tokens = await this.generateTokens(user.id, user.email, isDecoyLogin ? { decoyMode: true, fakeVaultId: decoyInfo?.fakeVaultId, realVaultId: decoyInfo?.realVaultId } : undefined)
    await this.createSession(user.id, "Login", { ip })

    await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_LOGIN, "user", { email: user.email, promoted, ip })

    const sanitized = this.sanitizeUser(user)
    return { user: sanitized, ...tokens }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    validatePassword(newPassword)
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException("User not found")
    if (!user.password) throw new UnauthorizedException("Account uses OAuth login")

    const valid = await argon2.verify(user.password, currentPassword)
    if (!valid) throw new UnauthorizedException("Current password is incorrect")

    const hashedPassword = await argon2.hash(newPassword)
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, tokenVersion: { increment: 1 } },
    })

    await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_PASSWORD_CHANGE, "user")

    return { message: "Password updated successfully — please log in again" }
  }

  async validateOAuthUser(provider: "google" | "github", profile: any) {
    const providerId = provider === "google" ? "googleId" : "githubId"
    const profileId = profile.id

    let user = await this.prisma.user.findFirst({
      where: { [providerId]: profileId },
    })
    if (user) {
      await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_OAUTH_LOGIN, "user", { provider })
      return this.sanitizeUser(user)
    }

    const email = profile.emails?.[0]?.value
    if (email) {
      user = await this.prisma.user.findUnique({ where: { email } })
      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { [providerId]: profileId, avatar: profile.photos?.[0]?.value || user.avatar },
        })
        await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_OAUTH_LOGIN, "user", { provider, linked: true })
        return this.sanitizeUser(user)
      }
    }

    const isAdminEmail = email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false
    user = await this.prisma.user.create({
      data: {
        email: email || `${profileId}@${provider}.local`,
        password: null,
        name: profile.displayName || profile.username || `${provider}_user`,
        [providerId]: profileId,
        avatar: profile.photos?.[0]?.value || null,
        isVerified: true,
        role: isAdminEmail ? "ADMIN" : undefined,
      },
    })

    await this.prisma.organization.create({
      data: {
        name: `${user.name}'s Team`,
        slug: "team-" + user.id.slice(0, 8),
        members: { create: { userId: user.id, role: "ADMIN" } },
      },
    })

    await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_REGISTER, "user", { provider, email: user.email })

    return this.sanitizeUser(user)
  }

  async refresh(refreshToken: string, ip?: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: REFRESH_SECRET,
      })

      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user) throw new UnauthorizedException("Invalid token")

      await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_TOKEN_REFRESH, "user", { ip }, ip)

      const tokens = await this.generateTokens(user.id, user.email)
      return { user: this.sanitizeUser(user), ...tokens }
    } catch {
      throw new UnauthorizedException("Invalid refresh token")
    }
  }

  async logout(userId: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
    await this.prisma.session.updateMany({
      where: { userId, isCurrent: true },
      data: { isCurrent: false },
    })
    if (user) {
      await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_LOGOUT, "user", { ip }, ip)
    }
    return { message: "Logged out successfully" }
  }

  async setupMFA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } })
    const secret = generateBase32Secret(20)
    const encrypted = encryptMFASecret(secret)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: encrypted },
    })
    if (user) {
      await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_MFA_SETUP, "user")
    }
    const label = encodeURIComponent(user?.email || userId)
    const issuer = encodeURIComponent("StegShield X")
    return {
      secret,
      otpauth_url: `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
    }
  }

  async verifyMFA(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user?.mfaSecret) throw new UnauthorizedException("MFA not set up")

    const normalized = String(token || "").trim()
    if (!/^\d{6}$/.test(normalized)) return { verified: false }

    let decryptedSecret: string
    try {
      decryptedSecret = decryptMFASecret(user.mfaSecret)
    } catch {
      throw new UnauthorizedException("MFA configuration error — contact an administrator")
    }

    const { totp } = await import("speakeasy")
    const verified = totp.verify({
      secret: decryptedSecret,
      encoding: "base32",
      token: normalized,
      window: 1,
    })

    if (verified) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isMFAEnabled: true },
      })
    }

    await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_MFA_VERIFY, "user", { verified })

    return { verified }
  }

  async createMfaChallenge(userId: string, email: string): Promise<string> {
    return this.jwtService.sign(
      { sub: userId, email, purpose: "mfa-challenge" },
      { secret: MFA_CHALLENGE_SECRET, expiresIn: "5m" },
    )
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } })
  }

  async verifyMfaChallenge(mfaToken: string): Promise<{ sub: string; email: string; purpose: string }> {
    try {
      const payload = this.jwtService.verify(mfaToken, { secret: MFA_CHALLENGE_SECRET }) as { sub: string; email: string; purpose: string }
      if (payload.purpose !== "mfa-challenge") {
        throw new UnauthorizedException("Invalid MFA challenge token")
      }
      return payload
    } catch {
      throw new UnauthorizedException("MFA challenge expired or invalid — please log in again")
    }
  }

  async mfaLogin(mfaToken: string, token: string) {
    let payload: { sub: string; email: string; purpose: string }
    try {
      payload = this.jwtService.verify(mfaToken, { secret: MFA_CHALLENGE_SECRET }) as { sub: string; email: string; purpose: string }
    } catch {
      throw new UnauthorizedException("MFA challenge expired or invalid — please log in again")
    }
    if (payload.purpose !== "mfa-challenge") {
      throw new UnauthorizedException("Invalid MFA challenge token")
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user?.mfaSecret) throw new UnauthorizedException("MFA not set up")
    if (!user.isMFAEnabled) throw new UnauthorizedException("MFA is not enabled for this account")

    const normalized = String(token || "").trim()
    if (!/^\d{6}$/.test(normalized)) throw new BadRequestException("Invalid MFA code format")

    let decryptedSecret: string
    try {
      decryptedSecret = decryptMFASecret(user.mfaSecret)
    } catch {
      throw new UnauthorizedException("MFA configuration error — contact an administrator")
    }

    const { totp } = await import("speakeasy")
    const verified = totp.verify({
      secret: decryptedSecret,
      encoding: "base32",
      token: normalized,
      window: 1,
    })

    if (!verified) {
      await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_MFA_VERIFY, "user", { verified: false })
      throw new UnauthorizedException("Invalid MFA code")
    }

    const tokens = await this.generateTokens(user.id, user.email)
    await this.createSession(user.id, "Login (MFA)", undefined)

    await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_LOGIN, "user", { email: user.email, mfa: true })

    const sanitized = this.sanitizeUser(user)
    return { user: sanitized, ...tokens }
  }

  async disableMFA(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user?.password) throw new BadRequestException("OAuth accounts cannot disable MFA from here")
    const valid = await argon2.verify(user.password, password)
    if (!valid) throw new UnauthorizedException("Password is incorrect")

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: null, isMFAEnabled: false },
    })

    await this.audit.logSimple(userId, user.name, AuditActions.AUTH_MFA_DISABLE, "user")

    return { message: "MFA disabled successfully" }
  }

  async completeMfaChallenge(userId: string, email: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user?.mfaSecret) throw new UnauthorizedException("MFA not set up")
    if (!user.isMFAEnabled) throw new UnauthorizedException("MFA is not enabled for this account")

    const normalized = String(token || "").trim()
    if (!/^\d{6}$/.test(normalized)) throw new BadRequestException("Invalid MFA code format")

    let decryptedSecret: string
    try {
      decryptedSecret = decryptMFASecret(user.mfaSecret)
    } catch {
      throw new UnauthorizedException("MFA configuration error — contact an administrator")
    }

    const { totp } = await import("speakeasy")
    const verified = totp.verify({
      secret: decryptedSecret,
      encoding: "base32",
      token: normalized,
      window: 1,
    })

    if (!verified) {
      await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_MFA_VERIFY, "user", { verified: false })
      throw new UnauthorizedException("Invalid MFA code")
    }

    const tokens = await this.generateTokens(user.id, user.email)
    await this.createSession(user.id, "OAuth Login (MFA)", undefined)
    await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_LOGIN, "user", { email, mfa: true, oauth: true })

    const sanitized = this.sanitizeUser(user)
    return { user: sanitized, ...tokens }
  }

  async disconnectProvider(userId: string, provider: string) {
    const providerLower = provider.toLowerCase()
    const field = providerLower === "google" ? "googleId" : providerLower === "github" ? "githubId" : null
    if (!field) throw new BadRequestException("Unsupported provider")

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException("User not found")

    await this.prisma.user.update({
      where: { id: userId },
      data: { [field]: null },
    })

    await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_OAUTH_DISCONNECT, "user", { provider })

    return { message: `${provider} disconnected` }
  }

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastActive: "desc" },
    })
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    })
    if (!session) throw new NotFoundException("Session not found")
    await this.prisma.session.delete({ where: { id: sessionId } })
    await this.audit.logSimple(userId, "User", AuditActions.AUTH_LOGOUT, "session", { sessionId })
    return { message: "Session revoked" }
  }

  async revokeAllOtherSessions(userId: string) {
    await this.prisma.session.deleteMany({
      where: { userId },
    })
    await this.audit.logSimple(userId, "User", AuditActions.AUTH_LOGOUT, "session", { all: true })
    return { message: "All sessions revoked" }
  }

  async generateTokens(userId: string, email: string, decoyOptions?: { decoyMode?: boolean; fakeVaultId?: string | null; realVaultId?: string | null }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    })
    const payload = {
      sub: userId,
      email,
      tokenVersion: user?.tokenVersion ?? 0,
      ...(decoyOptions?.decoyMode ? {
        decoyMode: true,
        fakeVaultId: decoyOptions.fakeVaultId,
        realVaultId: decoyOptions.realVaultId,
      } : {}),
    }

    const accessToken = this.jwtService.sign(payload)
    const refreshToken = this.jwtService.sign(payload, {
      secret: REFRESH_SECRET,
      expiresIn: "7d",
    })

    return { accessToken, refreshToken }
  }

  async createSession(userId: string, action: string, metadata?: { device?: string; browser?: string; ip?: string }) {
    await this.prisma.session.create({
      data: {
        userId,
        device: metadata?.device || "Unknown",
        browser: metadata?.browser || "Unknown",
        ip: sanitizeIp(metadata?.ip),
        isCurrent: true,
      },
    })
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    
    if (user) {
      const resetToken = this.resetJwtService.sign({
        sub: user.id,
        email: user.email,
        version: user.resetTokenVersion,
      })
      const appUrl = process.env.APP_URL || "http://localhost:3000"

      await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_PASSWORD_FORGOT, "user", { email })

      await this.mail.sendPasswordReset(email, resetToken, appUrl)
    } else {
      await this.mail.sendPasswordResetUnknown(email)
    }

    return {
      message: "If an account with that email exists, a password reset link has been sent to your email",
    }
  }

  async resetPassword(email: string, token: string, newPassword: string): Promise<{ message: string }> {
    validatePassword(newPassword)

    let payload: { sub: string; email: string; version: number }
    try {
      payload = this.resetJwtService.verify(token) as { sub: string; email: string; version: number }
      if (payload.email !== email) throw new Error("Email mismatch")
    } catch {
      throw new BadRequestException("Invalid or expired reset token")
    }

    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) throw new BadRequestException("User not found")

    if (payload.version !== user.resetTokenVersion) {
      throw new BadRequestException("This reset link has already been used")
    }

    const hashedPassword = await argon2.hash(newPassword)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
        resetTokenVersion: { increment: 1 },
      },
    })

    await this.audit.logSimple(user.id, user.name, AuditActions.AUTH_PASSWORD_RESET, "user", { email })

    this.mail.sendPasswordChanged(user.email, user.name)

    return { message: "Password reset successfully — please log in with your new password" }
  }

  private sanitizeUser(user: any) {
    const { password, mfaSecret, ...rest } = user
    return rest
  }
}
