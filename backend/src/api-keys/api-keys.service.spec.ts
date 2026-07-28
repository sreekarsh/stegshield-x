import { Test, TestingModule } from "@nestjs/testing"
import { ForbiddenException, NotFoundException, BadRequestException } from "@nestjs/common"
import { ApiKeysService } from "./api-keys.service"
import { PrismaService } from "../prisma/prisma.service"

describe("ApiKeysService", () => {
  let service: ApiKeysService
  let prisma: Record<string, any>

  beforeEach(async () => {
    prisma = {
      apiKey: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "key-1", ...data, isActive: true, createdAt: new Date(), updatedAt: new Date() })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiKeysService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<ApiKeysService>(ApiKeysService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("create", () => {
    it("should create an API key with sk_ prefix", async () => {
      const result = await service.create("user-1", { name: "My Key", permissions: ["read", "write"] })
      expect(result.key).toMatch(/^sk_/)
      expect(result.name).toBe("My Key")
      expect(prisma.apiKey.create).toHaveBeenCalled()
    })

    it("should reject empty name", async () => {
      await expect(service.create("user-1", { name: "", permissions: [] })).rejects.toThrow(BadRequestException)
    })

    it("should create key with expiry", async () => {
      const future = new Date(Date.now() + 86400000).toISOString()
      const result = await service.create("user-1", { name: "Expiring Key", permissions: ["read"], expiresAt: future })
      expect(result.expiresAt).toBeDefined()
    })
  })

  describe("getAll", () => {
    it("should return masked keys", async () => {
      prisma.apiKey.findMany.mockResolvedValue([{ id: "k1", name: "Key 1", key: "hash", permissions: ["read"], isActive: true, lastUsed: null, expiresAt: null, createdAt: new Date(), updatedAt: new Date() }])
      prisma.apiKey.count.mockResolvedValue(1)
      const result = await service.getAll("user-1")
      expect(result.keys).toHaveLength(1)
      expect(result.keys[0].key).toBe("sk_****")
    })
  })

  describe("update", () => {
    it("should update own key", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: "k1", userId: "user-1", name: "Old Name", permissions: ["read"] })
      prisma.apiKey.update.mockResolvedValue({ id: "k1", name: "New Name", permissions: ["read", "write"], isActive: true, key: "hash", lastUsed: null, expiresAt: null, createdAt: new Date(), updatedAt: new Date() })
      const result = await service.update("k1", "user-1", { name: "New Name", permissions: ["read", "write"] })
      expect(result.name).toBe("New Name")
    })

    it("should reject updating others' keys", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: "k1", userId: "other" })
      await expect(service.update("k1", "user-1", { name: "Hack" })).rejects.toThrow(ForbiddenException)
    })
  })

  describe("revoke", () => {
    it("should deactivate key", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: "k1", userId: "user-1", name: "Test", permissions: [] })
      prisma.apiKey.update.mockResolvedValue({ id: "k1", isActive: false, name: "Test", key: "hash", permissions: [], lastUsed: null, expiresAt: null, createdAt: new Date(), updatedAt: new Date() })
      const result = await service.revoke("k1", "user-1")
      expect(result.isActive).toBe(false)
    })
  })

  describe("delete", () => {
    it("should delete own key", async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: "k1", userId: "user-1" })
      const result = await service.delete("k1", "user-1")
      expect(result.message).toContain("deleted")
    })
  })

  describe("validate", () => {
    it("should return null for invalid key", async () => {
      prisma.apiKey.findMany.mockResolvedValue([])
      const result = await service.validate("sk_invalid")
      expect(result).toBeNull()
    })

    it("should find matching key", async () => {
      const argon2 = require("argon2")
      const hashed = await argon2.hash("sk_valid_key_here")
      prisma.apiKey.findMany.mockResolvedValue([{ id: "k1", userId: "user-1", key: hashed, permissions: ["read"], isActive: true, expiresAt: null }])
      prisma.apiKey.update = jest.fn().mockResolvedValue({})
      const result = await service.validate("sk_valid_key_here")
      expect(result).toBeDefined()
      expect(result!.userId).toBe("user-1")
    })
  })
})
