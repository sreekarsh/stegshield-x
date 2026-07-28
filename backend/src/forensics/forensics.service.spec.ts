jest.mock("fs", () => {
  const actual = jest.requireActual("fs")
  return { ...actual, existsSync: jest.fn() }
})

jest.mock("fs/promises", () => ({
  stat: jest.fn(),
  readFile: jest.fn(),
  unlink: jest.fn(),
}))

import { Test, TestingModule } from "@nestjs/testing"
import { HttpException } from "@nestjs/common"
import { ForensicsService } from "./forensics.service"
import { PrismaService } from "../prisma/prisma.service"
import { AiService } from "../ai/ai.service"
import * as fs from "fs"
import * as fsp from "fs/promises"

describe("ForensicsService", () => {
  let service: ForensicsService
  let prisma: Record<string, any>
  let aiService: Record<string, any>

  beforeEach(async () => {
    prisma = {
      forensicsReport: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
    }

    aiService = {
      analyzeAdvancedTamper: jest.fn(),
      detectTamper: jest.fn(),
      detectDeepfake: jest.fn(),
      analyzeStego: jest.fn(),
    }

    jest.clearAllMocks()
    ;(fs.existsSync as jest.Mock).mockReturnValue(true)
    ;(fsp.stat as jest.Mock).mockResolvedValue({ size: 1024 })
    ;(fsp.readFile as jest.Mock).mockResolvedValue(Buffer.from("test file content for forensics analysis"))
    ;(fsp.unlink as jest.Mock).mockResolvedValue(undefined)

    aiService.analyzeAdvancedTamper.mockResolvedValue({
      entropy_analysis: { average_entropy: 5.2 },
      lsb_analysis: { stego_suspicion: false, lsb_ratio: 0.3, lsb_deviation: 0.01 },
      malware_scan: { has_malware_indicators: false, headers: [], strings: [] },
      threat_assessment: { threat_score: 10, threat_level: "low", threat_breakdown: {} },
      file_structure: { valid: true, issues: [] },
      ela: { ela_score: 0, ela_available: false, ela_probability: 0 },
    })
    aiService.detectTamper.mockResolvedValue({ tamper_probability: 0.1, tamper_score: 5, analysis: "No tampering detected" })
    aiService.detectDeepfake.mockResolvedValue({ deepfake_probability: 0.05, confidence: 0.9, analysis: "Authentic" })
    aiService.analyzeStego.mockResolvedValue({ stego_probability: 0.1 })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForensicsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: aiService },
      ],
    }).compile()

    service = module.get<ForensicsService>(ForensicsService)
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("analyzeFile", () => {
    it("should throw on missing file", async () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)

      await expect(service.analyzeFile("user-1", "/nonexistent", "test.bin", "application/octet-stream"))
        .rejects.toThrow(HttpException)
    })

    it("should throw on oversized file", async () => {
      ;(fsp.stat as jest.Mock).mockResolvedValue({ size: 200 * 1024 * 1024 })

      await expect(service.analyzeFile("user-1", "/large.bin", "large.bin", "application/octet-stream"))
        .rejects.toThrow("File too large")
    })

    it("should return complete forensics result", async () => {
      prisma.forensicsReport.create.mockResolvedValue({
        id: "report-1",
        fileName: "test.bin",
        fileType: "BIN",
        fileSize: 1024,
        sha256: "abc123",
        md5: "def456",
        entropy: 5.2,
        entropyRatio: 5.2 / 8,
        entropySuspicious: false,
        stegoProbability: 0.1,
        stegoRisk: "low",
        lsbRatio: 0.3,
        lsbDeviation: 0.01,
        stegoSuspicion: false,
        tamperProbability: 0.1,
        tamperScore: 5,
        tamperAnalysis: "No tampering detected",
        deepfakeProbability: 0.05,
        deepfakeConfidence: 0.9,
        deepfakeAnalysis: "Authentic",
        threatScore: 10,
        threatLevel: "low",
        threatBreakdown: {},
        malwareIndicators: false,
        executableHeaders: [],
        maliciousStrings: [],
        fileStructureValid: true,
        fileStructureIssues: [],
        metadataAnomalies: [],
        elaScore: 0,
        elaAvailable: false,
        elaProbability: 0,
        extractedStrings: [],
        embeddedFiles: [],
        overallRisk: "low",
        degraded: false,
        analyzedAt: new Date("2026-01-01"),
      })

      const result = await service.analyzeFile("user-1", "/tmp/test.bin", "test.bin", "application/octet-stream")

      expect(result.id).toBe("report-1")
      expect(result.fileName).toBe("test.bin")
      expect(result.sha256).toBe("abc123")
      expect(result.md5).toBe("def456")
      expect(result.entropy).toBe(5.2)
      expect(result.stegoProbability).toBe(0.1)
      expect(result.stegoRisk).toBe("low")
      expect(result.tamperProbability).toBe(0.1)
      expect(result.deepfakeProbability).toBe(0.05)
      expect(result.threatScore).toBe(10)
      expect(result.threatLevel).toBe("low")
      expect(result.overallRisk).toBe("low")
      expect(result.degraded).toBe(false)
      expect(result.timestamp).toBeDefined()
    })

    it("should mark degraded when AI services fail", async () => {
      aiService.analyzeAdvancedTamper.mockRejectedValue(new Error("AI unavailable"))
      aiService.detectTamper.mockRejectedValue(new Error("Timeout"))
      aiService.detectDeepfake.mockRejectedValue(new Error("No GPU"))
      aiService.analyzeStego.mockRejectedValue(new Error("Stego down"))

      prisma.forensicsReport.create.mockResolvedValue({
        id: "report-degraded",
        fileName: "test.bin",
        fileType: "BIN",
        fileSize: 1024,
        sha256: "abc",
        md5: "def",
        entropy: 5.5,
        entropyRatio: 5.5 / 8,
        entropySuspicious: false,
        stegoProbability: 0.1,
        stegoRisk: "low",
        lsbRatio: 0.5,
        lsbDeviation: 0,
        stegoSuspicion: false,
        tamperProbability: null,
        tamperScore: null,
        tamperAnalysis: null,
        deepfakeProbability: null,
        deepfakeConfidence: null,
        deepfakeAnalysis: null,
        threatScore: 0,
        threatLevel: "unknown",
        threatBreakdown: null,
        malwareIndicators: false,
        executableHeaders: [],
        maliciousStrings: [],
        fileStructureValid: true,
        fileStructureIssues: [],
        metadataAnomalies: [],
        elaScore: null,
        elaAvailable: null,
        elaProbability: null,
        extractedStrings: [],
        embeddedFiles: [],
        overallRisk: "low",
        degraded: true,
        analyzedAt: new Date("2026-01-01"),
      })

      const result = await service.analyzeFile("user-1", "/tmp/test.bin", "test.bin", "application/octet-stream")
      expect(result.degraded).toBe(true)
    })

    it("should compute fallback entropy when AI does not provide it", async () => {
      aiService.analyzeAdvancedTamper.mockResolvedValue({
        entropy_analysis: {},
        lsb_analysis: { stego_suspicion: false, lsb_ratio: 0.5, lsb_deviation: 0 },
        malware_scan: { has_malware_indicators: false, headers: [], strings: [] },
        threat_assessment: { threat_score: 0, threat_level: "unknown" },
        file_structure: { valid: true, issues: [] },
        ela: {},
      })

      prisma.forensicsReport.create.mockResolvedValue({
        id: "report-2",
        fileName: "test.bin",
        fileType: "BIN",
        fileSize: 1024,
        sha256: "abc",
        md5: "def",
        entropy: 0,
        entropyRatio: 0,
        entropySuspicious: false,
        stegoProbability: 0.1,
        stegoRisk: "low",
        lsbRatio: 0.5,
        lsbDeviation: 0,
        stegoSuspicion: false,
        tamperProbability: null,
        tamperScore: null,
        tamperAnalysis: null,
        deepfakeProbability: null,
        deepfakeConfidence: null,
        deepfakeAnalysis: null,
        threatScore: 0,
        threatLevel: "unknown",
        threatBreakdown: null,
        malwareIndicators: false,
        executableHeaders: [],
        maliciousStrings: [],
        fileStructureValid: true,
        fileStructureIssues: [],
        metadataAnomalies: [],
        elaScore: null,
        elaAvailable: null,
        elaProbability: null,
        extractedStrings: [],
        embeddedFiles: [],
        overallRisk: "low",
        degraded: false,
        analyzedAt: new Date(),
      })

      const result = await service.analyzeFile("user-1", "/tmp/test.bin", "test.bin", "application/octet-stream")
      expect(result.entropy).toBeDefined()
    })
  })

  describe("getReports", () => {
    it("should return paginated reports", async () => {
      prisma.forensicsReport.findMany.mockResolvedValue([{ id: "r1" }, { id: "r2" }])
      prisma.forensicsReport.count.mockResolvedValue(10)

      const result = await service.getReports("user-1", 1, 10)
      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(10)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(10)
    })
  })

  describe("getReport", () => {
    it("should return report by id", async () => {
      prisma.forensicsReport.findFirst.mockResolvedValue({ id: "r1", userId: "user-1" })

      const report = await service.getReport("r1", "user-1")
      expect(report.id).toBe("r1")
    })

    it("should throw on not found", async () => {
      prisma.forensicsReport.findFirst.mockResolvedValue(null)

      await expect(service.getReport("missing", "user-1"))
        .rejects.toThrow("not found")
    })
  })

  describe("deleteReport", () => {
    it("should delete report", async () => {
      prisma.forensicsReport.findFirst.mockResolvedValue({ id: "r1", userId: "user-1" })
      prisma.forensicsReport.delete.mockResolvedValue({})

      const result = await service.deleteReport("r1", "user-1")
      expect(result.deleted).toBe(true)
    })

    it("should throw on not found", async () => {
      prisma.forensicsReport.findFirst.mockResolvedValue(null)

      await expect(service.deleteReport("missing", "user-1"))
        .rejects.toThrow("not found")
    })
  })

  describe("helpers", () => {
    it("should extract strings from buffer", () => {
      const buf = Buffer.from("hello\x00world!this_is_a_long_string_for_testing\x00end")
      const strings = (service as any).extractStrings(buf)
      expect(Array.isArray(strings)).toBe(true)
      expect(strings.length).toBeGreaterThanOrEqual(1)
    })

    it("should detect embedded file signatures", () => {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
      const buf = Buffer.concat([Buffer.alloc(10), pngSignature, Buffer.alloc(10)])

      const files = (service as any).detectEmbeddedFiles(buf)
      expect(files.length).toBeGreaterThanOrEqual(1)
      expect(files[0].type).toContain("PNG")
    })

    it("should compute SHA-256 hash", () => {
      const buf = Buffer.from("test data")
      const hash = (service as any).computeHash(buf)
      expect(hash).toHaveLength(64)
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true)
    })

    it("should compute MD5 hash", () => {
      const buf = Buffer.from("test data")
      const hash = (service as any).computeMd5(buf)
      expect(hash).toHaveLength(32)
    })
  })
})
