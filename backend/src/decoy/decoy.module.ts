import { Module } from "@nestjs/common"
import { DecoyController } from "./decoy.controller"
import { DecoyService } from "./decoy.service"
import { DecoyVaultGuard } from "./decoy-vault.guard"
import { PrismaModule } from "../prisma/prisma.module"

@Module({ imports: [PrismaModule], controllers: [DecoyController], providers: [DecoyService, DecoyVaultGuard], exports: [DecoyVaultGuard, DecoyService] })
export class DecoyModule {}
