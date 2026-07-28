import { Controller, Get, Patch, Param, UseGuards, Req, Query } from "@nestjs/common"
import { NotificationsService } from "./notifications.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"
@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("notifications")
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}
  @Get()
  @UseGuards(JwtAuthGuard)
  async getAll(@Req() req: any, @Query("page") page = 1, @Query("limit") limit = 20) { return this.notificationsService.getAll(req.user.id, +page, +limit) }
  @Patch(":id/read")
  @UseGuards(JwtAuthGuard)
  async markRead(@Req() req: any, @Param("id") id: string) { return this.notificationsService.markRead(req.user.id, id) }
  @Patch("read-all")
  @UseGuards(JwtAuthGuard)
  async markAllRead(@Req() req: any) { return this.notificationsService.markAllRead(req.user.id) }
}
