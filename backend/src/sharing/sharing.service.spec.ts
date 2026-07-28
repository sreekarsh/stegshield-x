import { Test, TestingModule } from "@nestjs/testing"
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common"
import { SharingService } from "./sharing.service"
import { AuditService } from "../audit/audit.service"
import { PrismaService } from "../prisma/prisma.service"

describe("SharingService", () => {
  let service: SharingService
  let prisma: Partial<Record<string, any>>
  let audit: Partial<Record<string, any>>

  beforeEach(async () => {
    prisma = {
      sharedLink: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "link-1", ...data, downloads: 0, createdAt: new Date() })),
        findUnique: jest.fn().mockResolvedValue({
          id: "link-1",
          url: "abc123",
          filePath: "/tmp/file.txt",
          fileName: "file.txt",
          fileSize: 123,
          downloads: 0,
          password: null,
          maxDownloads: null,
          expiresAt: null,
          isIPRestricted: false,
          allowedIPs: [],
          isGeoRestricted: false,
          userId: "user-1",
          createdAt: new Date(),
        }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "user-1", name: "Test User" }),
      },
    }

    audit = {
      logSimple: jest.fn().mockResolvedValue(undefined),
      log: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SharingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile()

    service = module.get<SharingService>(SharingService)
  })

  it("should create share link", async () => {
    const file = {
      originalname: "file.txt",
      mimetype: "text/plain",
      size: 123,
      buffer: Buffer.from("hello"),
    } as any

    const dto = { password: "password123", maxDownloads: 2, expiresAt: "2099-01-01T00:00:00.000Z", isIPRestricted: true, allowedIPs: ["127.0.0.1"] }
    const result = await service.createLink("user-1", file, dto as any, "localhost:4000")

    expect(result.id).toBe("link-1")
    expect(result.url).toContain("/share/")
    expect(result.hasPassword).toBe(true)
    expect(prisma.sharedLink.create).toHaveBeenCalled()
    expect(audit.logSimple).toHaveBeenCalled()
  })

  it("should reject unsupported file type", async () => {
    const file = {
      originalname: "file.bin",
      mimetype: "application/x-msdownload",
      size: 100,
      buffer: Buffer.from("data"),
    } as any

    await expect(service.createLink("user-1", file, {} as any, "localhost:4000")).rejects.toThrow(BadRequestException)
  })

  it("should return link info for access", async () => {
    const result = await service.accessLink("abc123", "127.0.0.1")
    expect(result.valid).toBe(true)
    expect(result.requiresPassword).toBe(false)
  })

  it("should throw when link not found", async () => {
    prisma.sharedLink.findUnique = jest.fn().mockResolvedValue(null)
    await expect(service.accessLink("missing", "127.0.0.1")).rejects.toThrow(NotFoundException)
  })

  it("should reject invalid password on verifyAccess", async () => {
    prisma.sharedLink.findUnique = jest.fn().mockResolvedValue({
      id: "link-1",
      url: "abc123",
      filePath: "/tmp/file.txt",
      fileName: "file.txt",
      fileSize: 123,
      downloads: 0,
      password: await require("argon2").hash("correct"),
      maxDownloads: null,
      expiresAt: null,
      isIPRestricted: false,
      allowedIPs: [],
      isGeoRestricted: false,
      userId: "user-1",
      createdAt: new Date(),
    })

    const res: any = {
      set: jest.fn(),
      send: jest.fn(),
    }

    await expect(service.verifyAccess("abc123", "wrong", "127.0.0.1", res)).rejects.toThrow(ForbiddenException)
  })
})
