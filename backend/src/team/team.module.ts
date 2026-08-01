import { Module } from "@nestjs/common"
import { TeamController } from "./team.controller"
import { TeamService } from "./team.service"
import { MailModule } from "../mail/mail.module"
import { NotificationsModule } from "../notifications/notifications.module"

@Module({
  imports: [MailModule, NotificationsModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
