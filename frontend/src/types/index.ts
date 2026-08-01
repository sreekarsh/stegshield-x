export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  role: Role
  isVerified: boolean
  isMFAEnabled: boolean
  createdAt: string
  updatedAt: string
}

export type Role = "admin" | "owner" | "editor" | "viewer" | "investigator"

export interface Organization {
  id: string
  name: string
  slug: string
  logo?: string
  plan: Plan
  createdAt: string
}

export type Plan = "free" | "pro" | "enterprise"

export interface Session {
  id: string
  userId: string
  device: string
  browser: string
  ip: string
  location: string
  isCurrent: boolean
  lastActive: string
  createdAt: string
}

export type MessageType = "text" | "image" | "gif" | "file" | "sticker"

export interface Message {
  id: string
  senderId: string
  receiverId: string
  content: string
  type: MessageType
  encrypted: boolean
  selfDestruct: boolean
  oneTimeView?: boolean
  expiresAt?: string
  isRead: boolean
  readAt?: string
  isDeleted?: boolean
  editedAt?: string
  createdAt: string
}

export interface StegoFile {
  id: string
  userId: string
  name: string
  carrierFile: string
  carrierType: string
  hiddenDataSize: number
  algorithm: string
  encryption: string
  createdAt: string
}

export interface Evidence {
  id: string
  caseId: string
  name: string
  type: string
  hash: string
  hashAlgorithm: string
  size: number
  status: EvidenceStatus
  chainOfCustody: CustodyEntry[]
  createdAt: string
  lastAccessedAt: string | null
  lastModifiedAt: string | null
}

export type EvidenceStatus = "collected" | "analyzing" | "verified" | "submitted" | "archived"

export interface CustodyEntry {
  id: string
  evidenceId: string
  userId: string
  userName: string
  action: string
  timestamp: string
  signature: string
}

export interface AuditLog {
  id: string
  userId: string
  userName: string
  action: string
  resource: string
  resourceId?: string
  ip: string
  userAgent: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface EncryptionKey {
  id: string
  userId: string
  algorithm: string
  keySize: number
  encryptedKey?: string
  isActive: boolean
  createdAt: string
  rotatedAt?: string
}

export interface TrustScore {
  id: string
  fileId: string
  encryptionScore: number
  privacyScore: number
  integrityScore: number
  threatScore: number
  stegoRisk: number
  overallGrade: string
  analyzedAt: string
}

export interface ThreatReport {
  id: string
  userId: string
  type: string
  severity: "low" | "medium" | "high" | "critical"
  status: "open" | "investigating" | "resolved"
  description: string
  recommendation: string
  createdAt: string
}

export interface Report {
  id: string
  name: string
  type: string
  format: string
  status: string
  filePath: string | null
  createdAt: string
}

export interface ApiKey {
  id: string
  userId: string
  name: string
  key: string
  permissions: string[]
  isActive?: boolean
  lastUsed?: string
  expiresAt?: string
  createdAt: string
  updatedAt?: string
}

export interface SharedLink {
  id: string
  userId: string
  fileId: string
  url: string
  password?: string
  maxDownloads?: number
  expiresAt?: string
  isGeoRestricted: boolean
  isIPRestricted: boolean
  allowedIPs: string[]
  createdAt: string
}

export interface Watermark {
  id: string
  userId: string
  fileId: string
  type: "visible" | "invisible"
  text: string
  createdAt: string
}

export interface TimeCapsule {
  id: string
  title: string
  unlockDate: string
  isOpened: boolean
  createdAt: string
}

export interface SecretLanguage {
  id: string
  userId: string
  name: string
  version: string
  glyphs: Glyph[]
  isShared: boolean
  createdAt: string
}

export interface Glyph {
  id: string
  character: string
  symbol: string
  meaning: string
  category: string
}

export interface Notification {
  id: string
  userId: string
  title: string
  message: string
  type: "info" | "warning" | "success" | "error"
  isRead: boolean
  createdAt: string
}

export interface ContactRequest {
  id: string
  fromUserId: string
  fromUserName: string
  fromUserEmail: string
  toUserId: string
  toUserName: string
  toUserEmail: string
  avatar?: string | null
  status: "pending" | "accepted" | "rejected"
  createdAt: string
}

export interface ForensicsReport {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  sha256: string
  md5: string
  entropy: number
  entropyRatio: number
  entropySuspicious: boolean
  stegoProbability: number
  stegoRisk: string
  lsbRatio: number
  lsbDeviation: number
  stegoSuspicion: boolean
  tamperProbability: number | null
  tamperScore: number | null
  tamperAnalysis: string | null
  deepfakeProbability: number | null
  deepfakeConfidence: number | null
  deepfakeAnalysis: string | null
  threatScore: number
  threatLevel: string
  threatBreakdown: Record<string, boolean> | null
  malwareIndicators: boolean
  executableHeaders: any[]
  maliciousStrings: string[]
  fileStructureValid: boolean
  fileStructureIssues: string[]
  extractedStrings: string[]
  embeddedFiles: Array<{ type: string; offset: number; extension: string }>
  overallRisk: string
  degraded: boolean
  timestamp: string
}

export interface ForensicsReportListItem {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  sha256: string
  entropy: number
  stegoRisk: string
  threatLevel: string
  overallRisk: string
  analyzedAt: string
}

export interface DashboardStats {
  threatScore: number
  storageUsed: number
  storageLimit: number
  totalEncryptions: number
  totalDecryptions: number
  hiddenFiles: number
  evidenceCount: number
  securityHealth: number
  activeSessions: number
  pendingAlerts: number
}
