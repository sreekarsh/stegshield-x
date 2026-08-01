"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  Globe, Shield, AlertTriangle, CheckCircle2, AlertCircle,
  Loader2, ExternalLink, Info, Search, Link2, FileJson,
  Download, Copy, RefreshCw, Clock, X, ChevronRight,
  Server, FileText, Key, Activity, Bug, Award, Clipboard,
  Zap, BarChart2, Layers, ChevronDown, ChevronUp, Trash2, Plus,
  RotateCcw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { api } from "@/lib/api"
import toast from "react-hot-toast"

interface Finding {
  type: "passed" | "warning" | "failed" | "info"
  severity: "low" | "medium" | "high" | "critical"
  category: string
  detail: string
  recommendation?: string
}

interface SectionResult {
  score: number
  maxScore: number
  findings: Finding[]
}

interface UrlCheckResult {
  url: string
  timestamp: string
  riskScore: number
  riskLevel: "safe" | "low" | "medium" | "high" | "critical"
  summary: { totalChecks: number; passed: number; warnings: number; failures: number }
  sections: {
    structure: SectionResult
    hostname: SectionResult
    network: SectionResult
    ssl: SectionResult
    content: SectionResult
    headers: SectionResult
    reputation: SectionResult
  }
  redirectChain?: string[]
  finalDestination?: string
}

interface HistoryEntry {
  url: string
  riskScore: number
  riskLevel: string
  timestamp: string
}

const HISTORY_KEY = "urlchecker_history"

const riskConfig = {
  safe:     { color: "text-green-400",    bg: "bg-green-400/10",    border: "border-green-400/30",    label: "Safe",        icon: CheckCircle2, bar: "bg-green-400",    glow: "shadow-green-500/20" },
  low:      { color: "text-emerald-400",  bg: "bg-emerald-400/10",  border: "border-emerald-400/30",  label: "Low Risk",    icon: Shield,       bar: "bg-emerald-400",  glow: "shadow-emerald-500/20" },
  medium:   { color: "text-yellow-400",   bg: "bg-yellow-400/10",   border: "border-yellow-400/30",   label: "Medium Risk", icon: AlertTriangle, bar: "bg-yellow-400",  glow: "shadow-yellow-500/20" },
  high:     { color: "text-orange-400",   bg: "bg-orange-400/10",   border: "border-orange-400/30",   label: "High Risk",   icon: AlertTriangle, bar: "bg-orange-400",  glow: "shadow-orange-500/20" },
  critical: { color: "text-red-400",      bg: "bg-red-400/10",      border: "border-red-400/30",      label: "Critical",    icon: AlertCircle,  bar: "bg-red-400",      glow: "shadow-red-500/30" },
}

const sectionMeta: Record<string, { label: string; icon: any; desc: string }> = {
  structure:  { label: "URL Structure",      icon: Link2,    desc: "Protocol, path, and formatting" },
  hostname:   { label: "Hostname",           icon: Globe,    desc: "Domain & typosquatting checks" },
  network:    { label: "Network & DNS",      icon: Server,   desc: "DNS records and IP reputation" },
  ssl:        { label: "SSL/TLS",            icon: Key,      desc: "Certificate validity" },
  content:    { label: "Page Content",       icon: FileText, desc: "Phishing indicators" },
  headers:    { label: "Security Headers",   icon: Shield,   desc: "HTTP header audit" },
  reputation: { label: "Domain Reputation",  icon: Award,    desc: "Historical reputation data" },
}

const findingStyles: Record<string, string> = {
  passed: "border-green-500/20 bg-green-500/5 text-green-400",
  warning: "border-yellow-500/20 bg-yellow-500/5 text-yellow-400",
  failed: "border-red-500/20 bg-red-500/5 text-red-400",
  info: "border-blue-500/20 bg-blue-500/5 text-blue-400",
}

const findingIcons: Record<string, any> = {
  passed: CheckCircle2,
  warning: AlertTriangle,
  failed: AlertCircle,
  info: Info,
}

const severityColors: Record<string, string> = {
  critical: "text-red-400 border-red-400/30 bg-red-400/10",
  high: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  low: "text-blue-400 border-blue-400/30 bg-blue-400/10",
}

function getSectionHealth(section: SectionResult): { status: "good" | "warning" | "bad"; pct: number } {
  const pct = section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0
  if (pct >= 80) return { status: "good", pct }
  if (pct >= 50) return { status: "warning", pct }
  return { status: "bad", pct }
}

/** Extract all URLs from arbitrary pasted text */
function extractUrlsFromText(text: string): string[] {
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"'}{|\\\^`\[\]()]+/gi
  const matches = text.match(urlRegex) || []
  const cleaned = matches.map(u => u.replace(/[.,;!?]+$/, ""))
  return [...new Set(cleaned)]
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") } catch { return [] }
}
function saveHistory(h: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50))) } catch {}
}

export default function UrlCheckerPage() {
  const [url, setUrl] = useState("")
  const [bulkUrls, setBulkUrls] = useState<string[]>([])
  const [checking, setChecking] = useState(false)
  const [bulkChecking, setBulkChecking] = useState(false)
  const [result, setResult] = useState<UrlCheckResult | null>(null)
  const [bulkResults, setBulkResults] = useState<UrlCheckResult[]>([])
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("single")
  const [activeSection, setActiveSection] = useState("structure")
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [scanProgress, setScanProgress] = useState(0)
  const progressRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  const startProgress = () => {
    setScanProgress(0)
    let p = 0
    progressRef.current = setInterval(() => {
      p += Math.random() * 12
      if (p > 92) p = 92
      setScanProgress(Math.round(p))
    }, 300)
  }
  const endProgress = () => {
    if (progressRef.current) clearInterval(progressRef.current)
    setScanProgress(100)
    setTimeout(() => setScanProgress(0), 600)
  }

  const handleCheck = useCallback(async (targetUrl?: string) => {
    const u = (targetUrl ?? url).trim()
    if (!u) { setError("Enter a URL to check"); return }
    setError("")
    setChecking(true)
    setResult(null)
    startProgress()
    try {
      const data = await api.post<UrlCheckResult>("/url-checker/check", { url: u })
      setResult(data)
      setActiveSection("structure")
      const entry = { url: data.url, riskScore: data.riskScore, riskLevel: data.riskLevel, timestamp: data.timestamp }
      const newHistory = [entry, ...history.filter(h => h.url !== data.url)].slice(0, 50)
      setHistory(newHistory)
      saveHistory(newHistory)
      if (data.riskLevel === "safe" || data.riskLevel === "low") {
        toast.success(`URL appears ${data.riskLevel} (score: ${data.riskScore})`)
      } else if (data.riskLevel === "medium") {
        toast(`⚠️ Medium risk (${data.riskScore}) — review findings`)
      } else {
        toast.error(`${data.riskLevel.toUpperCase()} risk (${data.riskScore}) — do not open`)
      }
    } catch (e: any) {
      setError(e.message || "Check failed")
    } finally {
      setChecking(false)
      endProgress()
    }
  }, [url, history])

  const handleBulkCheck = useCallback(async () => {
    if (bulkUrls.length === 0) { toast.error("No URLs to check"); return }
    setBulkChecking(true)
    setBulkResults([])
    const results: UrlCheckResult[] = []
    for (const u of bulkUrls) {
      if (!u.trim()) continue
      try {
        const data = await api.post<UrlCheckResult>("/url-checker/check", { url: u.trim() })
        results.push(data)
        setBulkResults([...results])
      } catch {}
    }
    setBulkChecking(false)
    const newHistory = [
      ...results.map(r => ({ url: r.url, riskScore: r.riskScore, riskLevel: r.riskLevel, timestamp: r.timestamp })),
      ...history,
    ].slice(0, 50)
    setHistory(newHistory)
    saveHistory(newHistory)
    toast.success(`Checked ${results.length} URLs`)
  }, [bulkUrls, history])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      const found = extractUrlsFromText(text)
      if (found.length === 0) {
        setUrl(text.trim())
        toast("No URL pattern found — pasted as-is")
      } else if (found.length === 1) {
        setUrl(found[0])
        toast.success("URL extracted from clipboard")
      } else {
        setBulkUrls(found)
        setActiveTab("bulk")
        toast.success(`${found.length} URLs extracted — switched to Bulk mode`)
      }
    } catch {
      toast.error("Clipboard access denied")
    }
  }, [])

  const exportJson = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `url-report-${Date.now()}.json`
    a.click()
    toast.success("Report exported as JSON")
    setShowExportMenu(false)
  }

  const allFindings = result
    ? Object.values(result.sections).flatMap(s => s.findings)
    : []

  const exportCsv = () => {
    if (!result) return
    const rows = [
      ["URL", result.url],
      ["Risk Score", String(result.riskScore)],
      ["Risk Level", result.riskLevel],
      ["Total Checks", String(result.summary.totalChecks)],
      ["Passed", String(result.summary.passed)],
      ["Warnings", String(result.summary.warnings)],
      ["Failures", String(result.summary.failures)],
      ["Scanned At", result.timestamp],
      [],
      ["Category", "Severity", "Type", "Detail"],
      ...allFindings.map(f => [f.category, f.severity, f.type, f.detail.replace(/,/g, ";")]),
    ]
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `url-report-${Date.now()}.csv`
    a.click()
    toast.success("Report exported as CSV")
    setShowExportMenu(false)
  }

  const exportPdf = () => {
    if (!result) return
    const cfg = riskConfig[result.riskLevel as keyof typeof riskConfig] || riskConfig.low
    const findingRows = allFindings.map(f => `
      <tr>
        <td>${f.category}</td>
        <td><span class="badge sev-${f.severity}">${f.severity}</span></td>
        <td><span class="badge type-${f.type}">${f.type}</span></td>
        <td>${f.detail}</td>
      </tr>`).join("")
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>URL Safety Report — ${result.url}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #e2e8f0; padding: 36px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6366f1; padding-bottom: 18px; margin-bottom: 28px; }
        .logo { font-size: 22px; font-weight: 800; color: #6366f1; }
        .meta { text-align: right; font-size: 11px; color: #64748b; }
        .score-box { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 90px; height: 90px; border-radius: 50%; border: 4px solid ${cfg.color || '#22c55e'}; margin: 0 auto 12px; }
        .score-num { font-size: 32px; font-weight: 800; color: ${cfg.color || '#22c55e'}; }
        .score-max { font-size: 11px; color: #64748b; }
        .summary-row { display: flex; gap: 16px; margin: 20px 0 28px; }
        .s-card { flex: 1; background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 14px; text-align: center; }
        .s-val { font-size: 24px; font-weight: 700; }
        .s-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }
        .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #6366f1; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #1e293b; color: #94a3b8; padding: 8px 10px; text-align: left; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
        td { padding: 8px 10px; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
        .badge { display: inline-block; padding: 1px 7px; border-radius: 9999px; font-size: 10px; font-weight: 600; }
        .sev-critical { background: #450a0a; color: #f87171; }
        .sev-high { background: #431407; color: #fb923c; }
        .sev-medium { background: #422006; color: #fbbf24; }
        .sev-low { background: #052e16; color: #4ade80; }
        .type-passed { background: #052e16; color: #4ade80; }
        .type-warning { background: #422006; color: #fbbf24; }
        .type-failed { background: #450a0a; color: #f87171; }
        .type-info { background: #0c1a4d; color: #60a5fa; }
        .url-box { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 10px 14px; font-family: monospace; font-size: 12px; word-break: break-all; margin-bottom: 20px; }
        .footer { border-top: 1px solid #1e293b; margin-top: 28px; padding-top: 12px; font-size: 10px; color: #475569; text-align: center; }
        @media print { body { background: white; color: black; } .s-card { background: #f8fafc; border-color: #e2e8f0; } th { background: #f1f5f9; color: #475569; } .url-box { background: #f8fafc; } }
      </style>
    </head><body>
      <div class="header">
        <div><div class="logo">🛡 StegShield X</div><div style="font-size:12px;color:#64748b;margin-top:4px">URL Safety Analysis Report</div></div>
        <div class="meta"><div>${new Date(result.timestamp).toLocaleString()}</div><div>StegShield X URL Checker</div></div>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <div class="score-box"><div class="score-num">${result.riskScore}</div><div class="score-max">/ 100</div></div>
        <div style="font-size:14px;font-weight:700;color:${cfg.color || '#22c55e'};margin-bottom:4px">${result.riskLevel?.toUpperCase().replace('-', ' ')} RISK</div>
      </div>
      <div class="url-box">🔗 ${result.url}</div>
      <div class="summary-row">
        <div class="s-card"><div class="s-val" style="color:#4ade80">${result.summary.passed}</div><div class="s-label">Passed</div></div>
        <div class="s-card"><div class="s-val" style="color:#fbbf24">${result.summary.warnings}</div><div class="s-label">Warnings</div></div>
        <div class="s-card"><div class="s-val" style="color:#f87171">${result.summary.failures}</div><div class="s-label">Failed</div></div>
        <div class="s-card"><div class="s-val">${result.summary.totalChecks}</div><div class="s-label">Total Checks</div></div>
      </div>
      <div class="section-title">Security Findings</div>
      <table><thead><tr><th>Category</th><th>Severity</th><th>Status</th><th>Detail</th></tr></thead>
        <tbody>${findingRows}</tbody></table>
      <div class="footer">StegShield X — Confidential Security Report &nbsp;·&nbsp; Generated ${new Date().toLocaleString()} &nbsp;·&nbsp; Do not distribute without authorization</div>
      <script>window.onload=function(){window.print()}<\/script>
    </body></html>`
    const win = window.open("", "_blank", "width=920,height=720")
    if (!win) { toast.error("Pop-up blocked — allow pop-ups and try again"); return }
    win.document.write(html)
    win.document.close()
    toast.success("PDF report opened — use Print → Save as PDF")
    setShowExportMenu(false)
  }

  const copyReport = () => {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    toast.success("Report copied to clipboard")
  }

  const clearHistory = () => {
    setHistory([])
    saveHistory([])
    toast.success("History cleared")
  }

  const handleClear = () => {
    setUrl("")
    setResult(null)
    setError("")
    setBulkUrls([])
    setBulkResults([])
    setActiveSection("structure")
    toast.success("Scan inputs & results cleared")
  }

  const criticalCount = result ? Object.values(result.sections).flatMap(s => s.findings).filter(f => f.severity === "critical").length : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="URL Security Checker"
        description="Deep URL analysis — structure, DNS, SSL, content, headers, and reputation scanning"
        action={{ label: "Refresh / Clear", icon: RotateCcw, onClick: handleClear }}
      />

      {/* Progress Bar */}
      {scanProgress > 0 && (
        <div className="h-0.5 w-full bg-muted rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyber-500 to-purple-500 transition-all duration-300"
            style={{ width: `${scanProgress}%` }}
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto hover:opacity-70" onClick={() => setError("")}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="single"><Search className="h-3.5 w-3.5 mr-1.5" />Single URL</TabsTrigger>
          <TabsTrigger value="bulk"><Layers className="h-3.5 w-3.5 mr-1.5" />Bulk Check {bulkUrls.length > 0 ? `(${bulkUrls.length})` : ""}</TabsTrigger>
          <TabsTrigger value="history"><Clock className="h-3.5 w-3.5 mr-1.5" />History ({history.length})</TabsTrigger>
        </TabsList>

        {/* ── Single URL ── */}
        <TabsContent value="single" className="space-y-6">
          <Card className="glass-card border-cyber-500/20 shadow-lg shadow-cyber-500/5">
            <CardContent className="p-5">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={inputRef}
                    className="pl-9 pr-20 font-mono text-sm h-11 bg-background/60"
                    placeholder="https://example.com  or  paste any text containing a URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-muted-foreground">
                    {url && (
                      <button
                        className="hover:text-foreground transition-colors p-0.5"
                        onClick={() => setUrl("")}
                        title="Clear input"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      className="hover:text-foreground transition-colors p-0.5"
                      onClick={handlePaste}
                      title="Paste from clipboard (auto-extracts URLs)"
                    >
                      <Clipboard className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <Button variant="outline" className="h-11 px-4 gap-1.5" onClick={handleClear} title="Clear all inputs and results">
                  <RotateCcw className="h-4 w-4" /> Clear
                </Button>
                <Button variant="cyber" className="h-11 px-6 gap-2" onClick={() => handleCheck()} disabled={checking || !url.trim()}>
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {checking ? "Scanning..." : "Scan URL"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 ml-1">
                💡 Tip: Paste any text (email, message, webpage) — the scanner will auto-extract embedded URLs
              </p>
            </CardContent>
          </Card>

          {/* Result */}
          {result && (() => {
            const config = riskConfig[result.riskLevel]
            const circumference = 2 * Math.PI * 54
            return (
              <div className="space-y-5">
                {/* Score hero */}
                <div className="grid gap-5 lg:grid-cols-4">
                  <Card className={`glass-card lg:col-span-1 border ${config.border} shadow-lg ${config.glow}`}>
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                      <div className="relative">
                        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                          <circle cx="60" cy="60" r="54" fill="none" strokeWidth="8"
                            strokeDasharray={`${(result.riskScore / 100) * circumference} ${circumference}`}
                            strokeLinecap="round"
                            className={`${config.bar} transition-all duration-1000`}
                            stroke="currentColor"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <div className={`text-4xl font-black ${config.color}`}>{result.riskScore}</div>
                          <div className="text-[9px] text-muted-foreground tracking-widest uppercase">/ 100</div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`${config.color} ${config.bg} ${config.border} text-sm px-4 py-1`}>
                        <config.icon className="h-4 w-4 mr-1.5" />
                        {config.label}
                      </Badge>
                      <div className="w-full grid grid-cols-3 gap-1 text-center">
                        <div className="rounded-lg bg-green-500/10 py-1.5">
                          <div className="text-lg font-bold text-green-400">{result.summary.passed}</div>
                          <div className="text-[9px] text-muted-foreground">Passed</div>
                        </div>
                        <div className="rounded-lg bg-yellow-500/10 py-1.5">
                          <div className="text-lg font-bold text-yellow-400">{result.summary.warnings}</div>
                          <div className="text-[9px] text-muted-foreground">Warnings</div>
                        </div>
                        <div className="rounded-lg bg-red-500/10 py-1.5">
                          <div className="text-lg font-bold text-red-400">{result.summary.failures}</div>
                          <div className="text-[9px] text-muted-foreground">Failed</div>
                        </div>
                      </div>
                      {criticalCount > 0 && (
                        <div className="w-full flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                          <span className="text-xs text-red-400 font-medium">{criticalCount} critical issue{criticalCount > 1 ? "s" : ""}</span>
                        </div>
                      )}
                      <div className="flex gap-2 w-full">
                        {/* Export dropdown */}
                        <div className="relative flex-1" ref={exportMenuRef}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs"
                            onClick={() => setShowExportMenu(v => !v)}
                          >
                            <Download className="h-3 w-3 mr-1" /> Export <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                          {showExportMenu && (
                            <div className="absolute bottom-full mb-1 left-0 w-40 rounded-xl border border-border/60 bg-background shadow-2xl shadow-black/40 overflow-hidden z-50">
                              <button
                                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs hover:bg-muted/60 transition-colors text-left"
                                onClick={exportJson}
                              >
                                <FileJson className="h-3.5 w-3.5 text-blue-400" />
                                <span>Export JSON</span>
                              </button>
                              <button
                                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs hover:bg-muted/60 transition-colors text-left border-t border-border/40"
                                onClick={exportCsv}
                              >
                                <FileText className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Export CSV</span>
                              </button>
                              <button
                                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs hover:bg-muted/60 transition-colors text-left border-t border-border/40"
                                onClick={exportPdf}
                              >
                                <Download className="h-3.5 w-3.5 text-red-400" />
                                <span>Export PDF</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={copyReport}>
                          <Copy className="h-3 w-3 mr-1" /> Copy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Summary + section tiles */}
                  <div className="lg:col-span-3 space-y-4">
                    <Card className="glass-card">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30">
                          <Link2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mb-0.5">Scanned URL</p>
                            <p className="text-sm font-mono break-all">{result.url}</p>
                          </div>
                          <a href={result.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </a>
                        </div>
                        {result.redirectChain && result.redirectChain.length > 1 && (
                          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                            <p className="text-xs font-medium text-yellow-400 mb-2 flex items-center gap-1.5">
                              <Activity className="h-3.5 w-3.5" /> Redirect Chain ({result.redirectChain.length} hops)
                            </p>
                            <div className="space-y-1">
                              {result.redirectChain.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                                  <span className="shrink-0 w-5 text-center opacity-50">{i + 1}</span>
                                  <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
                                  <span className="truncate">{r}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {result.finalDestination && result.finalDestination !== result.url && (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-cyber-500/5 border border-cyber-500/20 text-xs">
                            <Info className="h-3.5 w-3.5 text-cyber-400 shrink-0" />
                            <span className="text-muted-foreground shrink-0">Final destination:</span>
                            <span className="font-mono truncate text-cyber-400">{result.finalDestination}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                          <Clock className="h-3 w-3" />
                          Scanned {new Date(result.timestamp).toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Section health grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {Object.entries(result.sections).map(([key, section]) => {
                        const health = getSectionHealth(section)
                        const meta = sectionMeta[key as keyof typeof sectionMeta]
                        const Icon = meta.icon
                        const activeClass = activeSection === key
                          ? "border-cyber-500/60 bg-cyber-500/10 shadow-sm shadow-cyber-500/20"
                          : "border-border/40 bg-card/60 hover:border-cyber-500/30"
                        const healthText = health.status === "good" ? "text-green-400" : health.status === "warning" ? "text-yellow-400" : "text-red-400"
                        const failCount = section.findings.filter(f => f.type === "failed").length
                        return (
                          <button key={key} onClick={() => setActiveSection(key)}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${activeClass}`}>
                            <div className="flex items-center justify-between mb-2">
                              <Icon className={`h-4 w-4 ${healthText}`} />
                              {failCount > 0 && (
                                <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-mono">{failCount}</span>
                              )}
                            </div>
                            <p className="text-xs font-medium leading-tight mb-2">{meta.label}</p>
                            <div className="flex items-center gap-1.5">
                              <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${health.status === "good" ? "bg-green-400" : health.status === "warning" ? "bg-yellow-400" : "bg-red-400"}`}
                                  style={{ width: `${health.pct}%` }} />
                              </div>
                              <span className={`text-[10px] font-mono shrink-0 ${healthText}`}>{health.pct}%</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Section Detail */}
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const meta = sectionMeta[activeSection as keyof typeof sectionMeta]
                          const Icon = meta.icon
                          return <Icon className="h-5 w-5 text-cyber-400" />
                        })()}
                        <div>
                          <CardTitle className="text-sm">{sectionMeta[activeSection as keyof typeof sectionMeta]?.label}</CardTitle>
                          <CardDescription className="text-xs">{sectionMeta[activeSection as keyof typeof sectionMeta]?.desc}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {result.sections[activeSection as keyof typeof result.sections].findings.length} findings
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.sections[activeSection as keyof typeof result.sections].findings.length === 0
                      ? <div className="text-center py-8 text-muted-foreground text-sm">No checks for this section.</div>
                      : result.sections[activeSection as keyof typeof result.sections].findings.map((f, i) => {
                        const Icon = findingIcons[f.type]
                        return (
                          <div key={i} className={`p-3 rounded-lg border ${findingStyles[f.type]} border-opacity-30`}>
                            <div className="flex items-start gap-3">
                              <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                  <p className="text-sm font-medium text-foreground">{f.category}</p>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${severityColors[f.severity]}`}>
                                    {f.severity}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{f.detail}</p>
                                {f.recommendation && (
                                  <div className="mt-1.5 flex items-start gap-1.5 text-xs text-cyber-400">
                                    <Info className="h-3 w-3 shrink-0 mt-0.5" />
                                    <span>{f.recommendation}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    }
                  </CardContent>
                </Card>
              </div>
            )
          })()}

          {!result && !checking && (
            <Card className="glass-card border-dashed border-border/40">
              <CardContent className="py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-cyber-500/10 border border-cyber-500/20 flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-7 w-7 text-cyber-400" />
                </div>
                <p className="text-sm font-medium mb-1">Ready to Scan</p>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Enter any URL, domain, or paste text containing a link. The scanner auto-extracts embedded URLs.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {["https://google.com", "https://github.com", "bit.ly/example"].map(ex => (
                    <button key={ex} onClick={() => { setUrl(ex) }}
                      className="text-xs px-3 py-1.5 rounded-full border border-border/50 hover:border-cyber-500/40 text-muted-foreground hover:text-foreground transition-colors font-mono">
                      {ex}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {checking && (
            <Card className="glass-card border-cyber-500/20">
              <CardContent className="py-12 text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-cyber-500/20 animate-ping" />
                  <div className="w-16 h-16 rounded-full bg-cyber-500/10 border border-cyber-500/30 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-cyber-400 animate-spin" />
                  </div>
                </div>
                <p className="text-sm font-medium text-cyber-400 mb-1">Scanning URL...</p>
                <p className="text-xs text-muted-foreground">Checking DNS, SSL, headers, reputation…</p>
                <div className="mt-4 h-1.5 w-48 mx-auto rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyber-500 to-purple-500 transition-all duration-300 rounded-full"
                    style={{ width: `${scanProgress}%` }} />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Bulk Check ── */}
        <TabsContent value="bulk" className="space-y-5">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Bulk URL Scanner</CardTitle>
                  <CardDescription className="text-xs">Check multiple URLs at once — paste a list or add manually</CardDescription>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handlePaste}>
                  <Clipboard className="h-3.5 w-3.5 mr-1" /> Paste URLs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {bulkUrls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    className="flex-1 font-mono text-xs h-9"
                    value={u}
                    onChange={(e) => {
                      const updated = [...bulkUrls]
                      updated[i] = e.target.value
                      setBulkUrls(updated)
                    }}
                    placeholder="https://..."
                  />
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-red-400"
                    onClick={() => setBulkUrls(bulkUrls.filter((_, idx) => idx !== i))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={() => setBulkUrls([...bulkUrls, ""])}>
                  <Plus className="h-3.5 w-3.5" /> Add URL
                </Button>
                <Button variant="cyber" size="sm" className="h-9 text-xs gap-1.5 ml-auto"
                  onClick={handleBulkCheck}
                  disabled={bulkChecking || bulkUrls.filter(u => u.trim()).length === 0}>
                  {bulkChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  {bulkChecking ? `Scanning...` : `Scan ${bulkUrls.filter(u => u.trim()).length} URLs`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {bulkResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground px-1">{bulkResults.length} of {bulkUrls.filter(u => u.trim()).length} scanned</p>
              {bulkResults.map((r, i) => {
                const cfg = riskConfig[r.riskLevel]
                return (
                  <Card key={i} className={`glass-card border ${cfg.border} cursor-pointer hover:shadow-md transition-all`}
                    onClick={() => { setUrl(r.url); setResult(r); setActiveTab("single") }}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`text-2xl font-black min-w-[3.5rem] text-center ${cfg.color}`}>{r.riskScore}</div>
                      <cfg.icon className={`h-5 w-5 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono truncate">{r.url}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{cfg.label} · {r.summary.failures} failed · {r.summary.warnings} warnings</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0">
                        View Details <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {!bulkChecking && bulkResults.length === 0 && bulkUrls.length === 0 && (
            <Card className="glass-card border-dashed">
              <CardContent className="py-12 text-center">
                <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Bulk URL Scanner</p>
                <p className="text-xs text-muted-foreground">Add URLs manually or paste text — multiple URLs auto-detected</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── History ── */}
        <TabsContent value="history">
          {history.length === 0 ? (
            <Card className="glass-card border-dashed">
              <CardContent className="py-16 text-center">
                <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">No scan history</p>
                <p className="text-xs text-muted-foreground">Your URL scans will appear here and persist across sessions</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-muted-foreground">{history.length} scans stored</p>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-400" onClick={clearHistory}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear All
                </Button>
              </div>
              {history.map((h, i) => {
                const cfg = riskConfig[h.riskLevel as keyof typeof riskConfig]
                return (
                  <Card key={i} className="glass-card hover:border-cyber-500/30 transition-all cursor-pointer"
                    onClick={() => { setUrl(h.url); setActiveTab("single") }}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className={`text-xl font-black min-w-[3rem] text-center ${cfg.color}`}>{h.riskScore}</div>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.bar}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono truncate">{h.url}</p>
                        <p className="text-xs text-muted-foreground">{cfg.label} · {new Date(h.timestamp).toLocaleString()}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-xs shrink-0 gap-1"
                        onClick={(e) => { e.stopPropagation(); setUrl(h.url); setActiveTab("single"); handleCheck(h.url) }}>
                        <RefreshCw className="h-3 w-3" /> Recheck
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
