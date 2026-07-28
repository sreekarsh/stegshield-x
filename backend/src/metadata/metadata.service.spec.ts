import { Test, TestingModule } from "@nestjs/testing"
import { HttpException } from "@nestjs/common"
import { MetadataService } from "./metadata.service"
import { AiService } from "../ai/ai.service"

const mockExistsSync = jest.fn()
const mockStat = jest.fn()
const mockReadFile = jest.fn()
const mockWriteFile = jest.fn().mockResolvedValue(undefined)

jest.mock("fs", () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
}))

jest.mock("fs/promises", () => ({
  stat: (...args: any[]) => mockStat(...args),
  readFile: (...args: any[]) => mockReadFile(...args),
  writeFile: (...args: any[]) => mockWriteFile(...args),
  unlink: jest.fn().mockResolvedValue(undefined),
}))

describe("MetadataService", () => {
  let service: MetadataService
  let ai: Record<string, any>

  beforeEach(async () => {
    jest.clearAllMocks()
    ai = {
      analyzeExif: jest.fn().mockResolvedValue({
        is_image: true,
        has_exif: true,
        total_fields: 12,
        fields: { Make: "Canon", Model: "EOS R5" },
        categories: { Camera: { Make: "Canon" } },
        gps_coordinates: null,
        risk_level: "medium",
        risks: ["EXIF metadata present"],
        recommendations: ["Consider stripping EXIF before sharing"],
      }),
      cleanMetadata: jest.fn().mockResolvedValue({
        cleaned: true,
        cleaned_file_base64: Buffer.from("cleaned-image-data").toString("base64"),
        removed_categories: ["EXIF"],
        removed_fields_count: 8,
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetadataService, { provide: AiService, useValue: ai }],
    }).compile()

    service = module.get<MetadataService>(MetadataService)
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("analyze", () => {
    it("should analyze file metadata via AI", async () => {
      mockExistsSync.mockReturnValue(true)
      mockStat.mockResolvedValue({ size: 2048 })
      mockReadFile.mockResolvedValue(Buffer.from("image-data"))

      const result = await service.analyze("user-1", "/tmp/photo.jpg", "photo.jpg")
      expect(result.fileName).toBe("photo.jpg")
      expect(result.hasExif).toBe(true)
      expect(result.totalFields).toBe(12)
      expect(result.riskLevel).toBe("medium")
      expect(ai.analyzeExif).toHaveBeenCalled()
    })

    it("should throw when file not found", async () => {
      mockExistsSync.mockReturnValue(false)
      await expect(service.analyze("user-1", "/tmp/missing.jpg", "missing.jpg")).rejects.toThrow(HttpException)
    })

    it("should fall back to local analysis when AI fails", async () => {
      mockExistsSync.mockReturnValue(true)
      mockStat.mockResolvedValue({ size: 100 })
      mockReadFile.mockResolvedValue(Buffer.from("data"))
      ai.analyzeExif.mockRejectedValue(new Error("AI unavailable"))

      const result = await service.analyze("user-1", "/tmp/file.txt", "file.txt")
      expect(result.fileName).toBe("file.txt")
      expect(result.isImage).toBe(false)
    })
  })

  describe("clean", () => {
    it("should clean metadata from a file", async () => {
      mockExistsSync.mockReturnValue(true)
      mockStat
        .mockResolvedValueOnce({ size: 4096 })
        .mockResolvedValueOnce({ size: 2048 })
      mockReadFile.mockResolvedValue(Buffer.from("image-data"))

      const result = await service.clean("user-1", "/tmp/photo.jpg", "photo.jpg")
      expect(result.cleaned).toBe(true)
      expect(result.removedCategories).toContain("EXIF")
      expect(result.originalSize).toBe(4096)
      expect(result.cleanedSize).toBe(2048)
    })

    it("should throw when file not found", async () => {
      mockExistsSync.mockReturnValue(false)
      await expect(service.clean("user-1", "/tmp/missing.jpg", "missing.jpg")).rejects.toThrow(HttpException)
    })

    it("should throw when cleaning returns no data", async () => {
      mockExistsSync.mockReturnValue(true)
      mockStat.mockResolvedValue({ size: 100 })
      mockReadFile.mockResolvedValue(Buffer.from("data"))
      ai.cleanMetadata.mockResolvedValue({ cleaned: true, cleaned_file_base64: "" })

      await expect(service.clean("user-1", "/tmp/file.txt", "file.txt")).rejects.toThrow(HttpException)
    })
  })
})
