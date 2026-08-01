import { Module } from "@nestjs/common"
import { SharingController } from "./sharing.controller"
import { SharingService } from "./sharing.service"
import { NotificationsModule } from "../notifications/notifications.module"
@Module({ imports: [NotificationsModule], controllers: [SharingController], providers: [SharingService] })
export class SharingModule {}
