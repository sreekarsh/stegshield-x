import { Test, TestingModule } from "@nestjs/testing"
import { JwtService } from "@nestjs/jwt"
import { ConflictException, UnauthorizedException } from "@nestjs/common"
import { AuthService } from "./auth.service"
import { PrismaService } from "../prisma/prisma.service"
import { AuditService } from "../audit/audit.service"

import { MailService } from "../mail/mail.service"

describe("AuthService", () => {
  let service: AuthService
  let prisma: Record<string, any>
  let jwtService: Record<string, any>
  let audit: Record<string, any>
  let mail: Record<string, any>

  beforeEach(async () => {
    process.env.SECRET_KEY = "test-mfa-key-32-chars-long!!"
    process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-32-chars-long!"
    process.env.ADMIN_EMAIL = "admin@test.com"

    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      session: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      organization: {
        create: jest.fn().mockResolvedValue({ id: "org-1", name: "Test Team", slug: "team-test" }),
      },
      auditLog: {
        create: jest.fn(),
      },
    }

    jwtService = {
      sign: jest.fn().mockReturnValue("mock-token"),
      verify: jest.fn(),
    }

    audit = {
      logSimple: jest.fn(),
      log: jest.fn(),
    }

    mail = {
      sendEmail: jest.fn().mockResolvedValue(true),
      sendWelcomeEmail: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: AuditService, useValue: audit },
        { provide: MailService, useValue: mail },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
  })

  afterEach(() => {
    delete process.env.SECRET_KEY
    delete process.env.REFRESH_TOKEN_SECRET
    delete process.env.ADMIN_EMAIL
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("register", () => {
    it("should register a new user", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.count.mockResolvedValue(0)
      prisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        name: "Test User",
        role: "ADMIN",
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.register({ email: "test@test.com", password: "StrongP@ss1", name: "Test User" })

      expect(result.user).toBeDefined()
      expect(result.accessToken).toBe("mock-token")
      expect(result.refreshToken).toBe("mock-token")
      expect(prisma.organization.create).toHaveBeenCalled()
    })

    it("should reject duplicate email", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing", email: "existing@test.com" })

      await expect(service.register({ email: "existing@test.com", password: "StrongP@ss1", name: "Dup" }))
        .rejects.toThrow(ConflictException)
    })
  })

  describe("login", () => {
    it("should succeed with valid credentials", async () => {
      const password = "StrongP@ss1"
      const hashedPassword = await require("argon2").hash(password)
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        password: hashedPassword,
        name: "Test",
        role: "VIEWER",
        isVerified: false,
      })
      prisma.user.count.mockResolvedValue(1)

      const result = await service.login({ email: "test@test.com", password })
      expect(result.accessToken).toBe("mock-token")
      expect(result.refreshToken).toBe("mock-token")
      expect(result.user).toBeDefined()
    })

    it("should reject invalid credentials", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        password: "$argon2id$v=19$m=65536,t=3,p=4$SilqBXQymdv0M8hSKLfZ7Q$P+z+zj/14fsLatPQ1YVIMX0ZUrvRa/PwU4vwhM/tLu4",
        name: "Test",
        role: "VIEWER",
        isVerified: false,
      })

      await expect(service.login({ email: "test@test.com", password: "wrong" }))
        .rejects.toThrow(UnauthorizedException)
    })

    it("should reject non-existent user", async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(service.login({ email: "nobody@test.com", password: "any" }))
        .rejects.toThrow(UnauthorizedException)
    })

    it("should reject OAuth-only account", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-2",
        email: "oauth@test.com",
        password: null,
        name: "OAuth User",
        role: "VIEWER",
        isVerified: true,
      })

      await expect(service.login({ email: "oauth@test.com", password: "anything" }))
        .rejects.toThrow("OAuth")
    })

    it("should promote user to ADMIN if email matches ADMIN_EMAIL", async () => {
      const password = "StrongP@ss1"
      const hashedPassword = await require("argon2").hash(password)
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "admin@test.com",
        password: hashedPassword,
        name: "Admin",
        role: "VIEWER",
        isVerified: false,
      })
      prisma.user.count.mockResolvedValue(0)
      prisma.user.update.mockResolvedValue({})

      const result = await service.login({ email: "admin@test.com", password })
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: "ADMIN" }) }),
      )
      expect(result.user.role).toBe("ADMIN")
    })
  })

  describe("changePassword", () => {
    it("should change password with valid current password", async () => {
      const oldPassword = "OldP@ss1"
      const hashed = await require("argon2").hash(oldPassword)
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        name: "Test",
        password: hashed,
      })
      prisma.user.update.mockResolvedValue({})

      const result = await service.changePassword("user-1", oldPassword, "NewP@ss1")
      expect(result.message).toContain("updated")
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tokenVersion: { increment: 1 } }) }),
      )
    })

    it("should reject wrong current password", async () => {
      const hashed = await require("argon2").hash("ActualP@ss1")
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        name: "Test",
        password: hashed,
      })

      await expect(service.changePassword("user-1", "WrongP@ss1", "NewP@ss1"))
        .rejects.toThrow("Current password is incorrect")
    })

    it("should reject OAuth account", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "user-2",
        name: "OAuth",
        password: null,
      })

      await expect(service.changePassword("user-2", "anything", "NewP@ss1"))
        .rejects.toThrow("OAuth")
    })
  })

  describe("validateOAuthUser", () => {
    it("should return existing user by providerId", async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        name: "Test",
        role: "VIEWER",
      })

      const result = await service.validateOAuthUser("google", { id: "google-1" })
      expect(result.id).toBe("user-1")
    })

    it("should link provider to existing email", async () => {
      prisma.user.findFirst.mockResolvedValue(null)
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        name: "Test",
        role: "VIEWER",
      })
      prisma.user.update.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        name: "Test",
        role: "VIEWER",
      })

      const result = await service.validateOAuthUser("github", {
        id: "gh-1",
        emails: [{ value: "test@test.com" }],
        photos: [{ value: "https://avatar.url" }],
      })
      expect(result.id).toBe("user-1")
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ githubId: "gh-1" }) }),
      )
    })

    it("should create new user for new OAuth login", async () => {
      prisma.user.findFirst.mockResolvedValue(null)
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.create.mockResolvedValue({
        id: "user-new",
        email: "new@test.com",
        name: "New User",
        role: "VIEWER",
      })

      const result = await service.validateOAuthUser("google", {
        id: "google-new",
        displayName: "New User",
        emails: [{ value: "new@test.com" }],
      })
      expect(result.id).toBe("user-new")
      expect(prisma.organization.create).toHaveBeenCalled()
    })
  })

  describe("refresh", () => {
    it("should refresh tokens for valid token", async () => {
      jwtService.verify.mockReturnValue({ sub: "user-1", email: "test@test.com" })
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        name: "Test",
        role: "VIEWER",
      })

      const result = await service.refresh("valid-token")
      expect(result.accessToken).toBe("mock-token")
      expect(result.refreshToken).toBe("mock-token")
    })

    it("should reject invalid refresh token", async () => {
      jwtService.verify.mockImplementation(() => { throw new Error("Invalid") })

      await expect(service.refresh("bad-token"))
        .rejects.toThrow(UnauthorizedException)
    })

    it("should reject token for deleted user", async () => {
      jwtService.verify.mockReturnValue({ sub: "deleted-user" })
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(service.refresh("token-for-deleted"))
        .rejects.toThrow(UnauthorizedException)
    })
  })

  describe("logout", () => {
    it("should mark sessions as inactive", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1", name: "Test" })
      prisma.session.updateMany.mockResolvedValue({ count: 1 })

      const result = await service.logout("user-1")
      expect(result.message).toContain("Logged out")
      expect(prisma.session.updateMany).toHaveBeenCalled()
    })
  })

  describe("setupMFA", () => {
    it("should generate and store MFA secret", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1", name: "Test" })
      prisma.user.update.mockResolvedValue({})

      const result = await service.setupMFA("user-1")
      expect(result.secret).toBeDefined()
      expect(result.secret.length).toBeGreaterThan(20)
      expect(result.otpauth_url).toContain("StegShield")
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ mfaSecret: expect.any(String) }) }),
      )
    })
  })

  describe("verifyMFA", () => {
    it("should reject when MFA not set up", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1", mfaSecret: null })

      await expect(service.verifyMFA("user-1", "123456"))
        .rejects.toThrow("MFA not set up")
    })

    it("should reject invalid token format", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "user-1", mfaSecret: "c2VjcmV0" })

      const result = await service.verifyMFA("user-1", "abc")
      expect(result.verified).toBe(false)
    })
  })

  describe("getSessions", () => {
    it("should return user sessions", async () => {
      prisma.session.findMany.mockResolvedValue([{ id: "sess-1", isCurrent: true }])

      const sessions = await service.getSessions("user-1")
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe("sess-1")
    })
  })
})
