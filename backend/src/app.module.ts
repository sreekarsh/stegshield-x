import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { ThrottlerModule } from "@nestjs/throttler"
import { ServeStaticModule } from "@nestjs/serve-static"
import { join } from "path"

import { PrismaModule } from "./prisma/prisma.module"
import { HealthController } from "./health.controller"
import { AuthModule } from "./auth/auth.module"
import { UsersModule } from "./users/users.module"
import { MessagesModule } from "./messages/messages.module"
import { StegoModule } from "./stego/stego.module"
import { EncryptionModule } from "./encryption/encryption.module"
import { ForensicsModule } from "./forensics/forensics.module"
import { TamperModule } from "./tamper/tamper.module"
import { EvidenceModule } from "./evidence/evidence.module"
import { SharingModule } from "./sharing/sharing.module"
import { WatermarkModule } from "./watermark/watermark.module"
import { MetadataModule } from "./metadata/metadata.module"
import { ShamirModule } from "./shamir/shamir.module"
import { PanicModule } from "./panic/panic.module"
import { DecoyModule } from "./decoy/decoy.module"
import { TimeCapsuleModule } from "./times/times.module"
import { TrustModule } from "./trust/trust.module"
import { TeamModule } from "./team/team.module"
import { AdminModule } from "./admin/admin.module"
import { ApiKeysModule } from "./api-keys/api-keys.module"
import { AuditModule } from "./audit/audit.module"
import { ReportsModule } from "./reports/reports.module"
import { NotificationsModule } from "./notifications/notifications.module"
import { VaultModule } from "./vault/vault.module"
import { AiModule } from "./ai/ai.module"
import { SecretLanguageModule } from "./secret-language/secret-language.module"
import { ContactsModule } from "./contacts/contacts.module"
import { PdfModule } from "./pdf/pdf.module"
import { UrlCheckerModule } from "./url-checker/url-checker.module"
import { DashboardModule } from "./dashboard/dashboard.module"

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
      name: "default",
    }]),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), "uploads"),
      serveRoot: "/uploads",
    }),

    PdfModule,
    UrlCheckerModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    MessagesModule,
    StegoModule,
    EncryptionModule,
    ForensicsModule,
    TamperModule,
    EvidenceModule,
    SharingModule,
    WatermarkModule,
    MetadataModule,
    ShamirModule,
    PanicModule,
    DecoyModule,
    TimeCapsuleModule,
    TrustModule,
    TeamModule,
    AdminModule,
    ApiKeysModule,
    AuditModule,
    ReportsModule,
    NotificationsModule,
    VaultModule,
    AiModule,
    SecretLanguageModule,
    ContactsModule,
    DashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
