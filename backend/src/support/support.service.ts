import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { MailService } from "../mail/mail.service"
import { sanitizeIp } from "../common/utils"

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async contactSupport(userId: string, message: string, category?: string, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    await this.mail.sendSupportRequest({
      fromEmail: user?.email || "unknown",
      userName: user?.name || "Unknown user",
      message,
      category,
      ip,
    })
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          userName: user?.name || "unknown",
          action: "support.contact",
          resource: "help",
          ip: sanitizeIp(ip),
          userAgent: "help-center",
          metadata: { messageLength: message.length, category: category || undefined },
        },
      })
    } catch (err) {
      console.error("Support audit failed:", err)
    }
    return { message: "Your support request has been sent. The team will get back to you shortly." }
  }
}
