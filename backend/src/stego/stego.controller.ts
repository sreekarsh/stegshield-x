import { Controller, Post, Get, Body, UseGuards, Req } from "@nestjs/common"
import { StegoService } from "./stego.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { DecoyVaultGuard } from "../decoy/decoy-vault.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Steganography")
@ApiBearerAuth()
@Controller("stego")
export class StegoController {
  constructor(private stegoService: StegoService) {}

  @Post("embed")
  @UseGuards(JwtAuthGuard)
  async embed(@Req() req: any, @Body() dto: { carrierId: string; message: string; encrypt?: boolean }) {
    return this.stegoService.embed(req.user.id, dto)
  }

  @Post("extract")
  @UseGuards(JwtAuthGuard)
  async extract(@Body() dto: { fileId: string; key?: string }) {
    return this.stegoService.extract(dto)
  }

  @Get("files")
  @UseGuards(JwtAuthGuard, DecoyVaultGuard)
  async getFiles(@Req() req: any) {
    return this.stegoService.getFiles(req.user.id, req.decoyMode, req.fakeVaultId)
  }
}