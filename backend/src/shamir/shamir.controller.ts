import { Controller, Post, Body, UseGuards } from "@nestjs/common"
import { ShamirService } from "./shamir.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"
@ApiTags("Shamir")
@ApiBearerAuth()
@Controller("shamir")
export class ShamirController {
  constructor(private shamirService: ShamirService) {}
  @Post("split") @UseGuards(JwtAuthGuard) async split(@Body() dto: { secret: string; parts: number; threshold: number }) { return this.shamirService.split(dto) }
  @Post("recover") @UseGuards(JwtAuthGuard) async recover(@Body() dto: { shares: string[]; threshold: number }) { return this.shamirService.recover(dto) }
}
