import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException, BadRequestException } from "@nestjs/common"
import { UsersService } from "./users.service"
import { PrismaService } from "../prisma/prisma.service"
import { AuditService } from "../audit/audit.service"
import { MailService } from "../mail/mail.service"

describe("UsersService", () => {
  let service: UsersService
  let prisma: Record<string, any>
  let audit: Record<string, any>
  let mail: Record<string, any>

  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    password: "$argon2id$v=19$m=65536,t=3,p=4$AAAA",
    mfaSecret: null,
    role: "EDITOR",
    isVerified: true,
    isMFAEnabled: false,
    phone: null,
    location: null,
    jobTitle: null,
    department: null,
    bio: null,
    socialLinks: null,
    avatar: null,
    googleId: null,
    githubId: null,
    settings: null,
    tokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    sessions: [{ lastActive: new Date(), ip: "127.0.0.1", device: "Desktop", browser: "Chrome" }],
  }

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockUser, ...data, sessions: undefined })),
        count: jest.fn().mockResolvedValue(10),
        findMany: jest.fn().mockResolvedValue([mockUser]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    }

    audit = { logSimple: jest.fn().mockResolvedValue(undefined) }
    mail = {
      sendEmailChangedNotification: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: MailService, useValue: mail },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("findById", () => {
    it("should return user without password and mfaSecret", async () => {
      const result = await service.findById("user-1")
      expect(result).not.toHaveProperty("password")
      expect(result).not.toHaveProperty("mfaSecret")
      expect(result).toHaveProperty("id", "user-1")
    })

    it("should include lastLogin from session", async () => {
      const result = await service.findById("user-1")
      expect(result).toHaveProperty("lastLogin")
    })

    it("should throw NotFoundException if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.findById("nonexistent")).rejects.toThrow(NotFoundException)
    })
  })

  describe("update", () => {
    it("should update basic profile fields", async () => {
      prisma.user.update.mockResolvedValue({ ...mockUser, name: "Updated Name", sessions: undefined })
      const result = await service.update("user-1", { name: "Updated Name" })
      expect(result).not.toHaveProperty("password")
      expect(result.name).toBe("Updated Name")
    })

    it("should throw if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.update("bad-id", { name: "X" })).rejects.toThrow(NotFoundException)
    })

    it("should throw BadRequest if email changed without currentPassword", async () => {
      await expect(
        service.update("user-1", { email: "new@example.com" })
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe("deleteAccount", () => {
    it("should soft-delete user account", async () => {
      const result = await service.deleteAccount("user-1")
      expect(result).toHaveProperty("message")
    })
  })

  describe("exportData", () => {
    it("should export user data", async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        organizations: [],
        stegoFiles: [],
        evidence: [],
        cases: [],
        keys: [],
        sessions: [],
        auditLogs: [],
        notifications: [],
        apiKeys: [],
        trustScores: [],
      })
      const result = await service.exportData("user-1")
      expect(result).toHaveProperty("exportedAt")
      expect(result.user).not.toHaveProperty("password")
    })
  })

  describe("updateSettings", () => {
    it("should merge settings", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, settings: { theme: "dark" } })
      prisma.user.update.mockResolvedValue({ ...mockUser, settings: { theme: "dark", language: "en" } })
      const result = await service.updateSettings("user-1", { language: "en" })
      expect(result.settings).toMatchObject({ theme: "dark", language: "en" })
    })

    it("should throw NotFoundException if user not found", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.updateSettings("bad-id", {})).rejects.toThrow(NotFoundException)
    })

    it("should throw BadRequestException for non-object settings", async () => {
      await expect(service.updateSettings("user-1", null as any)).rejects.toThrow(BadRequestException)
      await expect(service.updateSettings("user-1", "string" as any)).rejects.toThrow(BadRequestException)
      await expect(service.updateSettings("user-1", [] as any)).rejects.toThrow(BadRequestException)
    })

    it("should create audit log on success", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, settings: null })
      prisma.user.update.mockResolvedValue({ ...mockUser, settings: { language: "en" } })
      await service.updateSettings("user-1", { language: "en" })
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "user.settings.updated",
            userId: "user-1",
            metadata: { keys: ["language"] },
          }),
        })
      )
    })
  })

  describe("findAll", () => {
    it("should return paginated users", async () => {
      const result = await service.findAll(1, 20)
      expect(result).toHaveProperty("users")
      expect(result).toHaveProperty("total")
    })
  })

  describe("search", () => {
    it("should return empty for short query", async () => {
      const result = await service.search("", "user-1")
      expect(result.users).toHaveLength(0)
    })

    it("should search users by name or email", async () => {
      prisma.user.findMany.mockResolvedValue([{ id: "user-2", name: "Alice", email: "alice@x.com" }])
      const result = await service.search("alice", "user-1")
      expect(result.users).toHaveLength(1)
    })
  })
})
