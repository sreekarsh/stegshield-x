import { Test, TestingModule } from "@nestjs/testing"
import { AuditService } from "./audit.service"
import { PrismaService } from "../prisma/prisma.service"

describe("AuditService", () => {
  let service: AuditService
  let prisma: Record<string, any>

  beforeEach(async () => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "log-1" }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<AuditService>(AuditService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("log", () => {
    it("should create an audit log entry", async () => {
      const result = await service.log("user-1", "Test User", "user.login", "Session", "127.0.0.1", "Chrome", { extra: "info" })
      expect(result.id).toBe("log-1")
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: { userId: "user-1", userName: "Test User", action: "user.login", resource: "Session", ip: "127.0.0.1", userAgent: "Chrome", metadata: { extra: "info" } },
      })
    })
  })

  describe("logWithUser", () => {
    it("should log with user object", async () => {
      await service.logWithUser({ id: "user-1", name: "Alice" }, "evidence.create", "Evidence", "10.0.0.1", "Firefox")
      expect(prisma.auditLog.create).toHaveBeenCalled()
    })

    it("should handle null user", async () => {
      await service.logWithUser(null, "system.action", "System")
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: "system", userName: "system" }) }),
      )
    })
  })

  describe("logSimple", () => {
    it("should create a simple audit log", async () => {
      await service.logSimple("user-1", "Bob", "file.upload" as any, "StegoFile")
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: "file.upload", ip: "127.0.0.1" }) }),
      )
    })
  })

  describe("getLogs", () => {
    it("should return paginated logs", async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: "l1", action: "user.login", userName: "Alice", resource: "Session", ip: "1.2.3.4", createdAt: new Date() }])
      prisma.auditLog.count.mockResolvedValue(1)
      const result = await service.getLogs(1, 20)
      expect(result.logs).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it("should support search filter", async () => {
      await service.getLogs(1, 50, "Alice", "user.login", "2024-01-01", "2024-12-31")
      expect(prisma.auditLog.findMany).toHaveBeenCalled()
    })
  })

  describe("cleanOldLogs", () => {
    it("should delete old logs", async () => {
      const result = await service.cleanOldLogs(90)
      expect(result).toBe(10)
      expect(prisma.auditLog.deleteMany).toHaveBeenCalled()
    })
  })
})
