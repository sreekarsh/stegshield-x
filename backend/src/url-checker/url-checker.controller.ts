import { Controller, Post, Body, UseGuards, BadRequestException } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { UrlCheckerService, UrlCheckResult } from "./url-checker.service"
import { ApiTags } from "@nestjs/swagger"

@ApiTags("URL Checker")
@Controller("url-checker")
@UseGuards(JwtAuthGuard)
export class UrlCheckerController {
  constructor(private urlCheckerService: UrlCheckerService) {}

  @Post("check")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async check(@Body("url") url: string): Promise<UrlCheckResult> {
    if (!url || typeof url !== "string" || !url.trim()) {
      throw new BadRequestException("URL is required")
    }
    return this.urlCheckerService.checkUrl(url.trim())
  }
}
