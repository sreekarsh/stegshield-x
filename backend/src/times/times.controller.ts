import { Controller, Post, Get, Delete, Param, Body, UseGuards, Req, Query } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { TimeCapsuleService } from "./times.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Time Capsule")
@ApiBearerAuth()
@Controller("time-capsule")
export class TimeCapsuleController {
  constructor(private timeCapsuleService: TimeCapsuleService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async create(@Req() req: any, @Body() dto: { title: string; encryptedData: string; unlockDate: string; useClientEncryption?: boolean }) {
    return this.timeCapsuleService.create(req.user.id, dto)
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAll(@Req() req: any, @Query("skip") skip?: string, @Query("take") take?: string) {
    return this.timeCapsuleService.getAll(req.user.id, Number(skip) || 0, Math.min(Number(take) || 50, 100))
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async open(@Req() req: any, @Param("id") id: string) {
    return this.timeCapsuleService.open(id, req.user.id)
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async delete(@Req() req: any, @Param("id") id: string) {
    return this.timeCapsuleService.delete(id, req.user.id)
  }
}
