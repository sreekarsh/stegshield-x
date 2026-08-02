import { Controller, Post, UseGuards, Req, Body, Logger } from "@nestjs/common"
import { SupportService } from "./support.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { extractClientIp } from "../common/utils"
import { ContactSupportDto } from "./dto/contact-support.dto"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Support")
@ApiBearerAuth()
@Controller("support")
export class SupportController {
  private readonly logger = new Logger(SupportController.name)
  constructor(private supportService: SupportService) {}

  @Post("contact")
  @UseGuards(JwtAuthGuard)
  async contactSupport(@Req() req: any, @Body() dto: ContactSupportDto) {
    this.logger.log(`Support request from user: ${req.user?.id}, message length: ${dto.message?.length}`)
    return this.supportService.contactSupport(req.user.id, dto.message, dto.category, extractClientIp(req))
  }
}
