-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OWNER', 'EDITOR', 'VIEWER', 'INVESTIGATOR');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('COLLECTED', 'ANALYZING', 'VERIFIED', 'SUBMITTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('VIEW', 'DOWNLOAD', 'MANAGE');

-- CreateEnum
CREATE TYPE "WatermarkType" AS ENUM ('INVISIBLE', 'VISIBLE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "googleId" TEXT,
    "githubId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isMFAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationUser" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "location" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT true,
    "selfDestruct" BOOLEAN NOT NULL DEFAULT false,
    "oneTimeView" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "alias" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StegoFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "carrierFile" TEXT NOT NULL,
    "carrierType" TEXT NOT NULL,
    "hiddenDataSize" INTEGER NOT NULL,
    "algorithm" TEXT NOT NULL,
    "encryption" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StegoFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EncryptionKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "keySize" INTEGER NOT NULL,
    "publicKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "EncryptionKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "hashAlgorithm" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'COLLECTED',
    "mimeType" TEXT,
    "originalMimeType" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "encryptionAlgo" TEXT DEFAULT 'AES-256-GCM',
    "tags" TEXT[],
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" TIMESTAMP(3),
    "lastModifiedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceShare" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "sharedWithId" TEXT NOT NULL,
    "permission" "SharePermission" NOT NULL DEFAULT 'VIEW',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustodyEntry" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustodyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "permissions" TEXT[],
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "password" TEXT,
    "maxDownloads" INTEGER,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isGeoRestricted" BOOLEAN NOT NULL DEFAULT false,
    "isIPRestricted" BOOLEAN NOT NULL DEFAULT false,
    "allowedIPs" TEXT[],
    "filePath" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watermark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "type" "WatermarkType" NOT NULL DEFAULT 'INVISIBLE',
    "text" TEXT NOT NULL,
    "positionX" INTEGER,
    "positionY" INTEGER,
    "opacity" INTEGER,
    "fontSize" DOUBLE PRECISION,
    "fontColor" TEXT,
    "originalPath" TEXT NOT NULL,
    "watermarkedPath" TEXT,
    "originalMime" TEXT NOT NULL,
    "originalSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watermark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeCapsule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "unlockDate" TIMESTAMP(3) NOT NULL,
    "isOpened" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeCapsule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecoyVault" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fakePassword" TEXT NOT NULL,
    "realVaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecoyVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecretLanguage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "glyphs" JSONB NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecretLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "encryptionScore" INTEGER NOT NULL,
    "privacyScore" INTEGER NOT NULL,
    "integrityScore" INTEGER NOT NULL,
    "threatScore" INTEGER NOT NULL,
    "stegoRisk" INTEGER NOT NULL,
    "overallGrade" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForensicsReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "md5" TEXT,
    "entropy" DOUBLE PRECISION NOT NULL,
    "entropyRatio" DOUBLE PRECISION NOT NULL,
    "entropySuspicious" BOOLEAN NOT NULL,
    "stegoProbability" DOUBLE PRECISION NOT NULL,
    "stegoRisk" TEXT NOT NULL,
    "lsbRatio" DOUBLE PRECISION NOT NULL,
    "lsbDeviation" DOUBLE PRECISION NOT NULL,
    "stegoSuspicion" BOOLEAN NOT NULL,
    "tamperProbability" DOUBLE PRECISION,
    "tamperScore" DOUBLE PRECISION,
    "tamperAnalysis" TEXT,
    "deepfakeProbability" DOUBLE PRECISION,
    "deepfakeConfidence" DOUBLE PRECISION,
    "deepfakeAnalysis" TEXT,
    "threatScore" INTEGER NOT NULL,
    "threatLevel" TEXT NOT NULL,
    "threatBreakdown" JSONB,
    "malwareIndicators" BOOLEAN NOT NULL,
    "executableHeaders" JSONB,
    "maliciousStrings" JSONB,
    "fileStructureValid" BOOLEAN NOT NULL,
    "fileStructureIssues" JSONB,
    "metadataAnomalies" JSONB,
    "elaScore" DOUBLE PRECISION,
    "elaAvailable" BOOLEAN,
    "elaProbability" DOUBLE PRECISION,
    "extractedStrings" JSONB,
    "embeddedFiles" JSONB,
    "overallRisk" TEXT NOT NULL,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForensicsReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "data" JSONB NOT NULL,
    "filePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TamperReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "tamperProbability" DOUBLE PRECISION,
    "tamperScore" DOUBLE PRECISION,
    "tamperAnalysis" TEXT,
    "deepfakeProbability" DOUBLE PRECISION,
    "deepfakeConfidence" DOUBLE PRECISION,
    "deepfakeAnalysis" TEXT,
    "deepfakeFeatures" JSONB,
    "threatScore" INTEGER NOT NULL,
    "threatLevel" TEXT NOT NULL,
    "threatBreakdown" JSONB,
    "malwareHeaders" JSONB,
    "malwareStrings" JSONB,
    "avgEntropy" DOUBLE PRECISION NOT NULL,
    "maxEntropy" DOUBLE PRECISION NOT NULL,
    "entropySuspicious" BOOLEAN NOT NULL,
    "lsbRatio" DOUBLE PRECISION NOT NULL,
    "lsbDeviation" DOUBLE PRECISION NOT NULL,
    "stegoSuspicion" BOOLEAN NOT NULL,
    "structureValid" BOOLEAN NOT NULL,
    "structureIssues" JSONB,
    "elaAvailable" BOOLEAN NOT NULL,
    "elaScore" DOUBLE PRECISION,
    "elaProbability" DOUBLE PRECISION,
    "overallRisk" TEXT NOT NULL,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TamperReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_githubId_key" ON "User"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUser_organizationId_userId_key" ON "OrganizationUser"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_idx" ON "Invitation"("organizationId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_lastActive_idx" ON "Session"("lastActive");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_receiverId_idx" ON "Message"("receiverId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "Contact_ownerId_idx" ON "Contact"("ownerId");

-- CreateIndex
CREATE INDEX "Contact_contactId_idx" ON "Contact"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_ownerId_contactId_key" ON "Contact"("ownerId", "contactId");

-- CreateIndex
CREATE INDEX "StegoFile_userId_idx" ON "StegoFile"("userId");

-- CreateIndex
CREATE INDEX "StegoFile_createdAt_idx" ON "StegoFile"("createdAt");

-- CreateIndex
CREATE INDEX "EncryptionKey_userId_idx" ON "EncryptionKey"("userId");

-- CreateIndex
CREATE INDEX "EncryptionKey_isActive_idx" ON "EncryptionKey"("isActive");

-- CreateIndex
CREATE INDEX "Case_userId_idx" ON "Case"("userId");

-- CreateIndex
CREATE INDEX "Case_status_idx" ON "Case"("status");

-- CreateIndex
CREATE INDEX "Evidence_userId_idx" ON "Evidence"("userId");

-- CreateIndex
CREATE INDEX "Evidence_caseId_idx" ON "Evidence"("caseId");

-- CreateIndex
CREATE INDEX "Evidence_status_idx" ON "Evidence"("status");

-- CreateIndex
CREATE INDEX "Evidence_deletedAt_idx" ON "Evidence"("deletedAt");

-- CreateIndex
CREATE INDEX "EvidenceShare_sharedWithId_idx" ON "EvidenceShare"("sharedWithId");

-- CreateIndex
CREATE INDEX "EvidenceShare_expiresAt_idx" ON "EvidenceShare"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceShare_evidenceId_sharedWithId_key" ON "EvidenceShare"("evidenceId", "sharedWithId");

-- CreateIndex
CREATE INDEX "CustodyEntry_evidenceId_idx" ON "CustodyEntry"("evidenceId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedLink_url_key" ON "SharedLink"("url");

-- CreateIndex
CREATE INDEX "SharedLink_userId_idx" ON "SharedLink"("userId");

-- CreateIndex
CREATE INDEX "SharedLink_expiresAt_idx" ON "SharedLink"("expiresAt");

-- CreateIndex
CREATE INDEX "Watermark_userId_idx" ON "Watermark"("userId");

-- CreateIndex
CREATE INDEX "Watermark_fileId_idx" ON "Watermark"("fileId");

-- CreateIndex
CREATE INDEX "TimeCapsule_userId_idx" ON "TimeCapsule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DecoyVault_userId_key" ON "DecoyVault"("userId");

-- CreateIndex
CREATE INDEX "SecretLanguage_userId_idx" ON "SecretLanguage"("userId");

-- CreateIndex
CREATE INDEX "TrustScore_userId_idx" ON "TrustScore"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustScore_userId_fileId_key" ON "TrustScore"("userId", "fileId");

-- CreateIndex
CREATE INDEX "ForensicsReport_userId_idx" ON "ForensicsReport"("userId");

-- CreateIndex
CREATE INDEX "ForensicsReport_sha256_idx" ON "ForensicsReport"("sha256");

-- CreateIndex
CREATE INDEX "ForensicsReport_analyzedAt_idx" ON "ForensicsReport"("analyzedAt");

-- CreateIndex
CREATE INDEX "Report_userId_idx" ON "Report"("userId");

-- CreateIndex
CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");

-- CreateIndex
CREATE INDEX "Report_type_idx" ON "Report"("type");

-- CreateIndex
CREATE INDEX "TamperReport_userId_idx" ON "TamperReport"("userId");

-- CreateIndex
CREATE INDEX "TamperReport_sha256_idx" ON "TamperReport"("sha256");

-- CreateIndex
CREATE INDEX "TamperReport_analyzedAt_idx" ON "TamperReport"("analyzedAt");

-- AddForeignKey
ALTER TABLE "OrganizationUser" ADD CONSTRAINT "OrganizationUser_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUser" ADD CONSTRAINT "OrganizationUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StegoFile" ADD CONSTRAINT "StegoFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncryptionKey" ADD CONSTRAINT "EncryptionKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceShare" ADD CONSTRAINT "EvidenceShare_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceShare" ADD CONSTRAINT "EvidenceShare_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceShare" ADD CONSTRAINT "EvidenceShare_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustodyEntry" ADD CONSTRAINT "CustodyEntry_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedLink" ADD CONSTRAINT "SharedLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watermark" ADD CONSTRAINT "Watermark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeCapsule" ADD CONSTRAINT "TimeCapsule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecoyVault" ADD CONSTRAINT "DecoyVault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecretLanguage" ADD CONSTRAINT "SecretLanguage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustScore" ADD CONSTRAINT "TrustScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForensicsReport" ADD CONSTRAINT "ForensicsReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForensicsReport" ADD CONSTRAINT "ForensicsReport_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TamperReport" ADD CONSTRAINT "TamperReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
