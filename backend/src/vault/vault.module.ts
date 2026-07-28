import { Module } from "@nestjs/common"
import { VaultController } from "./vault.controller"
import { VaultService } from "./vault.service"
import { DecoyModule } from "../decoy/decoy.module"

@Module({ imports: [DecoyModule], controllers: [VaultController], providers: [VaultService] })
export class VaultModule {}
