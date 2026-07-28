import { Module } from "@nestjs/common"
import { TamperController } from "./tamper.controller"
import { TamperService } from "./tamper.service"
import { AiModule } from "../ai/ai.module"

@Module({
  imports: [AiModule],
  controllers: [TamperController],
  providers: [TamperService],
})
export class TamperModule {}
