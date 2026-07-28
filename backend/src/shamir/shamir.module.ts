import { Module } from "@nestjs/common"
import { ShamirController } from "./shamir.controller"
import { ShamirService } from "./shamir.service"
@Module({ controllers: [ShamirController], providers: [ShamirService] })
export class ShamirModule {}
