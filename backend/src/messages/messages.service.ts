import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { NotificationsService } from "../notifications/notifications.service"

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async send(senderId: string, dto: { receiverId: string; content: string; selfDestruct?: boolean; oneTimeView?: boolean; expiresIn?: number; encrypted?: boolean }) {
    if (senderId === dto.receiverId) {
      throw new BadRequestException("Cannot send a message to yourself")
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: dto.receiverId },
      select: { id: true },
    })

    if (!receiver) {
      throw new NotFoundException("Recipient not found")
    }

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { name: true },
    })
    const senderName = sender?.name || "A user"

    const expiresAt = dto.oneTimeView
      ? new Date(Date.now() + 60 * 1000)
      : dto.selfDestruct
        ? new Date(Date.now() + 3600 * 1000)
        : dto.expiresIn
          ? new Date(Date.now() + dto.expiresIn * 1000)
          : null

    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId: dto.receiverId,
        content: dto.content,
        selfDestruct: dto.selfDestruct || false,
        oneTimeView: dto.oneTimeView || false,
        encrypted: dto.encrypted ?? true,
        expiresAt,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    })

    await this.notifications.create(
      dto.receiverId,
      "New Encrypted Message",
      `${senderName} sent you a new ${dto.oneTimeView ? "one-time " : dto.selfDestruct ? "self-destructing " : ""}message`,
      "info",
    ).catch(() => {})

    return message
  }

  async getConversations(userId: string) {
    await this.prisma.message.deleteMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        expiresAt: { lte: new Date(), not: null },
      },
    })

    const messages = await this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    })

    const usersMap = new Map<string, { id: string; name: string; avatar: string | null }>()
    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId
      const other = msg.senderId === userId ? msg.receiver : msg.sender
      if (!usersMap.has(otherId)) {
        usersMap.set(otherId, other)
      }
    }

    return {
      messages,
      contacts: Array.from(usersMap.values()),
    }
  }

  async getConversation(userId: string, otherUserId: string) {
    const otherUser = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    })

    if (!otherUser) {
      throw new NotFoundException("User not found")
    }

    // Delete expired messages
    await this.prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
        expiresAt: { lte: new Date(), not: null },
      },
    })

    // Find and process unread messages (mark read, delete one-time-view/self-destruct)
    const unreadMessages = await this.prisma.message.findMany({
      where: { senderId: otherUserId, receiverId: userId, isRead: false },
      select: { id: true, oneTimeView: true, selfDestruct: true },
    })

    if (unreadMessages.length > 0) {
      await this.prisma.message.updateMany({
        where: { senderId: otherUserId, receiverId: userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      })

      const toDelete = unreadMessages
        .filter(m => m.oneTimeView || m.selfDestruct)
        .map(m => m.id)

      if (toDelete.length > 0) {
        await this.prisma.message.deleteMany({
          where: { id: { in: toDelete } },
        })
      }
    }

    // Single fetch after all mutations are done
    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
        isDeleted: false,
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    })
  }

  async edit(userId: string, messageId: string, newContent: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!msg) throw new NotFoundException("Message not found")
    if (msg.senderId !== userId) throw new ForbiddenException("Cannot edit another user's message")
    if (msg.isDeleted) throw new BadRequestException("Cannot edit a deleted message")

    return this.prisma.message.update({
      where: { id: messageId },
      data: { content: newContent, editedAt: new Date() },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    })
  }

  async delete(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } })
    if (!msg) throw new NotFoundException("Message not found")
    if (msg.senderId !== userId) throw new ForbiddenException("Cannot delete another user's message")
    if (msg.isDeleted) throw new BadRequestException("Message already deleted")

    return this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: "[deleted]" },
    })
  }
}
