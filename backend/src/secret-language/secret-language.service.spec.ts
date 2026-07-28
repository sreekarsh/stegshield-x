import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { SecretLanguageService } from "./secret-language.service"
import { PrismaService } from "../prisma/prisma.service"
import { AiService } from "../ai/ai.service"

describe("SecretLanguageService", () => {
  let service: SecretLanguageService
  let prisma: Record<string, any>
  let ai: Record<string, any>

  beforeEach(async () => {
    prisma = {
      secretLanguage: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "lang-1", ...data, createdAt: new Date() })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    }

    ai = {
      generateSecretLanguage: jest.fn().mockResolvedValue({
        name: "AI Language",
        version: "1.0",
        glyphs: [{ character: "a", symbol: "\u16A0" }],
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecretLanguageService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: ai },
      ],
    }).compile()

    service = module.get<SecretLanguageService>(SecretLanguageService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("create", () => {
    it("should create a secret language", async () => {
      const result = await service.create("user-1", { name: "My Language", glyphs: [{ character: "a", symbol: "\u16A0", meaning: "letter a" }] })
      expect(result.id).toBe("lang-1")
      expect(result.name).toBe("My Language")
    })
  })

  describe("findAll", () => {
    it("should return user languages", async () => {
      prisma.secretLanguage.findMany.mockResolvedValue([{ id: "l1", name: "Lang 1", createdAt: new Date() }])
      const result = await service.findAll("user-1")
      expect(result).toHaveLength(1)
    })
  })

  describe("findOne", () => {
    it("should return own language", async () => {
      prisma.secretLanguage.findUnique.mockResolvedValue({ id: "l1", userId: "user-1", name: "Test", isShared: false, glyphs: [] })
      const result = await service.findOne("l1", "user-1")
      expect(result.name).toBe("Test")
    })

    it("should return shared language", async () => {
      prisma.secretLanguage.findUnique.mockResolvedValue({ id: "l1", userId: "other", name: "Shared", isShared: true, glyphs: [] })
      const result = await service.findOne("l1", "user-1")
      expect(result.name).toBe("Shared")
    })

    it("should reject non-shared language from other user", async () => {
      prisma.secretLanguage.findUnique.mockResolvedValue({ id: "l1", userId: "other", isShared: false })
      await expect(service.findOne("l1", "user-1")).rejects.toThrow(ForbiddenException)
    })
  })

  describe("update", () => {
    it("should update own language", async () => {
      prisma.secretLanguage.findUnique.mockResolvedValue({ id: "l1", userId: "user-1" })
      const result = await service.update("l1", "user-1", { name: "Updated" })
      expect(result).toBeDefined()
    })
  })

  describe("delete", () => {
    it("should delete own language", async () => {
      prisma.secretLanguage.findUnique.mockResolvedValue({ id: "l1", userId: "user-1" })
      const result = await service.delete("l1", "user-1")
      expect(result).toBeDefined()
    })
  })

  describe("encryptMessage", () => {
    it("should encrypt a message using glyph substitution", async () => {
      prisma.secretLanguage.findUnique.mockResolvedValue({
        id: "l1", userId: "user-1", name: "Test", isShared: false,
        glyphs: [{ character: "a", symbol: "\u16A0" }, { character: "b", symbol: "\u16A1" }],
      })
      const result = await service.encryptMessage("l1", "user-1", { text: "ab", unknownCharPlaceholder: "?" })
      expect(result.encrypted).toBe("\u16A0\u16A1")
    })

    it("should use placeholder for unknown characters", async () => {
      prisma.secretLanguage.findUnique.mockResolvedValue({
        id: "l1", userId: "user-1", name: "Test", isShared: false,
        glyphs: [{ character: "a", symbol: "\u16A0" }],
      })
      const result = await service.encryptMessage("l1", "user-1", { text: "az", unknownCharPlaceholder: "?" })
      expect(result.encrypted).toBe("\u16A0?")
    })
  })

  describe("decryptMessage", () => {
    it("should decrypt a message using reverse glyph lookup", async () => {
      prisma.secretLanguage.findUnique.mockResolvedValue({
        id: "l1", userId: "user-1", name: "Test", isShared: false,
        glyphs: [{ character: "a", symbol: "\u16A0" }, { character: "b", symbol: "\u16A1" }],
      })
      const result = await service.decryptMessage("l1", "user-1", { glyphText: "\u16A0\u16A1" })
      expect(result.decrypted).toBe("ab")
    })
  })

  describe("generateWithAi", () => {
    it("should generate a language via AI", async () => {
      const result = await service.generateWithAi("user-1", { theme: "fantasy" })
      expect(result).toBeDefined()
      expect(prisma.secretLanguage.create).toHaveBeenCalled()
    })
  })

  describe("findShared", () => {
    it("should return shared languages", async () => {
      prisma.secretLanguage.findMany.mockResolvedValue([{ id: "l1", name: "Shared Lang", isShared: true }])
      const result = await service.findShared()
      expect(result).toHaveLength(1)
    })
  })

  describe("addGlyph", () => {
    it("should add a glyph to language", async () => {
      prisma.secretLanguage.findUnique.mockResolvedValue({ id: "l1", userId: "user-1", glyphs: [] })
      prisma.secretLanguage.update.mockResolvedValue({ id: "l1", glyphs: [{ id: "g1", character: "c", symbol: "\u16A2" }] })
      const result = await service.addGlyph("l1", "user-1", { character: "c", symbol: "\u16A2", meaning: "letter c", category: "letters" })
      expect(result).toBeDefined()
    })
  })

  describe("toggleShare", () => {
    it("should toggle sharing", async () => {
      prisma.secretLanguage.findUnique.mockResolvedValue({ id: "l1", userId: "user-1", isShared: false })
      prisma.secretLanguage.update.mockResolvedValue({ id: "l1", isShared: true })
      const result = await service.toggleShare("l1", "user-1")
      expect(result).toBeDefined()
    })
  })
})
