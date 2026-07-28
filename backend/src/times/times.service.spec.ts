import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { TimeCapsuleService } from "./times.service"
import { PrismaService } from "../prisma/prisma.service"

describe("TimeCapsuleService", () => {
  let service: TimeCapsuleService
  let prisma: Record<string, any>
  const futureDate = new Date(Date.now() + 86400000).toISOString()

  beforeEach(async () => {
    process.env.SECRET_KEY = "test-secret-key-for-time-capsule-test-32c"
    prisma = {
      timeCapsule: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "capsule-1", ...data, isOpened: false, createdAt: new Date(), openedAt: null })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    }
    const module: TestingModule = await Test.createTestingModule({
      providers: [TimeCapsuleService, { provide: PrismaService, useValue: prisma }],
    }).compile()
    service = module.get<TimeCapsuleService>(TimeCapsuleService)
  })

  afterEach(() => { delete process.env.SECRET_KEY })

  it("should be defined", () => expect(service).toBeDefined())

  describe("create", () => {
    it("should create a time capsule", async () => {
      const result = await service.create("user-1", { title: "Secret", encryptedData: "data", unlockDate: futureDate })
      expect(result.id).toBe("capsule-1")
      expect(result.title).toBe("Secret")
      expect(prisma.timeCapsule.create).toHaveBeenCalled()
    })

    it("should create with client-side encryption", async () => {
      const result = await service.create("user-1", { title: "Client", encryptedData: "data", unlockDate: futureDate, useClientEncryption: true })
      expect(result.id).toBe("capsule-1")
    })

    it("should reject empty title", async () => {
      await expect(service.create("user-1", { title: "", encryptedData: "data", unlockDate: futureDate })).rejects.toThrow(BadRequestException)
    })

    it("should reject past dates", async () => {
      await expect(service.create("user-1", { title: "Test", encryptedData: "data", unlockDate: new Date(Date.now() - 86400000).toISOString() })).rejects.toThrow(BadRequestException)
    })

    it("should reject invalid date", async () => {
      await expect(service.create("user-1", { title: "Test", encryptedData: "data", unlockDate: "bad-date" })).rejects.toThrow(BadRequestException)
    })
  })

  describe("getAll", () => {
    it("should return paginated capsules", async () => {
      prisma.timeCapsule.findMany.mockResolvedValue([{ id: "c1", title: "T", unlockDate: new Date(), isOpened: false, createdAt: new Date() }])
      prisma.timeCapsule.count.mockResolvedValue(1)
      const result = await service.getAll("user-1")
      expect(result.capsules).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })

  describe("open", () => {
    it("should open an unlocked capsule", async () => {
      prisma.timeCapsule.findUnique.mockResolvedValue({ id: "c1", userId: "user-1", title: "Test", encryptedData: "data", unlockDate: new Date(Date.now() - 3600000), isOpened: false, salt: null, createdAt: new Date() })
      const result = await service.open("c1", "user-1")
      expect(result.title).toBe("Test")
      expect(result.isOpened).toBe(true)
    })

    it("should throw for missing capsule", async () => {
      prisma.timeCapsule.findUnique.mockResolvedValue(null)
      await expect(service.open("missing", "user-1")).rejects.toThrow(NotFoundException)
    })

    it("should throw for wrong user", async () => {
      prisma.timeCapsule.findUnique.mockResolvedValue({ id: "c1", userId: "other" })
      await expect(service.open("c1", "user-1")).rejects.toThrow(ForbiddenException)
    })

    it("should throw for sealed capsule", async () => {
      prisma.timeCapsule.findUnique.mockResolvedValue({ id: "c1", userId: "user-1", unlockDate: new Date(Date.now() + 86400000) })
      await expect(service.open("c1", "user-1")).rejects.toThrow(ForbiddenException)
    })
  })

  describe("delete", () => {
    it("should delete a capsule", async () => {
      prisma.timeCapsule.findUnique.mockResolvedValue({ id: "c1", userId: "user-1" })
      const result = await service.delete("c1", "user-1")
      expect(result.message).toContain("deleted")
    })
  })
})
