import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { VaultService } from "./vault.service"
import { PrismaService } from "../prisma/prisma.service"

describe("VaultService", () => {
  let service: VaultService
  let prisma: Record<string, any>

  beforeEach(async () => {
    prisma = {
      evidence: {
        findMany: jest.fn().mockResolvedValue([{ id: "ev-1", userId: "user-1", name: "evidence.pdf", filePath: "/tmp/ev.pdf", status: "COLLECTED", createdAt: new Date() }]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn(),
      },
      stegoFile: {
        findMany: jest.fn().mockResolvedValue([{ id: "st-1", userId: "user-1", name: "stego.png", createdAt: new Date() }]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn(),
      },
      custodyEntry: { deleteMany: jest.fn().mockResolvedValue({}) },
      evidenceShare: { deleteMany: jest.fn().mockResolvedValue({}) },
      forensicsReport: { updateMany: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((fns) => Promise.all(fns)),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [VaultService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<VaultService>(VaultService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("getAll", () => {
    it("should return all vault items", async () => {
      const result = await service.getAll("user-1")
      expect(result.evidence).toHaveLength(1)
      expect(result.stegoFiles).toHaveLength(1)
      expect(result.total).toBe(2)
    })

    it("should filter in decoy mode with fakeVaultId", async () => {
      prisma.evidence.findMany.mockResolvedValue([{ id: "fake-ev", userId: "user-1", name: "fake.pdf", status: "COLLECTED", createdAt: new Date() }])
      prisma.stegoFile.findMany.mockResolvedValue([])
      const result = await service.getAll("user-1", 1, 100, true, "fake-ev")
      expect(result.decoyMode).toBe(true)
      expect(result.evidence).toHaveLength(1)
    })

    it("should return empty in decoy mode without fakeVaultId", async () => {
      const result = await service.getAll("user-1", 1, 100, true, null)
      expect(result.decoyMode).toBe(true)
      expect(result.total).toBe(0)
    })

    it("should clamp pagination values", async () => {
      const result = await service.getAll("user-1", -1, 999)
      expect(result.page).toBe(1)
      expect(result.limit).toBe(100)
    })
  })

  describe("delete", () => {
    it("should delete evidence item", async () => {
      prisma.evidence.findUnique.mockResolvedValue({ id: "ev-1", userId: "user-1", filePath: "/tmp/ev.pdf" })
      prisma.evidence.delete.mockResolvedValue({})
      const result = await service.delete("user-1", "evidence", "ev-1")
      expect(result.message).toContain("deleted")
    })

    it("should delete stego file", async () => {
      prisma.stegoFile.findUnique.mockResolvedValue({ id: "st-1", userId: "user-1" })
      prisma.stegoFile.delete.mockResolvedValue({})
      const result = await service.delete("user-1", "stego", "st-1")
      expect(result.message).toContain("deleted")
    })

    it("should reject invalid source", async () => {
      await expect(service.delete("user-1", "invalid", "id")).rejects.toThrow(BadRequestException)
    })

    it("should reject non-owned evidence", async () => {
      prisma.evidence.findUnique.mockResolvedValue({ id: "ev-1", userId: "other-user" })
      await expect(service.delete("user-1", "evidence", "ev-1")).rejects.toThrow(ForbiddenException)
    })
  })

  describe("rename", () => {
    it("should rename evidence", async () => {
      prisma.evidence.findUnique.mockResolvedValue({ id: "ev-1", userId: "user-1", name: "old.pdf" })
      prisma.evidence.update.mockResolvedValue({ id: "ev-1", name: "new.pdf" })
      const result = await service.rename("user-1", "evidence", "ev-1", "new.pdf")
      expect(result.name).toBe("new.pdf")
    })

    it("should reject empty name", async () => {
      await expect(service.rename("user-1", "evidence", "ev-1", "")).rejects.toThrow(BadRequestException)
    })
  })
})
