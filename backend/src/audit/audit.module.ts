import { Module, Global } from "@nestjs/common"
import { AuditController } from "./audit.controller"
import { AuditService } from "./audit.service"
import { RolesGuard } from "../common/guards/roles.guard"

@Global()
@Module({ controllers: [AuditController], providers: [AuditService, RolesGuard], exports: [AuditService] })
export class AuditModule {}
