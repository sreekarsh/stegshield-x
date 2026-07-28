import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}
  async create(userId: string, title: string, message: string, type = "info") {
    return this.prisma.notification.create({ data: { userId, title, message, type } })
  }
  async getAll(userId: string, page = 1, limit = 20) {
    const skip = (page < 1 ? 0 : page - 1) * limit
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ])
    return { items, total, unreadCount, page: Math.max(1, page), limit }
  }
  async markRead(userId: string, id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } })
    if (!notif) throw new NotFoundException("Notification not found")
    if (notif.userId !== userId) throw new ForbiddenException("Access denied")
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } })
  }
  async markAllRead(userId: string) { await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }); return { message: "All notifications marked as read" } }
}
