import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { WatermarkController } from "./watermark.controller";
import { WatermarkService } from "./watermark.service";

@Module({
  imports: [ConfigModule],
  controllers: [WatermarkController],
  providers: [WatermarkService],
})
export class WatermarkModule {}
