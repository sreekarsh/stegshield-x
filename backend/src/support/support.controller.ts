import { Controller, Post, UseGuards, Req, Body } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { SupportService } from "./support.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { extractClientIp } from "../common/utils"
import { ContactSupportDto } from "./dto/contact-support.dto"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Support")
@ApiBearerAuth()
@Controller("support")
export class SupportController {
  constructor(private supportService: SupportService) {}

  @Post("contact")
  @UseGuards(JwtAuthGuard)
  async contactSupport(@Req() req: any, @Body() dto: ContactSupportDto) {
    return this.supportService.contactSupport(req.user.id, dto.message, dto.category, extractClientIp(req))
  }
}
