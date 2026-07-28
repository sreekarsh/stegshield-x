import { Module } from "@nestjs/common"
import { TimeCapsuleController } from "./times.controller"
import { TimeCapsuleService } from "./times.service"
@Module({ controllers: [TimeCapsuleController], providers: [TimeCapsuleService] })
export class TimeCapsuleModule {}
