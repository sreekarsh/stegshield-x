import { Controller, Get, Post, Query, UseGuards, ParseIntPipe, DefaultValuePipe, Req } from "@nestjs/common"
import { AuditService } from "./audit.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role } from "@prisma/client"
import { ApiTags } from "@nestjs/swagger"
import { AuthGuard } from "@nestjs/passport"

@ApiTags("Audit")
@Controller("audit")
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get("me")
  async getMyLogs(@Req() req: any, @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number, @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.auditService.getLogsForUser(req.user.id, page, Math.min(limit, 100))
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  async getLogs(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query("search") search?: string,
    @Query("action") action?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.auditService.getLogs(page, Math.min(limit, 200), search, action, from, to)
  }

  @Post("clean")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  async cleanOldLogs(@Query("retentionDays", new DefaultValuePipe(90), ParseIntPipe) retentionDays: number) {
    return this.auditService.cleanOldLogs(retentionDays)
  }
}
