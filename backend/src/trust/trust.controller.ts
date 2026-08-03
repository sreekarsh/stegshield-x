import { Controller, Get, Post, Param, Body, UseGuards, Req, Delete } from "@nestjs/common"
import { IsString, IsOptional, IsNumber, Min, Max } from "class-validator"
import { TrustService } from "./trust.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

class ScoreDto {
  @IsString() fileId: string
  @IsOptional() @IsString() fileName?: string
  @IsOptional() @IsNumber() @Min(0) size?: number
  @IsOptional() @IsString() type?: string
}

@ApiTags("Trust Score")
@ApiBearerAuth()
@Controller("trust")
export class TrustController {
  constructor(private trustService: TrustService) {}

  @Post("score")
  @UseGuards(JwtAuthGuard)
  async score(@Req() req: any, @Body() dto: ScoreDto) {
    return this.trustService.score(req.user.id, dto.fileId, { fileName: dto.fileName, size: dto.size, type: dto.type })
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAllScores(@Req() req: any) {
    return this.trustService.getAllScores(req.user.id)
  }

  @Get(":fileId")
  @UseGuards(JwtAuthGuard)
  async getScore(@Req() req: any, @Param("fileId") fileId: string) {
    return this.trustService.getScore(req.user.id, fileId)
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async deleteScore(@Req() req: any, @Param("id") id: string) {
    return this.trustService.deleteScore(req.user.id, id)
  }
}
