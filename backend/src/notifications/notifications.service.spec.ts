import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException, ForbiddenException } from "@nestjs/common"
import { NotificationsService } from "./notifications.service"
import { PrismaService } from "../prisma/prisma.service"

describe("NotificationsService", () => {
  let service: NotificationsService
  let prisma: Record<string, any>

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn().mockResolvedValue({ id: "notif-1", userId: "user-1", title: "Test", message: "Hello", type: "info", isRead: false, createdAt: new Date() }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<NotificationsService>(NotificationsService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("create", () => {
    it("should create a notification", async () => {
      const result = await service.create("user-1", "Alert", "Something happened", "warning")
      expect(result.id).toBe("notif-1")
      expect(prisma.notification.create).toHaveBeenCalled()
    })
  })

  describe("getAll", () => {
    it("should return paginated notifications with unread count", async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: "n1", title: "Test", message: "Msg", type: "info", isRead: false, createdAt: new Date() }])
      prisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1)
      const result = await service.getAll("user-1")
      expect(result.items).toHaveLength(1)
      expect(result.unreadCount).toBe(1)
      expect(result.total).toBe(1)
    })
  })

  describe("markRead", () => {
    it("should mark notification as read", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "n1", userId: "user-1" })
      prisma.notification.update.mockResolvedValue({ id: "n1", isRead: true })
      const result = await service.markRead("user-1", "n1")
      expect(result.isRead).toBe(true)
    })

    it("should throw when not found", async () => {
      prisma.notification.findUnique.mockResolvedValue(null)
      await expect(service.markRead("user-1", "missing")).rejects.toThrow(NotFoundException)
    })

    it("should throw for wrong user", async () => {
      prisma.notification.findUnique.mockResolvedValue({ id: "n1", userId: "other" })
      await expect(service.markRead("user-1", "n1")).rejects.toThrow(ForbiddenException)
    })
  })

  describe("markAllRead", () => {
    it("should mark all notifications as read", async () => {
      const result = await service.markAllRead("user-1")
      expect(result.message).toContain("read")
      expect(prisma.notification.updateMany).toHaveBeenCalled()
    })
  })
})
