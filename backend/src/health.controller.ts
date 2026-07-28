import { Controller, Get } from "@nestjs/common"
import { ApiTags } from "@nestjs/swagger"
import { PrismaService } from "./prisma/prisma.service"

@ApiTags("Health")
@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get("health")
  async health() {
    let dbOk = false
    try {
      await this.prisma.$queryRaw`SELECT 1`
      dbOk = true
    } catch {}
    return {
      status: dbOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      database: dbOk ? "connected" : "disconnected",
    }
  }
}
