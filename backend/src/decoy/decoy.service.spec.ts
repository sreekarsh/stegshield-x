import { Test, TestingModule } from "@nestjs/testing"
import { BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common"
import { DecoyService } from "./decoy.service"
import { PrismaService } from "../prisma/prisma.service"

describe("DecoyService", () => {
  let service: DecoyService
  let prisma: Record<string, any>

  beforeEach(async () => {
    prisma = {
      decoyVault: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      evidence: { findFirst: jest.fn().mockResolvedValue({ id: "real-vault-1", userId: "user-1" }) },
      stegoFile: { findFirst: jest.fn().mockResolvedValue(null) },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [DecoyService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<DecoyService>(DecoyService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("setup", () => {
    it("should create a new decoy vault", async () => {
      prisma.decoyVault.findUnique.mockResolvedValue(null)
      prisma.decoyVault.create.mockResolvedValue({ userId: "user-1", fakePassword: "hash", realVaultId: "real-vault-1", fakeVaultId: null })
      const result = await service.setup("user-1", { fakePassword: "fakepass123", realVaultId: "real-vault-1" })
      expect(result).toBeDefined()
      expect(prisma.decoyVault.create).toHaveBeenCalled()
    })

    it("should update existing decoy vault", async () => {
      prisma.decoyVault.findUnique.mockResolvedValue({ userId: "user-1", fakePassword: "old", realVaultId: "old" })
      prisma.decoyVault.update.mockResolvedValue({ userId: "user-1", fakePassword: "new", realVaultId: "real-vault-1" })
      const result = await service.setup("user-1", { fakePassword: "newpass", realVaultId: "real-vault-1" })
      expect(prisma.decoyVault.update).toHaveBeenCalled()
    })

    it("should reject short passwords", async () => {
      await expect(service.setup("user-1", { fakePassword: "12345", realVaultId: "vault-1" })).rejects.toThrow(BadRequestException)
    })

    it("should reject empty real vault ID", async () => {
      await expect(service.setup("user-1", { fakePassword: "longenough", realVaultId: "" })).rejects.toThrow(BadRequestException)
    })
  })

  describe("getStatus", () => {
    it("should return configured status", async () => {
      prisma.decoyVault.findUnique.mockResolvedValue({ userId: "user-1", fakePassword: "hash", realVaultId: "r1", fakeVaultId: null, createdAt: new Date() })
      const result = await service.getStatus("user-1")
      expect(result.configured).toBe(true)
    })

    it("should return not configured", async () => {
      prisma.decoyVault.findUnique.mockResolvedValue(null)
      const result = await service.getStatus("user-1")
      expect(result.configured).toBe(false)
    })
  })

  describe("verify", () => {
    it("should verify correct password", async () => {
      const argon2 = require("argon2")
      const hashed = await argon2.hash("correct")
      prisma.decoyVault.findUnique.mockResolvedValue({ userId: "user-1", fakePassword: hashed, realVaultId: "r1", fakeVaultId: "f1" })
      const result = await service.verify("user-1", { password: "correct" })
      expect(result.valid).toBe(true)
    })

    it("should reject wrong password", async () => {
      const argon2 = require("argon2")
      const hashed = await argon2.hash("actual")
      prisma.decoyVault.findUnique.mockResolvedValue({ userId: "user-1", fakePassword: hashed, realVaultId: "r1" })
      const result = await service.verify("user-1", { password: "wrong" })
      expect(result.valid).toBe(false)
    })

    it("should throw when not configured", async () => {
      prisma.decoyVault.findUnique.mockResolvedValue(null)
      await expect(service.verify("user-1", { password: "any" })).rejects.toThrow(NotFoundException)
    })
  })

  describe("remove", () => {
    it("should remove decoy vault", async () => {
      prisma.decoyVault.findUnique.mockResolvedValue({ userId: "user-1" })
      prisma.decoyVault.delete.mockResolvedValue({})
      const result = await service.remove("user-1")
      expect(result.message).toContain("removed")
    })

    it("should throw when no vault", async () => {
      prisma.decoyVault.findUnique.mockResolvedValue(null)
      await expect(service.remove("user-1")).rejects.toThrow(NotFoundException)
    })
  })
})
