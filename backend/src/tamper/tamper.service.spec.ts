import { Test, TestingModule } from "@nestjs/testing"
import { HttpException } from "@nestjs/common"
import { TamperService } from "./tamper.service"
import { PrismaService } from "../prisma/prisma.service"
import { AiService } from "../ai/ai.service"

jest.mock("fs", () => {
  const actualFs = jest.requireActual("fs")
  return {
    ...actualFs,
    existsSync: jest.fn(),
  }
})

jest.mock("fs/promises", () => ({
  stat: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn().mockResolvedValue(undefined),
}))

const fs = require("fs")
const fsPromises = require("fs/promises")

describe("TamperService", () => {
  let service: TamperService
  let prisma: Record<string, any>
  let ai: Record<string, any>

  beforeEach(async () => {
    jest.clearAllMocks()
    prisma = {
      tamperReport: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "report-1", ...data, analyzedAt: new Date() })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
    }

    ai = {
      analyzeAdvancedTamper: jest.fn().mockResolvedValue({
        tamper_analysis: {
          tamper_probability: 0.1,
          tamper_score: 15,
          analysis: "No tampering detected",
        },
        ela: { ela_available: true, ela_score: 0.1, ela_probability: 0.05 },
        entropy_analysis: { average_entropy: 6.5, max_entropy: 7.2 },
        file_structure: { valid: true, issues: [] },
      }),
      detectDeepfake: jest.fn().mockResolvedValue({
        deepfake_probability: 0.05,
        confidence: 0.8,
        analysis: "No deepfake detected",
        features_analyzed: ["face_consistency"],
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TamperService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: ai },
      ],
    }).compile()

    service = module.get<TamperService>(TamperService)
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("analyzeFile", () => {
    it("should analyze a file and return tamper results", async () => {
      fs.existsSync.mockReturnValue(true)
      fsPromises.stat.mockResolvedValue({ size: 1024 })
      fsPromises.readFile.mockResolvedValue(Buffer.from("fake-image-data"))

      const result = await service.analyzeFile("user-1", "/tmp/test.png", "test.png", "image/png")
      expect(result.id).toBe("report-1")
      expect(result.fileName).toBe("test.png")
      expect(result.tamperProbability).toBe(0.1)
      expect(result.overallRisk).toBe("low")
      expect(result.degraded).toBe(false)
      expect(prisma.tamperReport.create).toHaveBeenCalled()
      expect(ai.analyzeAdvancedTamper).toHaveBeenCalled()
      expect(ai.detectDeepfake).toHaveBeenCalled()
    })

    it("should throw when file not found", async () => {
      fs.existsSync.mockReturnValue(false)
      await expect(service.analyzeFile("user-1", "/tmp/missing.png", "missing.png", "image/png")).rejects.toThrow(HttpException)
    })

    it("should handle degraded AI analysis gracefully", async () => {
      fs.existsSync.mockReturnValue(true)
      fsPromises.stat.mockResolvedValue({ size: 1024 })
      fsPromises.readFile.mockResolvedValue(Buffer.from("data"))
      ai.analyzeAdvancedTamper.mockRejectedValue(new Error("AI unavailable"))

      const result = await service.analyzeFile("user-1", "/tmp/test.png", "test.png", "image/png")
      expect(result.degraded).toBe(true)
    })

    it("should reject files exceeding max size", async () => {
      fs.existsSync.mockReturnValue(true)
      fsPromises.stat.mockResolvedValue({ size: 200 * 1024 * 1024 })
      await expect(service.analyzeFile("user-1", "/tmp/large.png", "large.png", "image/png")).rejects.toThrow(HttpException)
    })
  })

  describe("getReports", () => {
    it("should return paginated reports", async () => {
      const result = await service.getReports("user-1", 1, 20)
      expect(result.items).toBeDefined()
    })
  })
})
