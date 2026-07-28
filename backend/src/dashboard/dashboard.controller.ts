import { Controller, Get, UseGuards } from "@nestjs/common"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { DashboardService } from "./dashboard.service"

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get("summary")
  async getSummary() {
    return this.dashboardService.getSummary()
  }
}
