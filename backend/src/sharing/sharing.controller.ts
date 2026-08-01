import { Controller, Post, Get, Delete, Param, Body, UseGuards, Req, UseInterceptors, UploadedFile, Res } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { FileInterceptor } from "@nestjs/platform-express"
import { memoryStorage } from "multer"
import { Response } from "express"
import { SharingService } from "./sharing.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { extractClientIp } from "../common/utils"
import { CreateShareDto } from "./dto/create-share.dto"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Sharing")
@ApiBearerAuth()
@Controller("sharing")
export class SharingController {
  constructor(private sharingService: SharingService) {}

  @Post("links")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }))
  async createLink(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateShareDto,
  ) {
    const host = req.headers?.origin || req.headers?.referer || req.headers?.host || "localhost:4000"
    return this.sharingService.createLink(req.user.id, file, dto, host)
  }

  @Get("links")
  @UseGuards(JwtAuthGuard)
  async getLinks(@Req() req: any) {
    const host = req.headers?.origin || req.headers?.referer || req.headers?.host || "localhost:4000"
    return this.sharingService.getLinks(req.user.id, host)
  }

  @Get("lan-ip")
  getLanIp() {
    return this.sharingService.getLanIpInfo()
  }

  @Delete("links/clear/all")
  @UseGuards(JwtAuthGuard)
  async deleteAllLinks(@Req() req: any) {
    return this.sharingService.deleteAllLinks(req.user.id)
  }

  @Delete("links/:id")
  @UseGuards(JwtAuthGuard)
  async deleteLink(@Req() req: any, @Param("id") id: string) {
    if (id === "clear/all" || id === "clear") {
      return this.sharingService.deleteAllLinks(req.user.id)
    }
    return this.sharingService.deleteLink(id, req.user.id)
  }

  @Get("access/:code")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async accessLink(@Param("code") code: string, @Req() req: any) {
    const ip = extractClientIp(req)
    return this.sharingService.accessLink(code, ip)
  }

  @Post("access/:code/verify")
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Stricter: 5 attempts per minute to prevent brute force
  async verifyAccess(
    @Param("code") code: string,
    @Body("password") password: string | undefined,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const ip = extractClientIp(req)
    await this.sharingService.verifyAccess(code, password, ip, res)
  }
}
