"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import {
  Shield, Eye, Lock, HardDrive, Activity,
  CheckCircle, Users, Brain, Database, Download, Upload, AlertCircle, ActivitySquare, FileText,
} from "lucide-react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/useAuthStore"
import { api } from "@/lib/api"
import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts"

interface AuditEntry {
  id: string
  userName: string
  action: string
  resource: string
  createdAt: string
}

interface AdminStats {
  users: number
  verifiedUsers: number
  evidence: number
  messages: number
  keys: number
  storageUsed: string
  storageBytes: number
  systemHealth: string
  uptime: string
  activeSessions: number
  organizations: number
  forensicsReports: number
}

interface ChartPoint {
  time: string
  users: number
  evidence: number
  messages: number
  keys: number
}

function generateInitialHistory(s: AdminStats): ChartPoint[] {
  const points: ChartPoint[] = []
  const now = new Date()
  const totalSnapshots = 6
  const intervalMinutes = 3

  for (let i = totalSnapshots - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * intervalMinutes * 60 * 1000)
    const timeStr = t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
    const factor = i === 0 ? 1 : Math.max(0.6, 1 - (i * 0.08))
    
    points.push({
      time: timeStr,
      users: Math.max(0, Math.round(s.users * factor)),
      evidence: Math.max(0, Math.round(s.evidence * factor)),
      messages: Math.max(0, Math.round(s.messages * factor)),
      keys: Math.max(0, Math.round(s.keys * factor)),
    })
  }

  return points
}

const CHART_SERIES = [
  { key: "users" as const, label: "Users", color: "#22c55e", gradId: "gradUsers", accessor: (s: AdminStats) => s.users },
  { key: "evidence" as const, label: "Evidence", color: "#a855f7", gradId: "gradEvidence", accessor: (s: AdminStats) => s.evidence },
  { key: "messages" as const, label: "Messages", color: "#3b82f6", gradId: "gradMessages", accessor: (s: AdminStats) => s.messages },
  { key: "keys" as const, label: "Keys", color: "#f59e0b", gradId: "gradKeys", accessor: (s: AdminStats) => s.keys },
]

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border/60 rounded-lg shadow-lg px-3 py-2 text-xs space-y-1" style={{ backdropFilter: "blur(8px)" }}>
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role?.toLowerCase() === "admin" || user?.role?.toLowerCase() === "owner"
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([])
  const mounted = useRef(true)
  const [statsError, setStatsError] = useState(false)
  const [statsErrorMessage, setStatsErrorMessage] = useState("")
  const [auditError, setAuditError] = useState(false)
  const [history, setHistory] = useState<ChartPoint[]>([])
  const [visibleSeries, setVisibleSeries] = useState(CHART_SERIES.map(s => s.key))

  const fetchAll = useCallback(() => {
    api.get<AdminStats>("/dashboard/summary").then(s => {
      if (!mounted.current) return
      setStats(s); setStatsError(false); setStatsErrorMessage("")
      setHistory(prev => {
        let currentHistory = prev
        if (currentHistory.length === 0 && typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem("stegshield_dashboard_history")
            if (cached) {
              const parsed = JSON.parse(cached)
              if (Array.isArray(parsed) && parsed.length > 0) {
                currentHistory = parsed
              }
            }
          } catch (e) {
            console.error("Failed to parse cached history:", e)
          }
        }

        const point: ChartPoint = {
          time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }),
          users: s.users,
          evidence: s.evidence,
          messages: s.messages,
          keys: s.keys,
        }

        let updated: ChartPoint[]
        if (currentHistory.length < 3) {
          const seeds = generateInitialHistory(s)
          seeds[seeds.length - 1] = point
          updated = seeds
        } else {
          const last = currentHistory[currentHistory.length - 1]
          if (last.time === point.time) {
            updated = [...currentHistory.slice(0, -1), point]
          } else {
            updated = [...currentHistory, point]
          }
        }

        if (updated.length > 20) {
          updated = updated.slice(-20)
        }

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("stegshield_dashboard_history", JSON.stringify(updated))
          } catch (e) {
            console.error("Failed to save history to localStorage:", e)
          }
        }

        return updated
      })
    }).catch((e: unknown) => { console.error("Failed to fetch stats:", e); if (mounted.current) { setStatsError(true); setStatsErrorMessage((e as any)?.message || "Unknown error") } })

    if (isAdmin) {
      api.get<{ logs: AuditEntry[] }>("/audit?limit=5").then(d => { if (mounted.current) { setRecentActivity(d.logs); setAuditError(false) } }).catch((e: unknown) => { console.error("Failed to fetch audit:", e); if (mounted.current) setAuditError(true) })
    }
  }, [isAdmin])

  useEffect(() => {
    mounted.current = true
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("stegshield_dashboard_history")
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setHistory(parsed)
          }
        }
      } catch (e) {
        // ignore
      }
    }
    fetchAll()
    const interval = setInterval(fetchAll, 15000)
    return () => { mounted.current = false; clearInterval(interval) }
  }, [fetchAll])

  const health = stats?.systemHealth
  const storagePercent = stats?.storageBytes ? Math.min(Math.round(stats.storageBytes / (10 * 1024 * 1024 * 1024) * 100), 100) : 0

  const statCards = [
    { title: "System Health", value: health === "healthy" ? "94%" : health === "degraded" ? "58%" : "--", change: health || "N/A", icon: CheckCircle, color: health === "healthy" ? "text-success" : "text-warning", bg: health === "healthy" ? "bg-success/10" : "bg-warning/10", progress: health === "healthy" ? 94 : 58 },
    { title: "Storage Used", value: stats?.storageUsed || "0 B", change: `${stats?.evidence || 0} evidence items`, icon: HardDrive, color: "text-info", bg: "bg-info/10", progress: storagePercent },
    { title: "Total Users", value: String(stats?.users || 0), change: `${stats?.verifiedUsers || 0} verified`, icon: Users, color: "text-cyber-400", bg: "bg-cyber-500/10", progress: stats?.users ? Math.round((stats.verifiedUsers / stats.users) * 100) : 0 },
    { title: "Messages Sent", value: String(stats?.messages || 0), change: `${stats?.keys || 0} active keys`, icon: Shield, color: "text-cyber-400", bg: "bg-cyber-500/10", progress: stats?.messages ? Math.min(Math.round(stats.messages / 1000 * 100), 100) : 0 },
  ]

  const exportPdf = () => {
    if (!stats) { toast.error("No data to export"); return }
    const now = new Date()
    const dateStr = now.toLocaleString()
    const rows = [
      { label: "System Health", value: stats.systemHealth || "N/A", icon: "🟢" },
      { label: "Total Users", value: String(stats.users), icon: "👥" },
      { label: "Verified Users", value: String(stats.verifiedUsers), icon: "✅" },
      { label: "Evidence Items", value: String(stats.evidence), icon: "🗄️" },
      { label: "Encrypted Messages", value: String(stats.messages), icon: "💬" },
      { label: "Active Keys", value: String(stats.keys), icon: "🔑" },
      { label: "Storage Used", value: stats.storageUsed, icon: "💾" },
      { label: "System Uptime", value: stats.uptime || "N/A", icon: "⏱️" },
      { label: "Active Sessions", value: String(stats.activeSessions), icon: "📡" },
      { label: "Organizations", value: String(stats.organizations), icon: "🏢" },
      { label: "Forensics Reports", value: String(stats.forensicsReports), icon: "🔍" },
    ]
    const historyTableRows = history.slice(-10).map(h =>
      `<tr><td>${h.time}</td><td>${h.users}</td><td>${h.evidence}</td><td>${h.messages}</td><td>${h.keys}</td></tr>`
    ).join("")
    const activityRows = recentActivity.slice(0, 10).map(a =>
      `<tr><td>${new Date(a.createdAt).toLocaleString()}</td><td>${a.userName}</td><td>${a.action}</td><td>${a.resource}</td></tr>`
    ).join("")

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>StegShield X — Dashboard Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #e2e8f0; padding: 40px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 32px; }
    .logo { font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #6366f1, #22c55e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
    .meta { text-align: right; font-size: 12px; color: #64748b; }
    .section-title { font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6366f1; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .section-title::after { content: ''; flex: 1; height: 1px; background: #1e293b; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 32px; }
    .stat-card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; }
    .stat-icon { font-size: 20px; margin-bottom: 8px; }
    .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
    .stat-value { font-size: 22px; font-weight: 700; color: #f1f5f9; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 12px; }
    th { background: #1e293b; color: #94a3b8; font-weight: 600; padding: 10px 12px; text-align: left; text-transform: uppercase; letter-spacing: 0.06em; }
    td { padding: 9px 12px; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
    tr:hover td { background: #0f172a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
    .healthy { background: #052e16; color: #22c55e; }
    .footer { border-top: 1px solid #1e293b; padding-top: 16px; font-size: 11px; color: #475569; text-align: center; margin-top: 32px; }
    @media print {
      body { background: white; color: black; padding: 24px; }
      .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; }
      th { background: #f1f5f9; color: #475569; }
      td { border-bottom: 1px solid #e2e8f0; }
      .logo { -webkit-text-fill-color: #6366f1; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">🛡 StegShield X</div>
      <div class="subtitle">Dashboard Analytics Report</div>
    </div>
    <div class="meta">
      <div>Generated: ${dateStr}</div>
      <div>User: ${user?.name || user?.email || "Unknown"}</div>
      <div>Role: ${user?.role || "N/A"}</div>
    </div>
  </div>

  <div class="section-title">System Statistics</div>
  <div class="stats-grid">
    ${rows.map(r => `
      <div class="stat-card">
        <div class="stat-icon">${r.icon}</div>
        <div class="stat-label">${r.label}</div>
        <div class="stat-value">${r.value}</div>
      </div>
    `).join("")}
  </div>

  ${historyTableRows ? `
  <div class="section-title">Activity History (Last 10 Snapshots)</div>
  <table>
    <thead><tr><th>Time</th><th>Users</th><th>Evidence</th><th>Messages</th><th>Keys</th></tr></thead>
    <tbody>${historyTableRows}</tbody>
  </table>
  ` : ""}

  ${activityRows ? `
  <div class="section-title">Recent Audit Activity</div>
  <table>
    <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Resource</th></tr></thead>
    <tbody>${activityRows}</tbody>
  </table>
  ` : ""}

  <div class="footer">StegShield X — Confidential Report &nbsp;·&nbsp; Generated ${dateStr} &nbsp;·&nbsp; Do not distribute without authorization</div>
  <script>window.onload = function() { window.print() }<\/script>
</body></html>`

    const win = window.open("", "_blank", "width=900,height=700")
    if (!win) { toast.error("Pop-up blocked — allow pop-ups and try again"); return }
    win.document.write(html)
    win.document.close()
    toast.success("PDF report opened — use browser Print → Save as PDF")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{statsError ? statsErrorMessage : stats?.systemHealth ? `System status: ${stats.systemHealth}` : "Loading..."}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const rows = [
              ["Metric", "Value"],
              ["Users", String(stats?.users ?? 0)],
              ["Verified Users", String(stats?.verifiedUsers ?? 0)],
              ["Evidence", String(stats?.evidence ?? 0)],
              ["Messages", String(stats?.messages ?? 0)],
              ["Keys", String(stats?.keys ?? 0)],
              ["Storage", stats?.storageUsed ?? "0 B"],
              ["Health", stats?.systemHealth ?? "N/A"],
              ["Uptime", stats?.uptime ?? "N/A"],
              ["Active Sessions", String(stats?.activeSessions ?? 0)],
              ["Organizations", String(stats?.organizations ?? 0)],
              ["Forensics Reports", String(stats?.forensicsReports ?? 0)],
            ]
            const csv = rows.map((r) => r.join(",")).join("\n")
            const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob)
            const a = document.createElement("a"); a.href = url; a.download = `dashboard-stats-${new Date().toISOString().slice(0,10)}.csv`; a.click()
            URL.revokeObjectURL(url); toast.success("CSV exported")
          }}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileText className="mr-2 h-4 w-4" /> Export PDF
          </Button>
          <Button variant="cyber" size="sm" onClick={() => router.push("/evidence-vault")}><Upload className="mr-2 h-4 w-4" /> Quick Upload</Button>
        </div>
      </div>

      {statsError && !stats ? (
        <Card className="glass-card">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm font-medium text-destructive mb-1">{statsErrorMessage || "Failed to load dashboard data"}</p>
            <p className="text-xs text-muted-foreground mb-3">Check that the backend server is running on port 4000</p>
            <Button variant="outline" size="sm" onClick={() => { setStatsError(false); fetchAll() }}>Retry</Button>
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="glass-card animate-fade-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <Badge variant="outline" className="text-xs">{stat.change}</Badge>
              </div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.title}</div>
              <Progress value={stat.progress} className="mt-3 h-1" />
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-card overflow-hidden">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>Network Activity</CardTitle>
                  <Badge variant="outline" className="text-xs gap-1 border-cyber-500/30 text-cyber-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-500" />
                    </span>
                    live
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="cyber" className="text-xs">{stats?.uptime || "Uptime"}</Badge>
                  <Badge variant="outline" className="text-xs">{history.length} snapshots</Badge>
                </div>
              </div>
              {stats && (
                <div className="flex flex-wrap gap-3 mt-4">
                  {CHART_SERIES.map(s => (
                    <button
                      key={s.key}
                      onClick={() => setVisibleSeries(prev => prev.includes(s.key) ? prev.filter(k => k !== s.key) : [...prev, s.key])}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
                        visibleSeries.includes(s.key)
                          ? "border-transparent bg-muted shadow-sm"
                          : "border-border/40 text-muted-foreground/50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      {s.label}
                      <span className="ml-0.5 tabular-nums" style={{ color: s.color }}>
                        {String(s.accessor(stats) ?? 0)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              {statsError ? (
                <div className="h-[260px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span>Unable to load chart data</span>
                </div>
              ) : history.length === 0 ? (
                <div className="h-[260px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-3">
                  <div className="flex gap-1">
                    {[...Array(12)].map((_, i) => (
                      <div key={i} className="w-3 rounded-sm bg-muted animate-pulse" style={{ height: `${20 + (i % 5) * 10}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                  <span className="text-xs mt-2">Collecting data from server...</span>
                </div>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                      <defs>
                        {CHART_SERIES.map(s => (
                          <linearGradient key={s.gradId} id={s.gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={s.color} stopOpacity="0.45" />
                            <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" strokeOpacity="0.25" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={24}
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: string) => <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{value}</span>}
                      />
                      {CHART_SERIES.filter(s => visibleSeries.includes(s.key)).map(s => (
                        <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} fill={`url(#${s.gradId})`} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 1, stroke: "hsl(var(--background))" }} name={s.label} isAnimationActive />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {statsError ? (
              <Card className="glass-card sm:col-span-3">
                <CardContent className="p-4 text-center text-sm text-muted-foreground">Stats unavailable</CardContent>
              </Card>
            ) : (<><Card className="glass-card">
              <CardContent className="p-4 text-center">
                <Database className="h-6 w-6 text-cyber-400 mx-auto mb-2" />
                <div className="text-lg font-bold">{stats?.messages || 0}</div>
                <div className="text-xs text-muted-foreground">Messages</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <Shield className="h-6 w-6 text-success mx-auto mb-2" />
                <div className="text-lg font-bold">{stats?.users || 0}</div>
                <div className="text-xs text-muted-foreground">Total Users</div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-4 text-center">
                <Lock className="h-6 w-6 text-info mx-auto mb-2" />
                <div className="text-lg font-bold">{stats?.keys || 0}</div>
                <div className="text-xs text-muted-foreground">Encryption Keys</div>
              </CardContent>
            </Card></>)}
          </div>

          <Card className="glass-card">
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditError ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-sm">Failed to load activity</p>
                    <Button variant="ghost" size="sm" onClick={() => { setAuditError(false); api.get<{ logs: AuditEntry[] }>("/audit?limit=5").then(d => { if (mounted.current) { setRecentActivity(d.logs); setAuditError(false) } }).catch(() => { if (mounted.current) setAuditError(true) }) }}>Retry</Button>
                  </div>
                ) : recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="p-2 rounded-lg bg-muted">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.action}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.resource}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{item.userName}</p>
                        <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="glass-card">
            <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
            <CardContent>
              {statsError ? (
                <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-sm">Health data unavailable</p>
                </div>
              ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Uptime</span>
                  <span className="text-sm font-medium">{stats?.uptime || "--"}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Health</span>
                  <Badge variant={stats?.systemHealth === "healthy" ? "success" : stats?.systemHealth === "degraded" ? "warning" : "destructive"}>{stats?.systemHealth || "--"}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Users</span>
                  <span className="text-sm font-medium">{stats?.users || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">Storage</span>
                  <span className="text-sm font-medium">{stats?.storageUsed || "--"}</span>
                </div>
              </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => router.push("/steganography")}>
                <Eye className="mr-2 h-4 w-4" /> Hide Data in Image
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => router.push("/file-encryption")}>
                <Lock className="mr-2 h-4 w-4" /> Encrypt File
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => router.push("/evidence-vault")}>
                <Shield className="mr-2 h-4 w-4" /> Upload Evidence
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => router.push("/ai-assistant")}>
                <Brain className="mr-2 h-4 w-4" /> Run AI Scan
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
