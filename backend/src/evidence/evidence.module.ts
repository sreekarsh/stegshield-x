import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { HttpModule } from "@nestjs/axios"
import { EvidenceController } from "./evidence.controller"
import { EvidenceService } from "./evidence.service"
import { R2Service } from "../storage/r2.service"
import { DecoyModule } from "../decoy/decoy.module"
@Module({
  imports: [ConfigModule, HttpModule, DecoyModule],
  controllers: [EvidenceController],
  providers: [EvidenceService, R2Service],
})
export class EvidenceModule {}
