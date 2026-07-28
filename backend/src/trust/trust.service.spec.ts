import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException, BadRequestException } from "@nestjs/common"
import { TrustService } from "./trust.service"
import { PrismaService } from "../prisma/prisma.service"

describe("TrustService", () => {
  let service: TrustService
  let prisma: Record<string, any>

  beforeEach(async () => {
    prisma = {
      trustScore: {
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: "score-1", ...create })),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [TrustService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<TrustService>(TrustService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("score", () => {
    it("should create a trust score for a text file", async () => {
      const result = await service.score("user-1", "file-1", { fileName: "document.txt", size: 1024, type: "text/plain" })
      expect(result.fileId).toBe("file-1")
      expect(result.overallGrade).toBeDefined()
      expect(prisma.trustScore.upsert).toHaveBeenCalled()
    })

    it("should create a trust score for an executable", async () => {
      const result = await service.score("user-1", "file-2", { fileName: "app.exe", size: 50000000, type: "application/x-msdownload" })
      expect(result.threatScore).toBeGreaterThan(0)
      expect(result.overallGrade).toBeDefined()
    })

    it("should handle image files differently", async () => {
      const result = await service.score("user-1", "file-3", { fileName: "photo.png", size: 5242880, type: "image/png" })
      expect(result.stegoRisk).toBeGreaterThan(0)
      expect(result.overallGrade).toBeDefined()
    })

    it("should throw without fileId", async () => {
      await expect(service.score("user-1", "")).rejects.toThrow(BadRequestException)
    })

    it("should handle duplicate scoring (upsert)", async () => {
      await service.score("user-1", "file-1", { fileName: "doc.txt", size: 100 })
      await service.score("user-1", "file-1", { fileName: "doc.txt", size: 200 })
      expect(prisma.trustScore.upsert).toHaveBeenCalledTimes(2)
    })

    it("should assign A+ for safe documents", async () => {
      const result = await service.score("user-1", "safe-doc", { fileName: "readme.txt", size: 1000, type: "text/plain" })
      expect(["A+", "A", "B+", "B"]).toContain(result.overallGrade)
    })

    it("should assign lower grades for executables", async () => {
      const result = await service.score("user-1", "exe-file", { fileName: "virus.exe", size: 100000000, type: "application/x-msdownload" })
      expect(["F", "D", "C"]).toContain(result.overallGrade)
    })
  })

  describe("getScore", () => {
    it("should return a specific score", async () => {
      prisma.trustScore.findFirst.mockResolvedValue({ id: "score-1", fileId: "file-1", overallGrade: "A" })
      const result = await service.getScore("user-1", "file-1")
      expect(result.overallGrade).toBe("A")
    })

    it("should throw when not found", async () => {
      prisma.trustScore.findFirst.mockResolvedValue(null)
      await expect(service.getScore("user-1", "missing")).rejects.toThrow(NotFoundException)
    })
  })

  describe("getAllScores", () => {
    it("should return all scores for user", async () => {
      prisma.trustScore.findMany.mockResolvedValue([{ id: "s1", overallGrade: "A" }, { id: "s2", overallGrade: "B" }])
      const result = await service.getAllScores("user-1")
      expect(result).toHaveLength(2)
    })
  })
})
