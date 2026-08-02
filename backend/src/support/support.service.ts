import { Injectable, Logger } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { MailService } from "../mail/mail.service"

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name)
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
  ) {}

  async contactSupport(userId: string, message: string, category?: string, ip?: string) {
    this.logger.log(`contactSupport called userId=${userId} messageLength=${message.length} category=${category}`)
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
    const fromEmail = user?.email || "unknown"
    const userName = user?.name || "Unknown user"

    this.mail.sendSupportRequest({ fromEmail, userName, message, category, ip })
      .catch((err: any) => console.error("Failed to send support request email:", err))

    this.prisma.auditLog.create({
      data: {
        userId,
        userName,
        action: "support.contact",
        resource: "help",
        ip: ip || "127.0.0.1",
        userAgent: "help-center",
        metadata: { messageLength: message.length, category: category || undefined },
      },
    }).catch((err: any) => console.error("Support audit failed:", err))

    return { message: "Your support request has been sent. The team will get back to you shortly." }
  }
}
