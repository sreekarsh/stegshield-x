import { Module } from "@nestjs/common"
import { ForensicsController } from "./forensics.controller"
import { ForensicsService } from "./forensics.service"
import { AiModule } from "../ai/ai.module"

@Module({
  imports: [AiModule],
  controllers: [ForensicsController],
  providers: [ForensicsService],
})
export class ForensicsModule {}
