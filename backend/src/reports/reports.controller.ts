import { Controller, Post, Get, Delete, Param, Body, UseGuards, Req, Res, StreamableFile, BadRequestException } from "@nestjs/common"
import { Response } from "express"
import { Throttle } from "@nestjs/throttler"
import { ReportsService } from "./reports.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { createReadStream } from "fs"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Reports")
@ApiBearerAuth()
@Controller("reports")
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post("generate")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  async generate(@Req() req: any, @Body() dto: { type: string; format: string; name?: string; dateFrom?: string; dateTo?: string }) {
    return this.reportsService.generate(req.user.id, dto)
  }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  async getAll(@Req() req: any) { return this.reportsService.getAll(req.user.id) }

  @Get(":id")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  async getOne(@Req() req: any, @Param("id") id: string) { return this.reportsService.getOne(id, req.user.id) }

  @Delete(":id")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  async delete(@Req() req: any, @Param("id") id: string) { return this.reportsService.delete(id, req.user.id) }

  @Get(":id/download")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  async download(@Req() req: any, @Param("id") id: string, @Res() res: Response) {
    const result = await this.reportsService.download(id, req.user.id)
    res.set({
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
    })
    const stream = createReadStream(result.filePath)
    stream.pipe(res)
  }
}
