import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException, BadRequestException } from "@nestjs/common"
import { AdminService } from "./admin.service"
import { PrismaService } from "../prisma/prisma.service"

import { MailService } from "../mail/mail.service"

describe("AdminService", () => {
  let service: AdminService
  let prisma: Record<string, any>
  let mailService: Record<string, any>

  beforeEach(async () => {
    process.env.ADMIN_EMAIL = "admin@test.com"
    prisma = {
      user: { count: jest.fn().mockResolvedValue(10), findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue({}) },
      evidence: { count: jest.fn().mockResolvedValue(25), aggregate: jest.fn().mockResolvedValue({ _sum: { size: 1048576 } }) },
      message: { count: jest.fn().mockResolvedValue(50), deleteMany: jest.fn().mockResolvedValue({}) },
      session: { count: jest.fn().mockResolvedValue(5), findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({}) },
      organization: { count: jest.fn().mockResolvedValue(3) },
      forensicsReport: { count: jest.fn().mockResolvedValue(15) },
      auditLog: { create: jest.fn(), groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn().mockResolvedValue({}) },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 10 }), deleteMany: jest.fn().mockResolvedValue({}) },
      encryptionKey: { count: jest.fn().mockResolvedValue(8), deleteMany: jest.fn().mockResolvedValue({}) },
      apiKey: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({}) },
      contact: { deleteMany: jest.fn().mockResolvedValue({}) },
      "$transaction": jest.fn().mockResolvedValue([]),
    }
    Object.defineProperty(prisma, "$queryRaw", {
      value: jest.fn().mockResolvedValue([{ 1: 1 }]),
      writable: true,
    })
    mailService = { sendPanicAlert: jest.fn() }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
      ],
    }).compile()

    service = module.get<AdminService>(AdminService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("getStats", () => {
    it("should return system stats", async () => {
      const result = await service.getStats()
      expect(result.users).toBe(10)
      expect(result.evidence).toBe(25)
      expect(result.systemHealth).toBeDefined()
    })
  })

  describe("getAnalytics", () => {
    it("should return analytics for period", async () => {
      const result = await service.getAnalytics("24h")
      expect(result.period).toBe("24h")
    })

    it("should default to 7d for unknown period", async () => {
      const result = await service.getAnalytics("invalid")
      expect(result.period).toBe("7d")
    })
  })

  describe("getUsers", () => {
    it("should return paginated users", async () => {
      prisma.user.findMany = jest.fn().mockResolvedValue([{ id: "u1", email: "a@b.com", name: "Alice", role: "VIEWER" }])
      prisma.user.count = jest.fn().mockResolvedValue(1)
      const result = await service.getUsers(1, 10)
      expect(result.users).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it("should support search", async () => {
      await service.getUsers(1, 10, "Alice")
      expect(prisma.user.findMany).toHaveBeenCalled()
    })
  })

  describe("updateUser", () => {
    it("should update user role", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", role: "VIEWER" })
      prisma.user.update = jest.fn().mockResolvedValue({ id: "u1", role: "ADMIN" })
      const result = await service.updateUser("u1", { role: "ADMIN" })
      expect(result.role).toBe("ADMIN")
    })

    it("should reject invalid fields", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1" })
      await expect(service.updateUser("u1", { invalidField: true })).rejects.toThrow(BadRequestException)
    })

    it("should reject non-existent user", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.updateUser("missing", { role: "ADMIN" })).rejects.toThrow(NotFoundException)
    })
  })

  describe("deleteUser", () => {
    it("should delete a user", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u2" })
      const result = await service.deleteUser("u2", "admin-1")
      expect(result.message).toContain("deleted")
    })

    it("should reject self-deletion", async () => {
      await expect(service.deleteUser("admin-1", "admin-1")).rejects.toThrow(BadRequestException)
    })
  })

  describe("broadcastNotification", () => {
    it("should send notification to all users", async () => {
      prisma.user.findMany = jest.fn().mockResolvedValue([{ id: "u1", email: "a@b.com" }, { id: "u2", email: "c@d.com" }])
      const result = await service.broadcastNotification({ title: "Alert", message: "Maintenance" }, "admin-1")
      expect(result.message).toContain("2")
      expect(prisma.notification.createMany).toHaveBeenCalled()
    })
  })

  describe("getSystemConfig", () => {
    it("should return system configuration", async () => {
      const result = await service.getSystemConfig()
      expect(result.adminEmail).toBeDefined()
      expect(result.maintenanceMode).toBe(false)
    })
  })

  describe("getMonitoring", () => {
    it("should return system monitoring data", async () => {
      const result = await service.getMonitoring()
      expect(result.cpuCores).toBeGreaterThan(0)
      expect(result.platform).toBeDefined()
      expect(result.dbHealthy).toBe(true)
    })
  })

  describe("getAuditLogs", () => {
    it("should return paginated audit logs", async () => {
      prisma.auditLog.findMany = jest.fn().mockResolvedValue([{ id: "l1", action: "user.login", userName: "Admin" }])
      prisma.auditLog.count = jest.fn().mockResolvedValue(1)
      const result = await service.getAuditLogs(1, 20)
      expect(result.logs).toHaveLength(1)
    })
  })

  describe("getSessions", () => {
    it("should return paginated sessions", async () => {
      prisma.session.findMany = jest.fn().mockResolvedValue([{ id: "s1", user: { id: "u1", name: "Alice" } }])
      prisma.session.count = jest.fn().mockResolvedValue(1)
      const result = await service.getSessions()
      expect(result.sessions).toHaveLength(1)
    })
  })
})
