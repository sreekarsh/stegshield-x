import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}
  async create(userId: string, title: string, message: string, type = "info") {
    return this.prisma.notification.create({ data: { userId, title, message, type } })
  }
  async getAll(userId: string, page = 1, limit = 20) {
    const p = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const l = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20
    const skip = (p - 1) * l
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip, take: l }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ])
    return { items, total, unreadCount, page: p, limit: l }
  }
  async markRead(userId: string, id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } })
    if (!notif) throw new NotFoundException("Notification not found")
    if (notif.userId !== userId) throw new ForbiddenException("Access denied")
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } })
  }
  async markAllRead(userId: string) { await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } }); return { message: "All notifications marked as read" } }
  async delete(userId: string, id: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id } })
    if (!notif) throw new NotFoundException("Notification not found")
    if (notif.userId !== userId) throw new ForbiddenException("Access denied")
    await this.prisma.notification.delete({ where: { id } })
    return { message: "Notification deleted" }
  }
  async deleteAll(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId } })
    return { message: "All notifications cleared" }
  }
}
