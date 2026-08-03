import { Test, TestingModule } from "@nestjs/testing"
import { DashboardService } from "./dashboard.service"
import { PrismaService } from "../prisma/prisma.service"

describe("DashboardService", () => {
  let service: DashboardService
  let prisma: Record<string, any>

  beforeEach(async () => {
    prisma = {
      user: { count: jest.fn().mockResolvedValue(10) },
      evidence: { count: jest.fn().mockResolvedValue(25), aggregate: jest.fn().mockResolvedValue({ _sum: { size: 1048576 } }) },
      message: { count: jest.fn().mockResolvedValue(50) },
      encryptionKey: { count: jest.fn().mockResolvedValue(8) },
      session: { count: jest.fn().mockResolvedValue(5) },
      case: { count: jest.fn().mockResolvedValue(3) },
      forensicsReport: { count: jest.fn().mockResolvedValue(15) },
    }
    // Use a getter to avoid variable expansion issues with $
    Object.defineProperty(prisma, "$queryRaw", {
      value: jest.fn().mockResolvedValue([{ 1: 1 }]),
      writable: true,
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<DashboardService>(DashboardService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("getSummary", () => {
    it("should return dashboard summary", async () => {
      const result = await service.getSummary("user-123")
      expect(result.users).toBe(10)
      expect(result.evidence).toBe(25)
      expect(result.messages).toBe(50)
      expect(result.keys).toBe(8)
      expect(result.cases).toBe(3)
      expect(result.reports).toBe(15)
      expect(result.activeSessions).toBe(5)
      expect(result.systemHealth).toBe("healthy")
      expect(result.storageUsed).toBeDefined()
      expect(result.uptime).toBeDefined()
    })

    it("should handle database being down", async () => {
      prisma["$queryRaw"] = jest.fn().mockRejectedValue(new Error("DB down"))
      const result = await service.getSummary("user-123")
      expect(result.systemHealth).toBe("down")
    })

    it("should handle zero storage", async () => {
      prisma.evidence.aggregate = jest.fn().mockResolvedValue({ _sum: { size: null } })
      const result = await service.getSummary("user-123")
      expect(result.storageBytes).toBe(0)
      expect(result.storageUsed).toBe("0 B")
    })
  })
})
