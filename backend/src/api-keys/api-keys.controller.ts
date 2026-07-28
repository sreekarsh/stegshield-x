import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Req, Query, BadRequestException, ParseUUIDPipe } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { ApiKeysService } from "./api-keys.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { ApiKeyGuard } from "../common/guards/api-key.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

const VALID_PERMISSIONS = ["read", "write", "admin"]

@ApiTags("API Keys")
@ApiBearerAuth()
@Controller("api-keys")
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async create(@Req() req: any, @Body() dto: { name: string; permissions: string[]; expiresAt?: string }) {
    if (!dto.name?.trim()) throw new BadRequestException("Name is required")
    if (!Array.isArray(dto.permissions)) dto.permissions = []
    dto.permissions = dto.permissions.filter(p => VALID_PERMISSIONS.includes(p))
    if (dto.expiresAt) {
      const d = new Date(dto.expiresAt)
      if (isNaN(d.getTime()) || d <= new Date()) throw new BadRequestException("Expiry must be a valid future date")
    }
    return this.apiKeysService.create(req.user.id, dto)
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAll(@Req() req: any, @Query("skip") skip?: string, @Query("take") take?: string) {
    return this.apiKeysService.getAll(req.user.id, Number(skip) || 0, Math.min(Number(take) || 50, 100))
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async update(
    @Req() req: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: { name?: string; permissions?: string[]; isActive?: boolean },
  ) {
    if (dto.permissions) {
      dto.permissions = dto.permissions.filter(p => VALID_PERMISSIONS.includes(p))
    }
    return this.apiKeysService.update(id, req.user.id, dto)
  }

  @Patch(":id/revoke")
  @UseGuards(JwtAuthGuard)
  async revoke(@Req() req: any, @Param("id", ParseUUIDPipe) id: string) {
    return this.apiKeysService.revoke(id, req.user.id)
  }

  @Patch(":id/reactivate")
  @UseGuards(JwtAuthGuard)
  async reactivate(@Req() req: any, @Param("id", ParseUUIDPipe) id: string) {
    return this.apiKeysService.reactivate(id, req.user.id)
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async delete(@Req() req: any, @Param("id", ParseUUIDPipe) id: string) {
    return this.apiKeysService.delete(id, req.user.id)
  }

  @Get("verify")
  @UseGuards(ApiKeyGuard)
  async verifyKey(@Req() req: any) {
    return { valid: true, userId: req.user.id, permissions: req.user.permissions, keyId: req.user.apiKeyId }
  }
}
