import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ParseIntPipe, DefaultValuePipe, Req } from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import { AdminService } from "./admin.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role } from "@prisma/client"
import { Request } from "express"
import { extractClientIp } from "../common/utils"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

@ApiTags("Admin")
@ApiBearerAuth()
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get("stats")
  async getStats() { return this.adminService.getStats() }

  @Get("analytics")
  async getAnalytics(
    @Query("period") period?: string,
  ) { return this.adminService.getAnalytics(period || "7d") }

  @Get("audit-logs")
  async getAuditLogs(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query("search") search?: string,
    @Query("action") action?: string,
  ) { return this.adminService.getAuditLogs(page, Math.min(limit, 100), search, action) }

  @Get("sessions")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getSessions(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) { return this.adminService.getSessions(page, Math.min(limit, 100)) }

  @Get("users")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getUsers(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("search") search?: string,
  ) {
    return this.adminService.getUsers(page, Math.min(limit, 100), search)
  }

  @Patch("users/:id")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async updateUser(@Param("id") id: string, @Body() dto: Record<string, unknown>) {
    return this.adminService.updateUser(id, dto)
  }

  @Delete("users/:id")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async deleteUser(@Param("id") id: string, @Req() req: Request) {
    const userId = (req as any).user?.id || (req as any).user?.sub
    return this.adminService.deleteUser(id, userId)
  }

  @Get("monitoring")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getMonitoring() { return this.adminService.getMonitoring() }

  @Post("notifications/broadcast")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async broadcastNotification(
    @Body() dto: { title: string; message: string; type?: string },
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id || (req as any).user?.sub
    const ip = extractClientIp(req as any)
    return this.adminService.broadcastNotification(dto, userId, ip)
  }

  @Get("system-config")
  async getSystemConfig() { return this.adminService.getSystemConfig() }

  @Patch("system-config")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updateSystemConfig(@Body() dto: Record<string, unknown>) {
    return this.adminService.updateSystemConfig(dto)
  }
}
