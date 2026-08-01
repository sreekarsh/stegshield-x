import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { join, normalize, sep } from "path"
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from "fs"
import { v4 as uuidv4 } from "uuid"

const reportDir = join(process.cwd(), "uploads", "reports")

const VALID_TYPES = ["security-audit", "activity-log", "evidence-summary", "threat-report", "compliance"]
const VALID_FORMATS = ["json", "html", "csv", "pdf"]

function ensureDir() {
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true })
}

function escapeHtml(str: unknown): string {
  if (str == null) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
}

function isWithinReportDir(filePath: string): boolean {
  const normalizedPath = normalize(filePath)
  const normalizedDir = normalize(reportDir) + sep
  return normalizedPath.startsWith(normalizedDir) || normalizedPath === normalize(reportDir)
}

function toSafeValue(val: unknown): string {
  if (val == null) return ""
  if (typeof val === "object") return escapeHtml(JSON.stringify(val))
  return escapeHtml(String(val))
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async generate(userId: string, dto: { type: string; format: string; name?: string; dateFrom?: string; dateTo?: string }) {
    if (!VALID_TYPES.includes(dto.type)) throw new BadRequestException(`Invalid report type. Must be one of: ${VALID_TYPES.join(", ")}`)
    if (!VALID_FORMATS.includes(dto.format)) throw new BadRequestException(`Invalid format. Must be one of: ${VALID_FORMATS.join(", ")}`)

    ensureDir()

    const name = (dto.name || `${dto.type}-${new Date().toISOString().slice(0, 10)}`).trim()
    const data = await this.buildReportData(userId, dto.type, dto.dateFrom, dto.dateTo)

    const ext = dto.format === "csv" ? "csv" : dto.format === "pdf" ? "pdf" : dto.format === "html" ? "html" : "json"
    const id = uuidv4()
    const fileName = `${id}.${ext}`
    const filePath = join(reportDir, fileName)

    const report = await this.prisma.report.create({
      data: { id, userId, name, type: dto.type, format: dto.format, status: "completed", data, filePath },
    })

    try {
      const fileContent = this.formatContent(dto.format, name, data)
      writeFileSync(filePath, fileContent)
    } catch (err) {
      await this.prisma.report.delete({ where: { id } }).catch(() => {})
      throw err
    }

    return { id: report.id, userId, name: report.name, type: dto.type, format: dto.format, status: "completed", createdAt: report.createdAt.toISOString() }
  }

  async getAll(userId: string) {
    const reports = await this.prisma.report.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, name: true, type: true, format: true, status: true, createdAt: true },
    })
    return reports
  }

  async getOne(id: string, userId: string) {
    const report = await this.prisma.report.findFirst({ where: { id, userId } })
    if (!report) throw new NotFoundException("Report not found")
    return report
  }

  async delete(id: string, userId: string) {
    const report = await this.prisma.report.findFirst({ where: { id, userId } })
    if (!report) throw new NotFoundException("Report not found")
    if (report.filePath && existsSync(report.filePath)) {
      try { unlinkSync(report.filePath) } catch (e) { console.error("Failed to delete report file:", e) }
    }
    await this.prisma.report.delete({ where: { id } })
    return { message: "Report deleted" }
  }

  async download(id: string, userId: string) {
    const report = await this.prisma.report.findFirst({ where: { id, userId } })
    if (!report) throw new NotFoundException("Report not found")
    if (!report.filePath || !existsSync(report.filePath)) throw new NotFoundException("Report file not found")

    if (!isWithinReportDir(report.filePath)) throw new NotFoundException("Invalid file path")

    const contentType =
      report.format === "csv" ? "text/csv" :
      report.format === "pdf" ? "application/pdf" :
      report.format === "html" ? "text/html" :
      "application/json"

    return { filePath: report.filePath, fileName: `${report.name}.${report.format}`, contentType }
  }

  private async buildReportData(userId: string, type: string, dateFrom?: string, dateTo?: string) {
    const where: any = { userId }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        const d = new Date(dateFrom)
        if (isNaN(d.getTime())) throw new BadRequestException("Invalid dateFrom value")
        where.createdAt.gte = d
      }
      if (dateTo) {
        const d = new Date(dateTo)
        if (isNaN(d.getTime())) throw new BadRequestException("Invalid dateTo value")
        where.createdAt.lte = d
      }
    }

    const base = {
      generatedAt: new Date().toISOString(),
      type,
      dateRange: { from: dateFrom || null, to: dateTo || null },
    }

    switch (type) {
      case "security-audit":
        return this.buildSecurityAudit(userId, where, base)
      case "activity-log":
        return this.buildActivityLog(userId, where, base)
      case "evidence-summary":
        return this.buildEvidenceSummary(userId, where, base)
      case "threat-report":
        return this.buildThreatReport(userId, where, base)
      case "compliance":
        return this.buildCompliance(userId, base)
      default:
        return { ...base, error: "Unknown report type" }
    }
  }

  private async buildSecurityAudit(userId: string, where: any, base: any) {
    const [auditLogs, totalLogs, sessions, activeKeys, evidence, forensics, tamperReports, trustScores] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.auditLog.count({ where }),
      this.prisma.session.findMany({ where: { userId }, orderBy: { lastActive: "desc" }, take: 50 }),
      this.prisma.encryptionKey.findMany({ where: { userId, isActive: true } }),
      this.prisma.evidence.findMany({ where: { userId }, select: { id: true, status: true, createdAt: true } }),
      this.prisma.forensicsReport.findMany({ where: { userId }, select: { threatScore: true, threatLevel: true, overallRisk: true, stegoProbability: true, malwareIndicators: true, analyzedAt: true }, orderBy: { analyzedAt: "desc" }, take: 100 }),
      this.prisma.tamperReport.findMany({ where: { userId }, select: { tamperProbability: true, overallRisk: true, analyzedAt: true }, orderBy: { analyzedAt: "desc" }, take: 100 }),
      this.prisma.trustScore.findMany({ where: { userId }, select: { overallGrade: true, encryptionScore: true, privacyScore: true, integrityScore: true, threatScore: true, stegoRisk: true } }),
    ])

    const actionBreakdown: Record<string, number> = {}
    auditLogs.forEach(log => { actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1 })

    const uniqueIPs = [...new Set(auditLogs.map(l => l.ip))]
    const recentSessions = sessions.slice(0, 5)

    const avgThreatScore = forensics.length > 0
      ? Math.round(forensics.reduce((s, f) => s + f.threatScore, 0) / forensics.length)
      : 0

    const avgTrustGrade = trustScores.length > 0
      ? trustScores.reduce((s, t) => {
          const gradeMap: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 }
          return s + (gradeMap[t.overallGrade] || 0)
        }, 0) / trustScores.length
      : 0

    const trustGrades = ["F", "D", "C", "B", "A"]
    const overallTrustGrade = trustGrades[Math.round(avgTrustGrade)] || "N/A"

    return {
      ...base,
      summary: {
        totalAuditLogs: totalLogs,
        uniqueIPs: uniqueIPs.length,
        activeEncryptionKeys: activeKeys.length,
        totalEvidence: evidence.length,
        totalForensicsReports: forensics.length,
        totalTamperReports: tamperReports.length,
        avgThreatScore,
        overallTrustGrade,
      },
      actionBreakdown,
      recentActivity: auditLogs.slice(0, 20).map(l => ({
        action: l.action,
        resource: l.resource,
        ip: l.ip,
        userAgent: l.userAgent,
        createdAt: l.createdAt,
      })),
      sessions: recentSessions.map(s => ({
        device: s.device,
        browser: s.browser,
        ip: s.ip,
        lastActive: s.lastActive,
        isCurrent: s.isCurrent,
      })),
      threatSummary: {
        totalAnalyzed: forensics.length,
        highThreatCount: forensics.filter(f => f.threatLevel === "HIGH").length,
        mediumThreatCount: forensics.filter(f => f.threatLevel === "MEDIUM").length,
        lowThreatCount: forensics.filter(f => f.threatLevel === "LOW").length,
        malwareDetected: forensics.filter(f => f.malwareIndicators).length,
        avgStegoProbability: forensics.length > 0
          ? +(forensics.reduce((s, f) => s + f.stegoProbability, 0) / forensics.length).toFixed(2)
          : 0,
      },
      tamperSummary: {
        totalAnalyzed: tamperReports.length,
        suspiciousCount: tamperReports.filter(t => (t.tamperProbability || 0) > 0.5).length,
        avgTamperProbability: tamperReports.length > 0
          ? +(tamperReports.reduce((s, t) => s + (t.tamperProbability || 0), 0) / tamperReports.length).toFixed(2)
          : 0,
      },
      trustBreakdown: trustScores.length > 0 ? {
        avgEncryption: +(trustScores.reduce((s, t) => s + t.encryptionScore, 0) / trustScores.length).toFixed(1),
        avgPrivacy: +(trustScores.reduce((s, t) => s + t.privacyScore, 0) / trustScores.length).toFixed(1),
        avgIntegrity: +(trustScores.reduce((s, t) => s + t.integrityScore, 0) / trustScores.length).toFixed(1),
        avgThreat: +(trustScores.reduce((s, t) => s + t.threatScore, 0) / trustScores.length).toFixed(1),
        avgStegoRisk: +(trustScores.reduce((s, t) => s + t.stegoRisk, 0) / trustScores.length).toFixed(1),
      } : null,
      recommendations: this.generateSecurityRecommendations(auditLogs, forensics, tamperReports, trustScores, activeKeys),
    }
  }

  private async buildActivityLog(userId: string, where: any, base: any) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 1000 }),
      this.prisma.auditLog.count({ where }),
    ])

    const dailyActivity: Record<string, number> = {}
    logs.forEach(log => {
      const day = log.createdAt.toISOString().slice(0, 10)
      dailyActivity[day] = (dailyActivity[day] || 0) + 1
    })

    return {
      ...base,
      summary: { totalLogs: total, uniqueActions: [...new Set(logs.map(l => l.action))].length },
      dailyActivity,
      logs: logs.map(l => ({
        id: l.id,
        action: l.action,
        resource: l.resource,
        resourceId: l.resourceId,
        ip: l.ip,
        userAgent: l.userAgent,
        userName: l.userName,
        createdAt: l.createdAt,
      })),
    }
  }

  private async buildEvidenceSummary(userId: string, where: any, base: any) {
    const [evidence, total, statusCounts] = await Promise.all([
      this.prisma.evidence.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 }),
      this.prisma.evidence.count({ where }),
      this.prisma.evidence.groupBy({ by: ["status"], where: { userId }, _count: { status: true } }),
    ])

    const statusBreakdown: Record<string, number> = {}
    statusCounts.forEach(s => {
      const countVal = typeof s._count === "number" ? s._count : (s._count?.status || 0)
      statusBreakdown[s.status] = countVal
    })

    return {
      ...base,
      summary: { totalEvidence: total, statusBreakdown },
      evidence: evidence.map(e => ({
        id: e.id,
        caseId: e.caseId,
        name: e.name,
        type: e.type,
        status: e.status,
        hashAlgorithm: e.hashAlgorithm,
        size: e.size,
        createdAt: e.createdAt,
      })),
    }
  }

  private async buildThreatReport(userId: string, where: any, base: any) {
    const [forensics, total, tamperReports] = await Promise.all([
      this.prisma.forensicsReport.findMany({ where, orderBy: { analyzedAt: "desc" }, take: 200 }),
      this.prisma.forensicsReport.count({ where }),
      this.prisma.tamperReport.findMany({ where: { userId }, orderBy: { analyzedAt: "desc" }, take: 200 }),
    ])

    const threatLevels: Record<string, number> = {}
    forensics.forEach(f => { threatLevels[f.threatLevel] = (threatLevels[f.threatLevel] || 0) + 1 })

    const riskLevels: Record<string, number> = {}
    forensics.forEach(f => { riskLevels[f.overallRisk] = (riskLevels[f.overallRisk] || 0) + 1 })

    return {
      ...base,
      summary: {
        totalForensics: total,
        totalTamper: tamperReports.length,
        threatLevels,
        riskLevels,
        malwareDetected: forensics.filter(f => f.malwareIndicators).length,
        stegoDetected: forensics.filter(f => f.stegoSuspicion).length,
        avgThreatScore: forensics.length > 0
          ? Math.round(forensics.reduce((s, f) => s + f.threatScore, 0) / forensics.length)
          : 0,
      },
      topThreats: forensics
        .filter(f => f.threatLevel === "HIGH" || f.threatLevel === "CRITICAL")
        .slice(0, 20)
        .map(f => ({
          fileName: f.fileName,
          fileType: f.fileType,
          threatScore: f.threatScore,
          threatLevel: f.threatLevel,
          stegoProbability: f.stegoProbability,
          malwareIndicators: f.malwareIndicators,
          overallRisk: f.overallRisk,
          analyzedAt: f.analyzedAt,
        })),
      tamperAnalysis: tamperReports.slice(0, 20).map(t => ({
        fileName: t.fileName,
        tamperProbability: t.tamperProbability,
        overallRisk: t.overallRisk,
        analyzedAt: t.analyzedAt,
      })),
    }
  }

  private async buildCompliance(userId: string, base: any) {
    const [user, sessions, encryptionKeys, auditLogs, apiKeys, totalEvidence, verifiedEvidence] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { isMFAEnabled: true, isVerified: true, createdAt: true } }),
      this.prisma.session.findMany({ where: { userId } }),
      this.prisma.encryptionKey.findMany({ where: { userId } }),
      this.prisma.auditLog.findMany({ where: { userId }, take: 1000 }),
      this.prisma.apiKey.findMany({ where: { userId } }),
      this.prisma.evidence.count({ where: { userId } }),
      this.prisma.evidence.count({ where: { userId, status: "VERIFIED" } }),
    ])

    const activeSessions = sessions.filter(s => {
      const diff = Date.now() - s.lastActive.getTime()
      return diff < 7 * 24 * 60 * 60 * 1000
    })

    const expiredApiKeys = apiKeys.filter(k => k.expiresAt && k.expiresAt < new Date())
    const unusedApiKeys = apiKeys.filter(k => !k.lastUsed)

    const loginIPs = [...new Set(auditLogs.filter(l => l.action.includes("login") || l.action.includes("auth")).map(l => l.ip))]

    return {
      ...base,
      summary: {
        mfaEnabled: user?.isMFAEnabled || false,
        emailVerified: user?.isVerified || false,
        accountAge: user?.createdAt ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0,
        activeSessions: activeSessions.length,
        totalEncryptionKeys: encryptionKeys.length,
        activeEncryptionKeys: encryptionKeys.filter(k => k.isActive).length,
        totalApiKeys: apiKeys.length,
        expiredApiKeys: expiredApiKeys.length,
        unusedApiKeys: unusedApiKeys.length,
        evidenceIntegrity: totalEvidence > 0 ? +((verifiedEvidence / totalEvidence) * 100).toFixed(1) : 100,
        uniqueLoginIPs: loginIPs.length,
      },
      securityScore: this.calculateSecurityScore(user, activeSessions, encryptionKeys, auditLogs, apiKeys),
      findings: this.generateComplianceFindings(user, activeSessions, encryptionKeys, apiKeys, auditLogs),
      recommendations: this.generateComplianceRecommendations(user, activeSessions, encryptionKeys, apiKeys),
    }
  }

  private calculateSecurityScore(user: any, sessions: any[], keys: any[], logs: any[], apiKeys: any[]): number {
    let score = 50
    if (user?.isMFAEnabled) score += 15
    if (user?.isVerified) score += 10
    if (keys.filter(k => k.isActive).length > 0) score += 10
    if (sessions.length <= 3) score += 10
    else if (sessions.length > 10) score -= 5
    if (apiKeys.filter(k => k.expiresAt && k.expiresAt < new Date()).length === 0) score += 5
    return Math.min(100, Math.max(0, score))
  }

  private generateComplianceFindings(user: any, sessions: any[], keys: any[], apiKeys: any[], logs: any[]) {
    const findings: { severity: string; title: string; description: string }[] = []
    if (!user?.isMFAEnabled) findings.push({ severity: "HIGH", title: "MFA not enabled", description: "Multi-factor authentication is not enabled on this account." })
    if (!user?.isVerified) findings.push({ severity: "MEDIUM", title: "Email not verified", description: "Email address has not been verified." })
    if (sessions.length > 5) findings.push({ severity: "LOW", title: "Multiple active sessions", description: `${sessions.length} active sessions detected.` })
    const expiredKeys = apiKeys.filter(k => k.expiresAt && k.expiresAt < new Date())
    if (expiredKeys.length > 0) findings.push({ severity: "MEDIUM", title: "Expired API keys", description: `${expiredKeys.length} API key(s) have expired and should be revoked.` })
    const unusedKeys = apiKeys.filter(k => !k.lastUsed)
    if (unusedKeys.length > 0) findings.push({ severity: "LOW", title: "Unused API keys", description: `${unusedKeys.length} API key(s) have never been used.` })
    if (keys.filter(k => k.isActive).length === 0) findings.push({ severity: "HIGH", title: "No active encryption keys", description: "No active encryption keys found for this account." })
    return findings
  }

  private generateComplianceRecommendations(user: any, sessions: any[], keys: any[], apiKeys: any[]) {
    const recs: string[] = []
    if (!user?.isMFAEnabled) recs.push("Enable multi-factor authentication for enhanced security.")
    if (!user?.isVerified) recs.push("Verify your email address to enable full account features.")
    if (sessions.length > 5) recs.push("Review and close unused active sessions.")
    if (apiKeys.filter(k => !k.lastUsed).length > 0) recs.push("Revoke unused API keys to reduce attack surface.")
    if (keys.filter(k => k.isActive).length === 0) recs.push("Generate at least one encryption key for secure communications.")
    if (recs.length === 0) recs.push("Your security posture looks good. Continue monitoring.")
    return recs
  }

  private generateSecurityRecommendations(logs: any[], forensics: any[], tamper: any[], trust: any[], keys: any[]) {
    const recs: string[] = []
    const highThreats = forensics.filter(f => f.threatLevel === "HIGH" || f.threatLevel === "CRITICAL")
    if (highThreats.length > 0) recs.push(`${highThreats.length} high-threat file(s) detected. Review and quarantine immediately.`)
    const malwareCount = forensics.filter(f => f.malwareIndicators).length
    if (malwareCount > 0) recs.push(`${malwareCount} file(s) with malware indicators. Run deep analysis.`)
    const suspiciousTamper = tamper.filter(t => (t.tamperProbability || 0) > 0.5)
    if (suspiciousTamper.length > 0) recs.push(`${suspiciousTamper.length} file(s) with high tamper probability. Verify integrity.`)
    if (keys.length === 0) recs.push("No active encryption keys. Generate keys for secure file handling.")
    const uniqueIPs = [...new Set(logs.map(l => l.ip))]
    if (uniqueIPs.length > 5) recs.push(`${uniqueIPs.length} unique IPs detected. Review for unauthorized access.`)
    if (recs.length === 0) recs.push("No critical security issues found. Continue regular monitoring.")
    return recs
  }

  private formatContent(format: string, name: string, data: any): string {
    if (format === "csv") return this.toCSV(data)
    if (format === "html" || format === "pdf") return this.toHTML(name, data)
    return JSON.stringify(data, null, 2)
  }

  private toCSV(data: any): string {
    const flatten = (obj: any, prefix = ""): Record<string, string> => {
      const result: Record<string, string> = {}
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key
        if (value && typeof value === "object" && !Array.isArray(value)) {
          Object.assign(result, flatten(value, path))
        } else if (Array.isArray(value)) {
          result[path] = JSON.stringify(value)
        } else {
          result[path] = String(value ?? "")
        }
      }
      return result
    }
    const flat = flatten(data)
    const headers = Object.keys(flat).join(",")
    const values = Object.values(flat).map(v => `"${v.replace(/"/g, '""')}"`).join(",")
    return headers + "\n" + values
  }

  private toHTML(name: string, data: any): string {
    const sections = this.buildHTMLSections(data)
    const safeName = escapeHtml(name)
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 40px; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { font-size: 28px; color: #38bdf8; margin-bottom: 8px; border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; }
    .meta { color: #94a3b8; font-size: 13px; margin-bottom: 32px; }
    .section { background: #1e293b; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #334155; }
    .section h2 { font-size: 18px; color: #38bdf8; margin-bottom: 16px; }
    .section h3 { font-size: 14px; color: #94a3b8; margin: 12px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .stat { background: #0f172a; border-radius: 8px; padding: 16px; border: 1px solid #334155; }
    .stat .value { font-size: 28px; font-weight: 700; color: #38bdf8; }
    .stat .label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .badge.high { background: #7f1d1d; color: #fca5a5; }
    .badge.medium { background: #78350f; color: #fcd34d; }
    .badge.low { background: #064e3b; color: #6ee7b7; }
    .badge.good { background: #064e3b; color: #6ee7b7; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; border-bottom: 2px solid #334155; color: #94a3b8; font-size: 11px; text-transform: uppercase; }
    td { padding: 10px 12px; border-bottom: 1px solid #1e3a5f; }
    tr:hover td { background: #0f172a; }
    .recommendation { padding: 10px 16px; background: #0f172a; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid #38bdf8; font-size: 13px; }
    .score-bar { height: 8px; border-radius: 4px; background: #334155; overflow: hidden; margin-top: 8px; }
    .score-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #ef4444, #f59e0b, #22c55e); }
    @media print { body { background: white; color: #1e293b; } .section { border-color: #e2e8f0; background: #f8fafc; } .stat { background: white; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>${safeName}</h1>
    <p class="meta">Generated: ${toSafeValue(data.generatedAt)} | Type: ${toSafeValue(data.type)} | Date Range: ${toSafeValue(data.dateRange?.from) || "All time"} to ${toSafeValue(data.dateRange?.to) || "Now"}</p>
    ${sections}
  </div>
</body>
</html>`
  }

  private buildHTMLSections(data: any): string {
    let html = ""

    if (data.summary) {
      html += `<div class="section"><h2>Summary</h2><div class="stat-grid">`
      for (const [key, value] of Object.entries(data.summary)) {
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())
        if (value && typeof value === "object" && !Array.isArray(value)) {
          for (const [subKey, subVal] of Object.entries(value)) {
            const subLabel = `${label} (${subKey})`
            html += `<div class="stat"><div class="value">${toSafeValue(subVal)}</div><div class="label">${escapeHtml(subLabel)}</div></div>`
          }
        } else {
          html += `<div class="stat"><div class="value">${toSafeValue(value)}</div><div class="label">${escapeHtml(label)}</div></div>`
        }
      }
      html += `</div></div>`
    }

    if (data.securityScore !== undefined) {
      html += `<div class="section"><h2>Security Score</h2>
        <div style="font-size:48px;font-weight:700;color:${data.securityScore >= 70 ? "#22c55e" : data.securityScore >= 40 ? "#f59e0b" : "#ef4444"}">${toSafeValue(data.securityScore)}/100</div>
        <div class="score-bar"><div class="score-fill" style="width:${data.securityScore}%"></div></div></div>`
    }

    if (data.findings?.length > 0) {
      html += `<div class="section"><h2>Findings</h2><table><tr><th>Severity</th><th>Finding</th><th>Details</th></tr>`
      data.findings.forEach((f: any) => {
        html += `<tr><td><span class="badge ${f.severity.toLowerCase()}">${escapeHtml(f.severity)}</span></td><td>${escapeHtml(f.title)}</td><td>${escapeHtml(f.description)}</td></tr>`
      })
      html += `</table></div>`
    }

    if (data.recommendations?.length > 0) {
      html += `<div class="section"><h2>Recommendations</h2>`
      data.recommendations.forEach((r: string) => { html += `<div class="recommendation">${escapeHtml(r)}</div>` })
      html += `</div>`
    }

    if (data.recentActivity?.length > 0) {
      html += `<div class="section"><h2>Recent Activity</h2><table><tr><th>Action</th><th>Resource</th><th>IP</th><th>Date</th></tr>`
      data.recentActivity.forEach((l: any) => {
        html += `<tr><td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.resource)}</td><td>${escapeHtml(l.ip)}</td><td>${escapeHtml(new Date(l.createdAt).toLocaleDateString())}</td></tr>`
      })
      html += `</table></div>`
    }

    if (data.logs?.length > 0) {
      html += `<div class="section"><h2>Activity Logs</h2><table><tr><th>Date</th><th>User</th><th>Action</th><th>Resource</th><th>IP</th></tr>`
      data.logs.slice(0, 100).forEach((l: any) => {
        html += `<tr><td>${escapeHtml(new Date(l.createdAt).toLocaleDateString())}</td><td>${escapeHtml(l.userName)}</td><td>${escapeHtml(l.action)}</td><td>${escapeHtml(l.resource)}</td><td>${escapeHtml(l.ip)}</td></tr>`
      })
      html += `</table></div>`
    }

    if (data.topThreats?.length > 0) {
      html += `<div class="section"><h2>Top Threats</h2><table><tr><th>File</th><th>Type</th><th>Score</th><th>Level</th><th>Stego</th><th>Malware</th></tr>`
      data.topThreats.forEach((t: any) => {
        html += `<tr><td>${escapeHtml(t.fileName)}</td><td>${escapeHtml(t.fileType)}</td><td>${toSafeValue(t.threatScore)}</td><td><span class="badge ${t.threatLevel.toLowerCase()}">${escapeHtml(t.threatLevel)}</span></td><td>${(t.stegoProbability * 100).toFixed(0)}%</td><td>${t.malwareIndicators ? "Yes" : "No"}</td></tr>`
      })
      html += `</table></div>`
    }

    if (data.evidence?.length > 0) {
      html += `<div class="section"><h2>Evidence Items</h2><table><tr><th>Name</th><th>Type</th><th>Status</th><th>Case</th><th>Date</th></tr>`
      data.evidence.forEach((e: any) => {
        html += `<tr><td>${escapeHtml(e.name)}</td><td>${escapeHtml(e.type)}</td><td><span class="badge ${e.status === "VERIFIED" ? "good" : "low"}">${escapeHtml(e.status)}</span></td><td>${escapeHtml(e.caseId)}</td><td>${escapeHtml(new Date(e.createdAt).toLocaleDateString())}</td></tr>`
      })
      html += `</table></div>`
    }

    if (data.dailyActivity) {
      html += `<div class="section"><h2>Daily Activity</h2><table><tr><th>Date</th><th>Actions</th></tr>`
      for (const [day, count] of Object.entries(data.dailyActivity).sort().reverse().slice(0, 30)) {
        html += `<tr><td>${escapeHtml(day)}</td><td>${toSafeValue(count)}</td></tr>`
      }
      html += `</table></div>`
    }

    if (data.sessions?.length > 0) {
      html += `<div class="section"><h2>Active Sessions</h2><table><tr><th>Device</th><th>Browser</th><th>IP</th><th>Last Active</th><th>Current</th></tr>`
      data.sessions.forEach((s: any) => {
        html += `<tr><td>${escapeHtml(s.device)}</td><td>${escapeHtml(s.browser)}</td><td>${escapeHtml(s.ip)}</td><td>${escapeHtml(new Date(s.lastActive).toLocaleDateString())}</td><td>${s.isCurrent ? "Yes" : "No"}</td></tr>`
      })
      html += `</table></div>`
    }

    if (data.threatSummary) {
      html += `<div class="section"><h2>Threat Summary</h2><div class="stat-grid">`
      for (const [key, value] of Object.entries(data.threatSummary)) {
        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())
        html += `<div class="stat"><div class="value">${toSafeValue(value)}</div><div class="label">${escapeHtml(label)}</div></div>`
      }
      html += `</div></div>`
    }

    return html
  }
}
