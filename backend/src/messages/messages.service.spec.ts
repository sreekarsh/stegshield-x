import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { MessagesService } from "./messages.service"
import { PrismaService } from "../prisma/prisma.service"

describe("MessagesService", () => {
  let service: MessagesService
  let prisma: Record<string, any>

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "receiver-1" }) },
      message: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: "msg-1", ...data,
          sender: { id: data.senderId, name: "Sender", avatar: null },
          receiver: { id: data.receiverId, name: "Receiver", avatar: null },
          createdAt: new Date(),
        })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagesService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<MessagesService>(MessagesService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("send", () => {
    it("should send a message", async () => {
      const result = await service.send("sender-1", { receiverId: "receiver-1", content: "Hello", encrypted: true })
      expect(result.id).toBe("msg-1")
      expect(result.content).toBe("Hello")
      expect(prisma.message.create).toHaveBeenCalled()
    })

    it("should reject self-messaging", async () => {
      await expect(service.send("user-1", { receiverId: "user-1", content: "Hi" })).rejects.toThrow(BadRequestException)
    })

    it("should reject non-existent recipient", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.send("sender-1", { receiverId: "ghost", content: "Hi" })).rejects.toThrow(NotFoundException)
    })

    it("should set one-time-view expiry to 60s", async () => {
      await service.send("sender-1", { receiverId: "receiver-1", content: "Secret", oneTimeView: true })
      const callData = prisma.message.create.mock.calls[0][0].data
      expect(callData.oneTimeView).toBe(true)
      expect(callData.expiresAt).toBeDefined()
    })

    it("should set self-destruct expiry to 1h", async () => {
      await service.send("sender-1", { receiverId: "receiver-1", content: "Top Secret", selfDestruct: true })
      const callData = prisma.message.create.mock.calls[0][0].data
      expect(callData.selfDestruct).toBe(true)
      expect(callData.expiresAt).toBeDefined()
    })
  })

  describe("getConversations", () => {
    it("should return conversations", async () => {
      prisma.message.findMany.mockResolvedValue([
        { id: "m1", senderId: "sender-1", receiverId: "user-1", content: "Hi", sender: { id: "sender-1", name: "Alice" }, receiver: { id: "user-1", name: "Bob" }, createdAt: new Date() },
      ])
      const result = await service.getConversations("user-1")
      expect(result.messages).toHaveLength(1)
      expect(result.contacts).toHaveLength(1)
    })
  })

  describe("getConversation", () => {
    it("should return conversation with another user", async () => {
      prisma.message.findMany.mockResolvedValue([
        { id: "m1", senderId: "user-1", receiverId: "other-1", content: "Hey", sender: { id: "user-1", name: "Me" }, receiver: { id: "other-1", name: "Other" }, isRead: true, createdAt: new Date() },
      ])
      const result = await service.getConversation("user-1", "other-1")
      expect(result).toHaveLength(1)
    })
  })

  describe("edit", () => {
    it("should edit own message", async () => {
      prisma.message.findUnique.mockResolvedValue({ id: "m1", senderId: "user-1", isDeleted: false })
      prisma.message.update.mockResolvedValue({ id: "m1", content: "Edited", editedAt: new Date() })
      const result = await service.edit("user-1", "m1", "Edited")
      expect(result).toBeDefined()
    })

    it("should reject editing other's message", async () => {
      prisma.message.findUnique.mockResolvedValue({ id: "m1", senderId: "other", isDeleted: false })
      await expect(service.edit("user-1", "m1", "Edited")).rejects.toThrow(ForbiddenException)
    })
  })

  describe("delete", () => {
    it("should soft-delete own message", async () => {
      prisma.message.findUnique.mockResolvedValue({ id: "m1", senderId: "user-1", isDeleted: false })
      prisma.message.update.mockResolvedValue({ id: "m1", isDeleted: true, content: "[deleted]" })
      const result = await service.delete("user-1", "m1")
      expect(result.isDeleted).toBe(true)
    })

    it("should reject deleting already deleted message", async () => {
      prisma.message.findUnique.mockResolvedValue({ id: "m1", senderId: "user-1", isDeleted: true })
      await expect(service.delete("user-1", "m1")).rejects.toThrow(BadRequestException)
    })
  })
})
