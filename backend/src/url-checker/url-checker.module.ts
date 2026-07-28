import { Module } from "@nestjs/common"
import { UrlCheckerController } from "./url-checker.controller"
import { UrlCheckerService } from "./url-checker.service"

@Module({
  controllers: [UrlCheckerController],
  providers: [UrlCheckerService],
})
export class UrlCheckerModule {}
