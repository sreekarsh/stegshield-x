import { Module } from "@nestjs/common"
import { StegoController } from "./stego.controller"
import { StegoService } from "./stego.service"
import { DecoyModule } from "../decoy/decoy.module"

@Module({
  imports: [DecoyModule],
  controllers: [StegoController],
  providers: [StegoService],
})
export class StegoModule {}
