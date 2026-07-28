import { Controller, Post, Get, Put, Delete, Body, UseGuards, Req, Param } from "@nestjs/common"
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger"
import { SecretLanguageService } from "./secret-language.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { CreateSecretLanguageDto } from "./dto/create-secret-language.dto"
import { UpdateSecretLanguageDto } from "./dto/update-secret-language.dto"
import { AddGlyphDto } from "./dto/add-glyph.dto"
import { EncryptMessageDto, DecryptMessageDto } from "./dto/translate-message.dto"
import { GenerateWithAiDto } from "./dto/generate-with-ai.dto"

@ApiTags("Secret Language")
@ApiBearerAuth()
@Controller("secret-language")
export class SecretLanguageController {
  constructor(private service: SecretLanguageService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateSecretLanguageDto) {
    return this.service.create(req.user.id, dto)
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req: any) {
    return this.service.findAll(req.user.id)
  }

  @Get("shared")
  @UseGuards(JwtAuthGuard)
  async findShared() {
    return this.service.findShared()
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async findOne(@Req() req: any, @Param("id") id: string) {
    return this.service.findOne(id, req.user.id)
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  async update(@Req() req: any, @Param("id") id: string, @Body() dto: UpdateSecretLanguageDto) {
    return this.service.update(id, req.user.id, dto)
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async delete(@Req() req: any, @Param("id") id: string) {
    return this.service.delete(id, req.user.id)
  }

  @Post(":id/glyphs")
  @UseGuards(JwtAuthGuard)
  async addGlyph(@Req() req: any, @Param("id") id: string, @Body() dto: AddGlyphDto) {
    return this.service.addGlyph(id, req.user.id, dto)
  }

  @Delete(":id/glyphs/:glyphId")
  @UseGuards(JwtAuthGuard)
  async removeGlyph(@Req() req: any, @Param("id") id: string, @Param("glyphId") glyphId: string) {
    return this.service.removeGlyph(id, req.user.id, glyphId)
  }

  @Post(":id/share")
  @UseGuards(JwtAuthGuard)
  async toggleShare(@Req() req: any, @Param("id") id: string) {
    return this.service.toggleShare(id, req.user.id)
  }

  @Post(":id/encrypt")
  @UseGuards(JwtAuthGuard)
  async encryptMessage(@Req() req: any, @Param("id") id: string, @Body() dto: EncryptMessageDto) {
    return this.service.encryptMessage(id, req.user.id, dto)
  }

  @Post(":id/decrypt")
  @UseGuards(JwtAuthGuard)
  async decryptMessage(@Req() req: any, @Param("id") id: string, @Body() dto: DecryptMessageDto) {
    return this.service.decryptMessage(id, req.user.id, dto)
  }

  @Post("generate-ai")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Generate a full language using AI" })
  async generateWithAi(@Req() req: any, @Body() dto: GenerateWithAiDto) {
    return this.service.generateWithAi(req.user.id, dto)
  }
}
