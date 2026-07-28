import { Controller, Get, Post, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from "@nestjs/common"
import { AuditService } from "./audit.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { RolesGuard } from "../common/guards/roles.guard"
import { Roles } from "../common/decorators/roles.decorator"
import { Role } from "@prisma/client"
import { ApiTags } from "@nestjs/swagger"
import { AuthGuard } from "@nestjs/passport"

@ApiTags("Audit")
@Controller("audit")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
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
  async cleanOldLogs(@Query("retentionDays", new DefaultValuePipe(90), ParseIntPipe) retentionDays: number) {
    const deleted = await this.auditService.cleanOldLogs(retentionDays)
    return { deleted, retentionDays }
  }
}
