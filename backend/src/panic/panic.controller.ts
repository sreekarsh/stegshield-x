import { Controller, Post, UseGuards, Req, Body, Get } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { PanicService } from "./panic.service"
import { PanicGuard } from "./panic.guard"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { extractClientIp } from "../common/utils"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Panic")
@ApiBearerAuth()
@Controller("panic")
export class PanicController {
  constructor(private panicService: PanicService) {}

  @Get("support-contact")
  async supportContact() {
    return { email: process.env.SECURITY_CONTACT_EMAIL || "security@stegshield.com" }
  }

  @Post("verify-password")
  @UseGuards(JwtAuthGuard)
  async verifyPassword(@Req() req: any, @Body() dto: { password: string }) {
    return this.panicService.verifyPassword(req.user.id, dto.password)
  }

  @Post("destroy-keys")
  @UseGuards(JwtAuthGuard, PanicGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async destroyKeys(@Req() req: any) {
    return this.panicService.destroyKeys(req.user.id, extractClientIp(req))
  }

  @Post("logout-all")
  @UseGuards(JwtAuthGuard, PanicGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async logoutAll(@Req() req: any) {
    return this.panicService.logoutAll(req.user.id, extractClientIp(req))
  }

  @Post("revoke-tokens")
  @UseGuards(JwtAuthGuard, PanicGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async revokeTokens(@Req() req: any) {
    return this.panicService.revokeTokens(req.user.id, extractClientIp(req))
  }

  @Post("clear-audit")
  @UseGuards(JwtAuthGuard, PanicGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async clearAudit(@Req() req: any) {
    return this.panicService.clearAudit(req.user.id, extractClientIp(req))
  }
}
