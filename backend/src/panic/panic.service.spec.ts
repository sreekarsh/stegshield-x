import { Test, TestingModule } from "@nestjs/testing"
import { UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { PanicService } from "./panic.service"
import { PrismaService } from "../prisma/prisma.service"
import { MailService } from "../mail/mail.service"
import { NotificationsService } from "../notifications/notifications.service"

describe("PanicService", () => {
  let service: PanicService
  let prisma: Record<string, any>
  let jwtService: Record<string, any>

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockResolvedValue([{ count: 2 }, {}]),
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      encryptionKey: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      apiKey: {
        updateMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
      auditLog: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    }

    jwtService = {
      sign: jest.fn().mockReturnValue("panic-token"),
      verify: jest.fn(),
    }

    const mockMail = {
      sendPanicAlert: jest.fn().mockResolvedValue(true),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PanicService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: MailService, useValue: mockMail },
        { provide: NotificationsService, useValue: { create: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile()

    service = module.get<PanicService>(PanicService)
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("destroyKeys", () => {
    it("should destroy all encryption keys", async () => {
      const result = await service.destroyKeys("user-1")
      expect(result.message).toContain("All encryption keys destroyed")
    })
  })

  describe("logoutAll", () => {
    it("should terminate all sessions", async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 2 })
      prisma.user.update = jest.fn().mockResolvedValue({})

      const result = await service.logoutAll("user-1")
      expect(result.message).toContain("logged out")
    })
  })

  describe("clearAudit", () => {
    it("should block audit clearing and return message", async () => {
      const result = await service.clearAudit("user-1")
      expect(result.message).toContain("disabled")
      expect(result.message).toContain("evidence integrity")
    })
  })
})
