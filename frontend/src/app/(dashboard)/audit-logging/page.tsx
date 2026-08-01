"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import {
  ScrollText, Search, Filter, Download, Loader2, X,
  ChevronDown, ChevronUp, Calendar, RefreshCw, FileJson,
  AlertCircle, User, Globe, Activity,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/layout/empty-state"
import { TableSkeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@/hooks/useDebounce"
import { api, ApiError } from "@/lib/api"
import toast from "react-hot-toast"
import type { AuditLog } from "@/types"

interface AuditLogsResponse {
  logs: AuditLog[]
  total: number
  page: number
  limit: number
}

const actionTypes = [
  { value: "", label: "All Actions" },
  { value: "auth.login", label: "Login" },
  { value: "auth.logout", label: "Logout" },
  { value: "auth.register", label: "Register" },
  { value: "auth.password.change", label: "Password Change" },
  { value: "auth.mfa.setup", label: "MFA Setup" },
  { value: "auth.mfa.verify", label: "MFA Verify" },
  { value: "share.link.create", label: "Share Create" },
  { value: "share.link.access", label: "Share Access" },
  { value: "share.link.delete", label: "Share Delete" },
  { value: "evidence.upload", label: "Evidence Upload" },
  { value: "evidence.download", label: "Evidence Download" },
  { value: "evidence.status.change", label: "Status Change" },
  { value: "watermark.invisible.embed", label: "Invisible Watermark" },
  { value: "watermark.visible.embed", label: "Visible Watermark" },
  { value: "team.invite.pending", label: "Team Invite" },
  { value: "team.member.removed", label: "Member Removed" },
  { value: "admin.broadcast", label: "Broadcast" },
]

function generateAuditPdfReport(logs: AuditLog[]) {
  const printWindow = window.open("", "_blank")
  if (!printWindow) return

  const rowsHtml = logs.map(l => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #1e293b;font-weight:600;color:#f1f5f9;">${l.userName}</td>
      <td style="padding:10px;border-bottom:1px solid #1e293b;"><span style="background:rgba(124,58,237,0.25);color:#c084fc;padding:3px 8px;border-radius:6px;font-family:monospace;font-size:11px;font-weight:600;border:1px solid rgba(192,132,252,0.4);">${l.action}</span></td>
      <td style="padding:10px;border-bottom:1px solid #1e293b;color:#94a3b8;">${l.resource}${l.resourceId ? ` #${l.resourceId.slice(0, 8)}` : ""}</td>
      <td style="padding:10px;border-bottom:1px solid #1e293b;font-family:monospace;color:#38bdf8;font-weight:600;">${l.ip}</td>
      <td style="padding:10px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:11px;">${new Date(l.createdAt).toLocaleString()}</td>
    </tr>
  `).join("")

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>StegShield X — Audit Log Forensic Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0b0f19; color: #f8fafc; margin: 0; padding: 32px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #38bdf8; padding-bottom: 20px; margin-bottom: 24px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-icon { font-size: 28px; }
          .title { font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #38bdf8, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .subtitle { font-size: 13px; color: #94a3b8; margin-top: 4px; font-weight: 500; }
          .meta { font-size: 11px; color: #64748b; text-align: right; line-height: 1.6; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th { text-align: left; padding: 12px 10px; background: #1e293b; color: #38bdf8; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; font-weight: 700; border-bottom: 2px solid #334155; }
          .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 16px; }
          @media print {
            body { background: #000 !important; color: #fff !important; }
            th { background: #111 !important; color: #38bdf8 !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <span class="brand-icon">🛡️</span>
            <div>
              <div class="title">StegShield X — Forensic Audit Trail Report</div>
              <div class="subtitle">Complete Log Verification & Chain of Custody Audit</div>
            </div>
          </div>
          <div class="meta">
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
            <div><strong>Total Log Entries:</strong> ${logs.length}</div>
            <div><strong>Security Level:</strong> RESTRICTED / CLASSIFIED</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Resource</th>
              <th>IP Address</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          StegShield X Cybersecurity & Digital Forensics Platform — Official System Audit Trail
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

export default function AuditLoggingPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [actionFilter, setActionFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "pdf">("csv")
  const [exporting, setExporting] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const limit = 20

  const debouncedSearch = useDebounce(searchQuery, 300)

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (actionFilter) params.set("action", actionFilter)
      if (dateFrom) params.set("from", dateFrom)
      if (dateTo) params.set("to", dateTo)
      const data = await api.get<AuditLogsResponse>(`/audit?${params.toString()}`)
      setLogs(data.logs)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load audit logs")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, actionFilter, dateFrom, dateTo])

  useEffect(() => { fetchLogs(page) }, [page, fetchLogs])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => fetchLogs(page), 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchLogs, page])

  const filteredLogs = useMemo(() => {
    let result = logs
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(
        l => l.userName.toLowerCase().includes(q) ||
             l.action.toLowerCase().includes(q) ||
             l.resource.toLowerCase().includes(q) ||
             l.ip.includes(q) ||
             (l.resourceId && l.resourceId.includes(q))
      )
    }
    if (actionFilter) {
      result = result.filter(l => l.action === actionFilter)
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime()
      result = result.filter(l => new Date(l.createdAt).getTime() >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000
      result = result.filter(l => new Date(l.createdAt).getTime() <= to)
    }
    return result
  }, [logs, debouncedSearch, actionFilter, dateFrom, dateTo])

  const exportLogs = async () => {
    setExporting(true)
    try {
      if (exportFormat === "csv") {
        const headers = ["User", "Action", "Resource", "Resource ID", "IP", "User Agent", "Date"]
        const csv = [
          headers.join(","),
          ...filteredLogs.map(l =>
            [l.userName, l.action, l.resource, l.resourceId || "", l.ip, `"${l.userAgent}"`, new Date(l.createdAt).toISOString()].join(",")
          ),
        ].join("\n")
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url; a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${filteredLogs.length} log entries to CSV`)
      } else if (exportFormat === "json") {
        const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url; a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.json`; a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${filteredLogs.length} log entries to JSON`)
      } else if (exportFormat === "pdf") {
        generateAuditPdfReport(filteredLogs)
        toast.success(`Generated PDF report with ${filteredLogs.length} log entries`)
      }
    } catch {
      toast.error("Failed to export logs")
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  const clearFilters = () => {
    setSearchQuery("")
    setActionFilter("")
    setDateFrom("")
    setDateTo("")
    setPage(1)
  }

  const hasActiveFilters = searchQuery || actionFilter || dateFrom || dateTo

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logging"
        description="Complete audit trail of all security operations"
        action={{
          label: exportFormat === "csv" ? "Export CSV" : exportFormat === "pdf" ? "Export PDF" : "Export JSON",
          icon: Download,
          onClick: exportLogs,
        }}
      />

      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 pr-8"
                placeholder="Search logs by user, action, resource, or IP..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => { setSearchQuery(""); setPage(1) }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={hasActiveFilters ? "border-cyber-500/50" : ""}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {hasActiveFilters && <Badge variant="cyber" className="ml-2 text-[10px] h-4">!</Badge>}
              </Button>
              <Button
                variant={autoRefresh ? "cyber" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                title={autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}
              >
                <RefreshCw className={`h-4 w-4 ${autoRefresh ? "animate-spin" : ""}`} />
              </Button>
              <select
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-semibold uppercase tracking-wider text-cyan-300 border-cyan-500/30 bg-violet-950/20"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as "csv" | "json" | "pdf")}
              >
                <option value="csv" className="bg-background text-foreground">CSV</option>
                <option value="pdf" className="bg-background text-foreground">PDF</option>
                <option value="json" className="bg-background text-foreground">JSON</option>
              </select>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{total} entries</span>
            </div>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
                >
                  {actionTypes.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  className="h-8 w-36 text-xs"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  placeholder="From"
                />
                <span className="text-xs text-muted-foreground">—</span>
                <Input
                  type="date"
                  className="h-8 w-36 text-xs"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  placeholder="To"
                />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="text-xs h-8" onClick={clearFilters}>
                  <X className="mr-1 h-3 w-3" /> Clear
                </Button>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {loading ? (
            <TableSkeleton rows={8} cols={4} />
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-10 w-10 text-destructive mb-4" />
              <p className="text-lg font-semibold mb-2">Failed to load logs</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button variant="cyber" onClick={() => fetchLogs(page)}>Retry</Button>
            </div>
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={hasActiveFilters ? "No logs match your filters" : "No audit logs yet"}
              description={hasActiveFilters ? "Try adjusting your search or filter criteria." : "Security events will appear here as they occur."}
              action={hasActiveFilters ? { label: "Clear Filters", onClick: clearFilters } : undefined}
            />
          ) : (
            <>
              <div className="space-y-1">
                {filteredLogs.map((log) => (
                  <div key={log.id}>
                    <button
                      className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-sm text-left"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-2 w-2 rounded-full bg-cyber-400 shrink-0" />
                        <span className="font-medium min-w-[100px] truncate">{log.userName}</span>
                        <Badge variant="outline" className="text-[10px] font-mono shrink-0">{log.action}</Badge>
                        <span className="text-muted-foreground truncate hidden md:inline">{log.resource}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-2">
                        <span className="hidden lg:inline">{log.ip}</span>
                        <span className="whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</span>
                        {expandedId === log.id ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </div>
                    </button>
                    {expandedId === log.id && (
                      <div className="mx-3 mb-1 p-3 rounded-lg bg-muted/30 text-xs space-y-2 animate-in slide-in-from-top-1 duration-150">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <span className="text-muted-foreground">User</span>
                            <p className="font-medium flex items-center gap-1 mt-0.5">
                              <User className="h-3 w-3" /> {log.userName}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Action</span>
                            <p className="font-medium mt-0.5">{log.action}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Resource</span>
                            <p className="font-medium mt-0.5 truncate">{log.resource}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Resource ID</span>
                            <p className="font-mono mt-0.5 text-[11px] truncate">{log.resourceId || "—"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">IP Address</span>
                            <p className="font-medium mt-0.5 flex items-center gap-1">
                              <Globe className="h-3 w-3" /> {log.ip}
                            </p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">User Agent</span>
                            <p className="font-mono mt-0.5 text-[11px] truncate">{log.userAgent}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Timestamp</span>
                            <p className="font-medium mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages || 1} ({total} total entries)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                      const p = start + i
                      if (p > totalPages) return null
                      return (
                        <Button
                          key={p}
                          variant={p === page ? "cyber" : "outline"}
                          size="sm"
                          className="h-8 w-8 p-0 text-xs"
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      )
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
