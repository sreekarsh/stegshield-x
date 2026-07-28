import { Module } from "@nestjs/common"
import { SecretLanguageController } from "./secret-language.controller"
import { SecretLanguageService } from "./secret-language.service"
import { AiModule } from "../ai/ai.module"

@Module({
  imports: [AiModule],
  controllers: [SecretLanguageController],
  providers: [SecretLanguageService],
})
export class SecretLanguageModule {}
