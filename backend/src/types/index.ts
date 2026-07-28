export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface FileAnalysisResult {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  sha256: string
  entropy: number
  threatScore: number
  threatLevel: string
  overallRisk: string
  degraded: boolean
  timestamp: string
}

export interface UrlCheckRequest {
  url: string
}

export interface StegoEmbedRequest {
  carrierId: string
  message: string
  encrypt?: boolean
}

export interface StegoExtractRequest {
  fileId: string
  key?: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface HealthStatus {
  status: string
  service: string
  version: string
}

export interface AuditEntry {
  id: string
  userId: string
  userName: string
  action: string
  resource: string
  resourceId?: string
  ip: string
  userAgent: string
  metadata: Record<string, unknown>
  createdAt: Date
}
