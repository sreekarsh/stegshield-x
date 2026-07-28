import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { PanicController } from "./panic.controller"
import { PanicService } from "./panic.service"
import { PanicGuard } from "./panic.guard"
import { MailModule } from "../mail/mail.module"

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET }),
    MailModule,
  ],
  controllers: [PanicController],
  providers: [PanicService, PanicGuard],
})
export class PanicModule {}
