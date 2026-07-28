import { Test, TestingModule } from "@nestjs/testing"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { ReportsService } from "./reports.service"
import { PrismaService } from "../prisma/prisma.service"

describe("ReportsService", () => {
  let service: ReportsService
  let prisma: Record<string, any>

  beforeEach(async () => {
    prisma = {
      report: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "report-1", ...data, createdAt: new Date() })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn() },
      auditLog: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      session: { findMany: jest.fn().mockResolvedValue([]) },
      encryptionKey: { findMany: jest.fn().mockResolvedValue([]) },
      evidence: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) },
      forensicsReport: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      tamperReport: { findMany: jest.fn().mockResolvedValue([]) },
      trustScore: { findMany: jest.fn().mockResolvedValue([]) },
      apiKey: { findMany: jest.fn().mockResolvedValue([]) },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<ReportsService>(ReportsService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("generate", () => {
    it("should generate a security-audit report", async () => {
      const result = await service.generate("user-1", { type: "security-audit", format: "json", name: "My Audit" })
      expect(result.id).toBeDefined()
      expect(result.type).toBe("security-audit")
      expect(result.format).toBe("json")
    })

    it("should generate an activity-log report", async () => {
      const result = await service.generate("user-1", { type: "activity-log", format: "html" })
      expect(result.type).toBe("activity-log")
    })

    it("should generate an evidence-summary report", async () => {
      const result = await service.generate("user-1", { type: "evidence-summary", format: "csv" })
      expect(result.type).toBe("evidence-summary")
    })

    it("should generate a threat-report", async () => {
      const result = await service.generate("user-1", { type: "threat-report", format: "json" })
      expect(result.type).toBe("threat-report")
    })

    it("should generate a compliance report", async () => {
      prisma.user.findUnique.mockResolvedValue({ isMFAEnabled: true, isVerified: true, createdAt: new Date() })
      const result = await service.generate("user-1", { type: "compliance", format: "json" })
      expect(result.type).toBe("compliance")
    })

    it("should reject invalid report type", async () => {
      await expect(service.generate("user-1", { type: "invalid", format: "json" })).rejects.toThrow(BadRequestException)
    })

    it("should reject invalid format", async () => {
      await expect(service.generate("user-1", { type: "security-audit", format: "xml" })).rejects.toThrow(BadRequestException)
    })
  })

  describe("getAll", () => {
    it("should return all user reports", async () => {
      prisma.report.findMany.mockResolvedValue([{ id: "r1", name: "Report 1", type: "security-audit", format: "json", status: "completed", createdAt: new Date() }])
      const result = await service.getAll("user-1")
      expect(result).toHaveLength(1)
    })
  })

  describe("getOne", () => {
    it("should return a single report", async () => {
      prisma.report.findFirst.mockResolvedValue({ id: "r1", userId: "user-1", name: "Test", data: {} })
      const result = await service.getOne("r1", "user-1")
      expect(result.id).toBe("r1")
    })

    it("should throw when not found", async () => {
      prisma.report.findFirst.mockResolvedValue(null)
      await expect(service.getOne("missing", "user-1")).rejects.toThrow(NotFoundException)
    })
  })

  describe("delete", () => {
    it("should delete a report", async () => {
      prisma.report.findFirst.mockResolvedValue({ id: "r1", userId: "user-1", filePath: null })
      const result = await service.delete("r1", "user-1")
      expect(result.message).toContain("deleted")
    })
  })

  describe("download", () => {
    it("should return download info", async () => {
      const path = require("path")
      const validPath = path.join(process.cwd(), "uploads", "reports", "report.json")
      prisma.report.findFirst.mockResolvedValue({ id: "r1", userId: "user-1", name: "Test", format: "json", filePath: validPath })
      const fs = require("fs")
      jest.spyOn(fs, "existsSync").mockReturnValue(true)
      const result = await service.download("r1", "user-1")
      expect(result.filePath).toBeDefined()
      expect(result.contentType).toBe("application/json")
    })
  })
})
