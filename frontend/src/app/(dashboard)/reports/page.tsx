"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  FileText, Download, Loader2, Search, Trash2, Calendar,
  FileSpreadsheet, FileJson, FileType, AlertCircle, Eye,
  RefreshCw, X, Plus, Shield, ShieldCheck, ShieldAlert, Activity,
  CheckCircle, AlertTriangle, Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/layout/empty-state"
import { TableSkeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDebounce } from "@/hooks/useDebounce"
import { api, ApiError } from "@/lib/api"
import toast from "react-hot-toast"

interface Report {
  id: string
  name?: string
  format?: string
  status?: string
  createdAt: string
  type?: string
}

interface ReportData {
  summary?: Record<string, unknown>
  securityScore?: number
  findings?: { severity: string; title: string; description: string }[]
  recommendations?: string[]
  recentActivity?: { action: string; resource: string; ip: string; createdAt: string }[]
  topThreats?: { fileName: string; fileType: string; threatScore: number; threatLevel: string }[]
  evidence?: { name: string; type: string; status: string; caseId: string }[]
  dailyActivity?: Record<string, number>
  sessions?: { device: string; browser: string; ip: string; lastActive: string; isCurrent: boolean }[]
  logs?: { action: string; resource: string; ip: string; userName: string; createdAt: string }[]
  threatSummary?: Record<string, number>
  tamperSummary?: Record<string, number>
  trustBreakdown?: Record<string, number>
  dateRange?: { from: string | null; to: string | null }
  generatedAt?: string
  type?: string
}

interface GenerateResponse {
  id: string; userId: string; name: string; format: string; status: string; createdAt: string
}

const reportTypes = [
  { value: "security-audit", label: "Security Audit", icon: Shield, desc: "Comprehensive security posture analysis", color: "text-blue-400" },
  { value: "evidence-summary", label: "Evidence Summary", icon: FileSpreadsheet, desc: "All evidence items and chain of custody", color: "text-purple-400" },
  { value: "threat-report", label: "Threat Report", icon: ShieldAlert, desc: "Threat analysis and risk assessment", color: "text-red-400" },
  { value: "activity-log", label: "Activity Log", icon: Activity, desc: "Complete user activity audit trail", color: "text-green-400" },
  { value: "compliance", label: "Compliance Report", icon: ShieldCheck, desc: "Security compliance status and gaps", color: "text-amber-400" },
]

const formatIcons: Record<string, typeof FileText> = {
  pdf: FileType,
  csv: FileSpreadsheet,
  json: FileJson,
  html: FileText,
}

const formatLabels: Record<string, string> = {
  "security-audit": "Security Audit",
  "evidence-summary": "Evidence Summary",
  "threat-report": "Threat Report",
  "activity-log": "Activity Log",
  compliance: "Compliance",
}

function getFormatIcon(format?: string) {
  return format ? formatIcons[format.toLowerCase()] || FileText : FileText
}

function getSeverityColor(severity: string) {
  switch (severity.toLowerCase()) {
    case "high":
    case "critical":
      return "text-red-400 bg-red-500/10 border-red-500/20"
    case "medium":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20"
    case "low":
      return "text-green-400 bg-green-500/10 border-green-500/20"
    default:
      return "text-slate-400 bg-slate-500/10 border-slate-500/20"
  }
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-green-400"
  if (score >= 40) return "text-amber-400"
  return "text-red-400"
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Excellent"
  if (score >= 60) return "Good"
  if (score >= 40) return "Fair"
  return "Poor"
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [reportType, setReportType] = useState("security-audit")
  const [reportName, setReportName] = useState("")
  const [reportFormat, setReportFormat] = useState("html")
  const [reportFrom, setReportFrom] = useState("")
  const [reportTo, setReportTo] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Report | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [previewTarget, setPreviewTarget] = useState<Report | null>(null)
  const [previewData, setPreviewData] = useState<ReportData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<Report[]>("/reports")
      setReports(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load reports")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReports() }, [fetchReports])

  const generateReport = async () => {
    setGenerating(true)
    try {
      const payload: Record<string, unknown> = {
        format: reportFormat,
        type: reportType,
        name: reportName.trim() || `${reportType}-${new Date().toISOString().slice(0, 10)}`,
      }
      if (reportFrom) payload.dateFrom = reportFrom
      if (reportTo) payload.dateTo = reportTo
      const data = await api.post<GenerateResponse>("/reports/generate", payload)
      const newReport: Report = {
        id: data.id,
        name: data.name || (payload.name as string),
        format: data.format,
        status: data.status || "completed",
        createdAt: data.createdAt,
        type: reportType,
      }
      setReports(prev => [newReport, ...prev])
      setActiveTab("all")
      setReportName("")
      toast.success("Report generated successfully")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to generate report")
    } finally {
      setGenerating(false)
    }
  }

  const deleteReport = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const id = deleteTarget.id
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await api.delete(`/reports/${id}`)
      setReports(prev => prev.filter(r => r.id !== id))
      toast.success("Report deleted")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
      setReports(prev => [target, ...prev])
    } finally {
      setDeleting(false)
    }
  }

  const downloadReport = async (report: Report) => {
    try {
      const blob = await api.download(`/reports/${report.id}/download`)
      const ext = report.format || "json"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${report.name || "report"}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Download started")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Download failed")
    }
  }

  const loadPreview = async (report: Report) => {
    setPreviewTarget(report)
    setPreviewLoading(true)
    setPreviewData(null)
    try {
      const data = await api.get<ReportData & { data?: ReportData }>(`/reports/${report.id}`)
      setPreviewData(data.data || data)
    } catch (err) {
      setPreviewData(null)
      toast.error(err instanceof ApiError ? err.message : "Failed to load preview")
    } finally {
      setPreviewLoading(false)
    }
  }

  const filteredReports = useMemo(() => {
    if (!debouncedSearch) return reports
    const q = debouncedSearch.toLowerCase()
    return reports.filter(
      r => (r.name && r.name.toLowerCase().includes(q)) ||
           (r.type && r.type.toLowerCase().includes(q)) ||
           (r.format && r.format.toLowerCase().includes(q))
    )
  }, [reports, debouncedSearch])

  const selectedReportType = reportTypes.find(t => t.value === reportType)
  const TypeIcon = selectedReportType?.icon || FileText

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and download security, investigation, and audit reports"
        action={{ label: "New Report", icon: Plus, onClick: () => setActiveTab("generate") }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Reports ({reports.length})</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {loading ? (
            <TableSkeleton rows={6} cols={3} />
          ) : error ? (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <AlertCircle className="h-10 w-10 text-destructive mb-4" />
                <p className="text-lg font-semibold mb-2">Failed to load reports</p>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button variant="cyber" onClick={fetchReports}>Retry</Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search reports by name, type, or format..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={fetchReports}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </div>

              {filteredReports.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title={searchQuery ? "No reports match your search" : "No reports yet"}
                  description={searchQuery ? "Try a different search term." : "Generate a report to get started with security analysis."}
                  action={searchQuery ? undefined : { label: "Generate Report", onClick: () => setActiveTab("generate") }}
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredReports.map((r) => {
                    const FormatIcon = getFormatIcon(r.format)
                    const typeInfo = reportTypes.find(t => t.value === r.type)
                    return (
                      <Card key={r.id} className="glass-card hover:border-cyber-500/30 transition-all duration-200 group">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-muted">
                                {typeInfo ? <typeInfo.icon className={`h-5 w-5 ${typeInfo.color}`} /> : <FormatIcon className="h-5 w-5 text-cyber-400" />}
                              </div>
                              <div>
                                <Badge variant="outline" className="text-[10px] mb-1">
                                  {formatLabels[r.type || ""] || r.type || r.format || "report"}
                                </Badge>
                                <p className="text-sm font-medium truncate max-w-[180px]">{r.name || "Untitled Report"}</p>
                              </div>
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => loadPreview(r)}
                                title="Preview"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => downloadReport(r)}
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(r)}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            <span className="text-cyber-500">|</span>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{r.format?.toUpperCase()}</Badge>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-green-500/10 text-green-400">{r.status}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="generate">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-cyber-400" />
                    Generate New Report
                  </CardTitle>
                  <CardDescription>Select a report type, configure options, and generate</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="text-sm font-medium mb-3 block">Report Type</label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {reportTypes.map((t) => {
                        const Icon = t.icon
                        const isSelected = reportType === t.value
                        return (
                          <button
                            key={t.value}
                            className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                              isSelected
                                ? "border-cyber-500/50 bg-cyber-500/5 ring-1 ring-cyber-500/20"
                                : "border-border hover:border-cyber-500/30 bg-muted/20 hover:bg-muted/40"
                            }`}
                            onClick={() => setReportType(t.value)}
                          >
                            <div className={`p-2.5 rounded-lg ${isSelected ? "bg-cyber-500/20" : "bg-muted"}`}>
                              <Icon className={`h-5 w-5 ${isSelected ? t.color : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{t.label}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                            </div>
                            {isSelected && <CheckCircle className="h-4 w-4 text-cyber-400 shrink-0 mt-0.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Report Name</label>
                      <Input
                        placeholder={`${reportType}-${new Date().toISOString().slice(0, 10)}`}
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Format</label>
                      <select
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium"
                        value={reportFormat}
                        onChange={(e) => setReportFormat(e.target.value)}
                      >
                        <option value="html">HTML (Recommended)</option>
                        <option value="pdf">PDF (Printable Forensic Document)</option>
                        <option value="json">JSON Data Export</option>
                        <option value="csv">CSV Spreadsheet</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        Date From
                      </label>
                      <Input
                        type="date"
                        value={reportFrom}
                        onChange={(e) => setReportFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        Date To
                      </label>
                      <Input
                        type="date"
                        value={reportTo}
                        onChange={(e) => setReportTo(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="text-sm">Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border">
                    {selectedReportType && <selectedReportType.icon className={`h-10 w-10 ${selectedReportType.color}`} />}
                    <div>
                      <p className="text-sm font-medium">{selectedReportType?.label}</p>
                      <p className="text-xs text-muted-foreground capitalize">{reportFormat} format</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Report Type</span>
                      <span className="text-foreground">{selectedReportType?.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Format</span>
                      <span className="text-foreground uppercase">{reportFormat}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date Range</span>
                      <span className="text-foreground">{reportFrom || "Start"} to {reportTo || "Now"}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-[11px] text-muted-foreground">
                      {reportType === "security-audit" && "Includes threat analysis, trust scores, session data, and recommendations."}
                      {reportType === "evidence-summary" && "Lists all evidence with status, type, and case information."}
                      {reportType === "threat-report" && "Forensics analysis, tamper detection, and malware indicators."}
                      {reportType === "activity-log" && "Complete audit trail with daily activity breakdown."}
                      {reportType === "compliance" && "Security score, findings, and actionable recommendations."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Button
                variant="cyber"
                className="w-full h-11"
                onClick={generateReport}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                {generating ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => !deleting && setDeleteTarget(null)}
        onConfirm={deleteReport}
        title="Delete Report"
        description={`Are you sure you want to delete "${deleteTarget?.name || "this report"}"? This action cannot be undone.`}
        confirmLabel="Delete Report"
        variant="destructive"
        loading={deleting}
      />

      {previewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreviewTarget(null)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <Card
            className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
              <div>
                <CardTitle className="text-lg">{previewTarget.name || "Report Preview"}</CardTitle>
                <CardDescription>
                  {formatLabels[previewTarget.type || ""] || previewTarget.type} | {previewTarget.format?.toUpperCase()} | {new Date(previewTarget.createdAt).toLocaleString()}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => downloadReport(previewTarget)}>
                  <Download className="mr-2 h-4 w-4" /> Download
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setPreviewTarget(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {previewLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-cyber-400" />
                </div>
              ) : previewData ? (
                <ReportPreview data={previewData} type={previewTarget.type} />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-3" />
                  <p>Failed to load report data</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function ReportPreview({ data, type }: { data: ReportData; type?: string }) {
  if (!data) return null

  return (
    <div className="p-6 space-y-6">
      {data.securityScore !== undefined && (
        <div className="flex items-center gap-6 p-6 rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 border border-border">
          <div className="text-center">
            <div className={`text-5xl font-bold ${getScoreColor(data.securityScore)}`}>
              {data.securityScore}
            </div>
            <div className="text-xs text-muted-foreground mt-1">out of 100</div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Security Score</h3>
            <p className="text-sm text-muted-foreground">{getScoreLabel(data.securityScore)}</p>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  data.securityScore >= 70 ? "bg-green-500" : data.securityScore >= 40 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${data.securityScore}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {data.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(data.summary).map(([key, value]) => (
            <div key={key} className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="text-lg font-bold text-foreground">{String(value)}</div>
              <div className="text-[11px] text-muted-foreground capitalize">
                {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.findings && data.findings.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            Findings ({data.findings.length})
          </h3>
          <div className="space-y-2">
            {data.findings.map((f, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${getSeverityColor(f.severity)}`}>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${getSeverityColor(f.severity)}`}>
                  {f.severity}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{f.title}</p>
                  <p className="text-xs opacity-75 mt-0.5">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.recommendations && data.recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyber-400" />
            Recommendations
          </h3>
          <div className="space-y-2">
            {data.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                <CheckCircle className="h-4 w-4 text-cyber-400 shrink-0 mt-0.5" />
                <p className="text-sm">{r}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.topThreats && data.topThreats.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-400" />
            Top Threats ({data.topThreats.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">File</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Score</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Level</th>
                </tr>
              </thead>
              <tbody>
                {data.topThreats.slice(0, 10).map((t, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium truncate max-w-[200px]">{t.fileName}</td>
                    <td className="py-2 px-3 text-muted-foreground">{t.fileType}</td>
                    <td className="py-2 px-3">
                      <span className={`font-mono ${getScoreColor(t.threatScore)}`}>{t.threatScore}</span>
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant="outline" className={`text-[10px] ${getSeverityColor(t.threatLevel)}`}>
                        {t.threatLevel}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.recentActivity && data.recentActivity.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-green-400" />
            Recent Activity ({data.recentActivity.length})
          </h3>
          <div className="space-y-1">
            {data.recentActivity.slice(0, 15).map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 text-sm">
                <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">
                  {new Date(a.createdAt).toLocaleDateString()}
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">{a.action}</Badge>
                <span className="text-muted-foreground truncate">{a.resource}</span>
                <span className="ml-auto text-xs text-muted-foreground font-mono">{a.ip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.evidence && data.evidence.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">Evidence Items ({data.evidence.length})</h3>
          <div className="space-y-1">
            {data.evidence.slice(0, 20).map((e, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium truncate">{e.name}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">{e.type}</Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${e.status === "VERIFIED" ? "text-green-400 bg-green-500/10" : "text-muted-foreground"}`}
                >
                  {e.status}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">{e.caseId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.sessions && data.sessions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">Active Sessions ({data.sessions.length})</h3>
          <div className="space-y-1">
            {data.sessions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30 text-sm">
                <div className={`h-2 w-2 rounded-full ${s.isCurrent ? "bg-green-400" : "bg-muted-foreground"}`} />
                <span className="font-medium">{s.device}</span>
                <span className="text-muted-foreground">{s.browser}</span>
                <span className="text-xs font-mono text-muted-foreground">{s.ip}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(s.lastActive).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.dailyActivity && (
        <div>
          <h3 className="text-sm font-medium mb-3">Daily Activity</h3>
          <div className="grid grid-cols-7 gap-1">
            {Object.entries(data.dailyActivity)
              .sort()
              .slice(-28)
              .map(([day, count]) => (
                <div key={day} className="text-center">
                  <div
                    className="h-8 rounded-sm bg-cyber-500/20 flex items-center justify-center text-[10px] font-mono"
                    style={{ opacity: Math.min(1, 0.2 + (count as number) * 0.2) }}
                  >
                    {count as number}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{day.slice(5)}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {data.threatSummary && (
        <div>
          <h3 className="text-sm font-medium mb-3">Threat Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(data.threatSummary).map(([key, value]) => (
              <div key={key} className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-lg font-bold">{String(value)}</div>
                <div className="text-[11px] text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.tamperSummary && (
        <div>
          <h3 className="text-sm font-medium mb-3">Tamper Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(data.tamperSummary).map(([key, value]) => (
              <div key={key} className="p-3 rounded-lg bg-muted/30 border border-border">
                <div className="text-lg font-bold">{String(value)}</div>
                <div className="text-[11px] text-muted-foreground capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.trustBreakdown && (
        <div>
          <h3 className="text-sm font-medium mb-3">Trust Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(data.trustBreakdown).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-32 shrink-0 capitalize">
                  {key.replace(/([A-Z])/g, " $1").replace(/^avg /, "")}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cyber-500 transition-all duration-500"
                    style={{ width: `${Math.min(100, (value as number) * 10)}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-8 text-right">{value as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.logs && data.logs.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">Activity Logs ({data.logs.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">User</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Action</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Resource</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.slice(0, 30).map((l, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2 px-3 text-xs font-mono">{new Date(l.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 px-3">{l.userName}</td>
                    <td className="py-2 px-3"><Badge variant="outline" className="text-[10px]">{l.action}</Badge></td>
                    <td className="py-2 px-3 text-muted-foreground">{l.resource}</td>
                    <td className="py-2 px-3 text-xs font-mono text-muted-foreground">{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground text-center pt-4 border-t border-border">
        Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "N/A"}
      </div>
    </div>
  )
}
