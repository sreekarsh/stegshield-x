import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { EncryptionController } from "./encryption.controller"
import { EncryptionService } from "./encryption.service"
@Module({
  imports: [ConfigModule],
  controllers: [EncryptionController],
  providers: [EncryptionService],
})
export class EncryptionModule {}