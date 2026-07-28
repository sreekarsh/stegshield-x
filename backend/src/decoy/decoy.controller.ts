import { Controller, Post, Get, Delete, Body, UseGuards, Req } from "@nestjs/common"
import { DecoyService } from "./decoy.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { SetupDecoyDto } from "./dto/setup.dto"
import { VerifyDecoyDto } from "./dto/verify.dto"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Decoy Vault")
@ApiBearerAuth()
@Controller("decoy")
export class DecoyController {
  constructor(private decoyService: DecoyService) {}

  @Post("setup")
  @UseGuards(JwtAuthGuard)
  async setup(@Req() req: any, @Body() dto: SetupDecoyDto) {
    return this.decoyService.setup(req.user.id, dto)
  }

  @Get("status")
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: any) {
    return this.decoyService.getStatus(req.user.id)
  }

  @Post("verify")
  @UseGuards(JwtAuthGuard)
  async verify(@Req() req: any, @Body() dto: VerifyDecoyDto) {
    return this.decoyService.verify(req.user.id, dto)
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async remove(@Req() req: any) {
    return this.decoyService.remove(req.user.id)
  }
}
