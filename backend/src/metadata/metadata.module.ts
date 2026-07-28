import { Module } from "@nestjs/common"
import { MetadataController } from "./metadata.controller"
import { MetadataService } from "./metadata.service"
import { AiModule } from "../ai/ai.module"

@Module({
  imports: [AiModule],
  controllers: [MetadataController],
  providers: [MetadataService],
})
export class MetadataModule {}
