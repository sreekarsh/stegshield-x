"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  Upload, FileSearch, BarChart3, Hash, FileText, Loader2,
  File, AlertTriangle, CheckCircle2, Clock, Trash2, Download,
  Shield, Bug, ScanLine, Image, FileCode, Network, Fingerprint,
  Sigma, Zap, Eye, Layers, PieChart, List, Search, WifiOff,
  RotateCcw, Sparkles, RefreshCw, X, ArrowUpRight, Copy, Check,
  ChevronDown, FileJson, FileSpreadsheet,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { Progress } from "@/components/ui/progress"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import toast from "react-hot-toast"
import { api } from "@/lib/api"

interface ForensicsReport {
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
  elaAvailable?: boolean
  elaScore?: number
  elaProbability?: number
}

function formatSize(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { variant: "destructive" | "warning" | "success" | "default"; label: string }> = {
    critical: { variant: "destructive", label: "CRITICAL" },
    high:     { variant: "destructive", label: "HIGH" },
    medium:   { variant: "warning",     label: "MEDIUM" },
    low:      { variant: "success",     label: "LOW" },
  }
  const m = map[level] || map.low
  return <Badge variant={m.variant}>{m.label}</Badge>
}

function ScoreGauge({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ThreatRadar({ breakdown }: { breakdown: Record<string, boolean> | null }) {
  if (!breakdown) return null
  const items = Object.entries(breakdown)
  const active = items.filter(([, v]) => v).length
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Threat Breakdown ({active}/{items.length})
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map(([key, val]) => (
          <div key={key} className={`flex items-center gap-1.5 text-xs p-2 rounded-lg border ${val ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-muted/30 border-border/40 text-muted-foreground"}`}>
            {val ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />}
            <span className="truncate">{key.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DigitalForensicsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ForensicsReport | null>(null)
  const [reports, setReports] = useState<ForensicsReport[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [activeTab, setActiveTab] = useState("analyze")
  const [copiedHash, setCopiedHash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const loadReports = useCallback(async () => {
    setLoadingReports(true)
    try {
      const data: any = await api.get("/forensics/reports?limit=50")
      setReports(data.items || [])
    } catch {
      setReports([])
    } finally {
      setLoadingReports(false)
    }
  }, [])

  const MAX_FILE_SIZE = 500 * 1024 * 1024

  const handleFile = useCallback((f: File) => {
    if (f.size > MAX_FILE_SIZE) {
      toast.error(`File too large. Maximum size is 500MB.`)
      return
    }
    setFile(f)
    setResult(null)
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f)
      setPreviewUrl(url)
    } else {
      setPreviewUrl(null)
    }
  }, [])

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl(null)
    setResult(null)
    toast.success("File cleared")
  }

  const runAnalysis = async () => {
    if (!file) { toast.error("Drop or select a file first"); return }
    setAnalyzing(true)
    setProgress(15)
    try {
      setProgress(35)
      const formData = new FormData()
      formData.append("file", file)
      setProgress(60)
      const data: any = await api.upload("/forensics/analyze", formData)
      setProgress(90)
      setResult(data as ForensicsReport)
      setProgress(100)
      toast.success("Forensic analysis complete!")
      setActiveTab("results")
      loadReports()
    } catch (e: any) {
      toast.error(e?.message || "Analysis failed")
    } finally {
      setAnalyzing(false)
      setTimeout(() => setProgress(0), 500)
    }
  }

  const exportAsJSON = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `forensics-${result.fileName}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("JSON Report exported")
  }

  const exportAsCSV = () => {
    if (!result) return
    const rows = [
      ["Metric / Attribute", "Value", "Notes"],
      ["Filename", `"${result.fileName}"`, ""],
      ["File Size", `"${formatSize(result.fileSize)}"`, ""],
      ["File Type", `"${result.fileType}"`, ""],
      ["Overall Risk", `"${result.overallRisk}"`, ""],
      ["Threat Level", `"${result.threatLevel}"`, ""],
      ["Threat Score", `"${result.threatScore}"`, "Out of 100"],
      ["Shannon Entropy", `"${result.entropy}"`, "Max 8.0"],
      ["Steganography Risk", `"${(result.stegoProbability * 100).toFixed(1)}%"`, ""],
      ["Tamper Probability", `"${result.tamperProbability != null ? (result.tamperProbability * 100).toFixed(1) + '%' : 'N/A'}"`, ""],
      ["Deepfake Risk", `"${result.deepfakeProbability != null ? (result.deepfakeProbability * 100).toFixed(1) + '%' : 'N/A'}"`, ""],
      ["SHA-256 Checksum", `"${result.sha256}"`, ""],
      ["MD5 Hash", `"${result.md5}"`, ""],
      ["Malware Indicators", `"${result.malwareIndicators ? 'YES' : 'NO'}"`, ""],
      ["Analyzed At", `"${new Date(result.timestamp).toLocaleString()}"`, ""],
    ]

    const csvContent = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `forensics-${result.fileName}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV Report exported")
  }

  const exportAsPDF = () => {
    if (!result) return
    const printWin = window.open("", "_blank")
    if (!printWin) { toast.error("Pop-up blocked. Allow popups to print/export PDF."); return }

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>StegShield X — Forensics Report (${result.fileName})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #0f172a; background: #fff; }
    h1 { color: #4f46e5; margin-bottom: 4px; font-size: 24px; }
    .subtitle { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
    .card .val { font-size: 20px; font-weight: bold; color: #0f172a; }
    .card .lbl { font-size: 11px; color: #64748b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #475569; }
    .hash { font-family: monospace; font-size: 11px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>StegShield X Digital Forensics Report</h1>
  <p class="subtitle">Generated on ${new Date().toLocaleString()} | Target: ${result.fileName}</p>
  
  <div class="grid">
    <div class="card"><div class="val">${result.overallRisk.toUpperCase()}</div><div class="lbl">Overall Risk</div></div>
    <div class="card"><div class="val">${result.entropy} / 8.0</div><div class="lbl">Shannon Entropy</div></div>
    <div class="card"><div class="val">${(result.stegoProbability * 100).toFixed(0)}%</div><div class="lbl">Stego Risk</div></div>
    <div class="card"><div class="val">${result.threatScore} / 100</div><div class="lbl">Threat Index</div></div>
  </div>

  <h2>File Details & Checksums</h2>
  <table>
    <tr><th>Property</th><th>Value</th></tr>
    <tr><td>Target Filename</td><td>${result.fileName}</td></tr>
    <tr><td>File Type</td><td>${result.fileType} (${formatSize(result.fileSize)})</td></tr>
    <tr><td>SHA-256 Checksum</td><td class="hash">${result.sha256}</td></tr>
    <tr><td>MD5 Hash</td><td class="hash">${result.md5}</td></tr>
    <tr><td>Malware Indicators</td><td>${result.malwareIndicators ? "Detected" : "None"}</td></tr>
    <tr><td>Analyzed At</td><td>${new Date(result.timestamp).toLocaleString()}</td></tr>
  </table>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`

    printWin.document.write(html)
    printWin.document.close()
    toast.success("PDF Print/Export window opened")
  }

  const deleteReportItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await api.delete(`/forensics/reports/${id}`)
      setReports(prev => prev.filter(r => r.id !== id))
      if (result?.id === id) setResult(null)
      toast.success("Report deleted")
    } catch {
      toast.error("Failed to delete report")
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(true)
    toast.success("Hash copied to clipboard")
    setTimeout(() => setCopiedHash(false), 2000)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Forensics"
        description="Advanced AI-powered steganalysis, tamper detection, deepfake analysis, and threat scoring"
        action={{ label: "Refresh / Clear", icon: RotateCcw, onClick: clearFile }}
      />

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === "reports") loadReports() }} className="space-y-6">
        <TabsList>
          <TabsTrigger value="analyze"><Search className="h-4 w-4 mr-2" />Analyze</TabsTrigger>
          <TabsTrigger value="results" disabled={!result}><BarChart3 className="h-4 w-4 mr-2" />Results {result ? `(${result.overallRisk.toUpperCase()})` : ""}</TabsTrigger>
          <TabsTrigger value="reports"><FileText className="h-4 w-4 mr-2" />Reports ({reports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="analyze">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card border-cyber-500/20 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5 text-cyber-400" />
                  Upload Target File
                </CardTitle>
                {file && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-400" onClick={clearFile}>
                    <X className="h-3.5 w-3.5 mr-1" /> Clear
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    dragOver ? "border-cyber-500 bg-cyber-500/10 shadow-lg shadow-cyber-500/10" : "border-border/60 hover:border-cyber-500/50 bg-background/40"
                  }`}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOver(false)
                    const f = e.dataTransfer.files[0]
                    if (f) handleFile(f)
                  }}
                >
                  <input ref={inputRef} type="file" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  />
                  <Upload className="h-12 w-12 text-cyber-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm font-medium mb-1">Drop target file here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Images (JPG/PNG/BMP), Documents, Binaries (EXE/ELF/ZIP) — up to 500MB</p>
                </div>

                {analyzing && (
                  <div className="space-y-2 p-4 rounded-xl border border-cyber-500/30 bg-cyber-500/5">
                    <div className="flex items-center gap-2 text-sm text-cyber-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Running comprehensive AI forensic scan... ({progress}%)</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {file && !analyzing && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-muted/40 border border-border/50 flex items-start gap-4">
                      {previewUrl ? (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-border">
                          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-cyber-500/10 border border-cyber-500/20 flex items-center justify-center shrink-0">
                          <File className="h-6 w-6 text-cyber-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatSize(file.size)} &middot; {file.type || "binary"}</p>
                        <Badge variant="outline" className="mt-2 text-[10px] bg-cyber-500/10 text-cyber-400 border-cyber-500/30">
                          Ready for scanning
                        </Badge>
                      </div>
                      <button onClick={clearFile} className="text-muted-foreground hover:text-red-400 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <Button variant="cyber" className="w-full h-11 text-sm font-bold gap-2" onClick={runAnalysis}>
                      <Zap className="h-4 w-4" /> Run Full Forensic Analysis
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle className="text-lg">Forensic Engine Capabilities</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Sigma, name: "Shannon Entropy", desc: "Measure byte randomness to detect encryption" },
                  { icon: Eye, name: "LSB Steganalysis", desc: "Detect hidden LSB bit patterns in media" },
                  { icon: ScanLine, name: "Tamper Detection", desc: "Gradient-based image manipulation scan" },
                  { icon: Image, name: "Error Level Analysis", desc: "JPEG compression level anomaly detection" },
                  { icon: Layers, name: "Deepfake Scanner", desc: "AI spectral/frequency facial analysis" },
                  { icon: FileCode, name: "File Structure", desc: "Magic byte validation & corruption checks" },
                  { icon: Bug, name: "Malware Patterns", desc: "Executable header & signature scanning" },
                  { icon: Network, name: "Embedded Carving", desc: "Detect hidden files appended or embedded" },
                  { icon: List, name: "String Extraction", desc: "Extract ASCII/Unicode strings for analysis" },
                  { icon: Fingerprint, name: "Cryptographic Hashes", desc: "SHA-256 + MD5 hash integrity verification" },
                ].map(({ icon: Icon, name, desc }) => (
                  <div key={name} className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-muted/20 hover:border-cyber-500/30 transition-all">
                    <Icon className="h-5 w-5 text-cyber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{name}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="results">
          {result ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl glass-card border border-border shadow-md">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-cyber-500/10 text-cyber-400">
                    <FileSearch className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold truncate max-w-xs sm:max-w-md">{result.fileName}</p>
                    <p className="text-xs text-muted-foreground">Analyzed at {new Date(result.timestamp).toLocaleTimeString()} · {formatSize(result.fileSize)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1.5 text-cyber-400" /> Export <ChevronDown className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={exportAsJSON} className="cursor-pointer">
                        <FileJson className="h-4 w-4 mr-2 text-cyan-400" /> Export JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportAsCSV} className="cursor-pointer">
                        <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-400" /> Export CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportAsPDF} className="cursor-pointer">
                        <FileText className="h-4 w-4 mr-2 text-purple-400" /> Export PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="destructive" size="sm" onClick={clearFile}>
                    <Trash2 className="h-4 w-4 mr-1.5" /> Clear & Delete Analysis
                  </Button>
                </div>
              </div>
              {result.degraded && (
                <Card className="glass-card border-amber-500/30 bg-amber-500/5">
                  <CardContent className="p-3.5 flex items-center gap-3 text-sm">
                    <WifiOff className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-amber-500 font-medium">Degraded Analysis Warning:</span>
                    <span className="text-xs text-muted-foreground">
                      AI service partially offline. Local forensic fallbacks executed — entropy, LSB, and hashes remain 100% accurate.
                    </span>
                  </CardContent>
                </Card>
              )}

              {/* Threat Score Hero Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="glass-card border-cyber-500/30 shadow-lg shadow-cyber-500/5">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <Shield className="h-5 w-5 text-cyber-400" />
                      <RiskBadge level={result.overallRisk} />
                    </div>
                    <p className="text-3xl font-black">{result.overallRisk.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground mt-1">Overall Threat Assessment</p>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <Sigma className="h-5 w-5 text-cyan-400" />
                      <Badge variant={result.entropySuspicious ? "destructive" : "success"}>
                        {result.entropySuspicious ? "HIGH ENTROPY" : "NORMAL"}
                      </Badge>
                    </div>
                    <p className="text-3xl font-black text-cyan-400">{result.entropy.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Shannon Entropy (Max 8.0)</p>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <Eye className="h-5 w-5 text-amber-400" />
                      <RiskBadge level={result.stegoRisk} />
                    </div>
                    <p className="text-3xl font-black text-amber-400">{(result.stegoProbability * 100).toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Steganography Risk</p>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <Bug className="h-5 w-5 text-red-400" />
                      <Badge variant={result.threatLevel === "critical" || result.threatLevel === "high" ? "destructive" : result.threatLevel === "medium" ? "warning" : "success"}>
                        {result.threatLevel.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-3xl font-black text-red-400">{result.threatScore}</p>
                    <p className="text-xs text-muted-foreground mt-1">Threat Score (0-100)</p>
                  </CardContent>
                </Card>
              </div>

              {/* Analysis Detail Cards */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Fingerprint className="h-4 w-4 text-cyber-400" /> File Identification & Hashes</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                      <p className="text-xs text-muted-foreground mb-1">Target Filename</p>
                      <p className="text-sm font-bold truncate">{result.fileName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatSize(result.fileSize)} &middot; {result.fileType}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">SHA-256 Checksum</p>
                        <button onClick={() => copyToClipboard(result.sha256)} className="text-[10px] text-cyber-400 hover:underline flex items-center gap-1">
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                      </div>
                      <p className="text-[10px] font-mono break-all text-foreground">{result.sha256}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                      <p className="text-xs text-muted-foreground mb-1">MD5 Hash</p>
                      <p className="text-[10px] font-mono break-all text-foreground">{result.md5}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Analyzed {new Date(result.timestamp).toLocaleString()}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                            <Download className="h-3.5 w-3.5" /> Export <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={exportAsJSON} className="cursor-pointer">
                            <FileJson className="h-4 w-4 mr-2 text-cyan-400" /> Export JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={exportAsCSV} className="cursor-pointer">
                            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-400" /> Export CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={exportAsPDF} className="cursor-pointer">
                            <FileText className="h-4 w-4 mr-2 text-purple-400" /> Export PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyber-400" /> Multi-Layer Risk Scoring</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <ScoreGauge value={result.entropy} max={8} label="Entropy Score" color="bg-cyan-500" />
                    <ScoreGauge value={result.stegoProbability * 100} max={100} label="Steganography Risk" color="bg-amber-500" />
                    <ScoreGauge value={result.threatScore} max={100} label="Overall Threat Index" color="bg-red-500" />
                    {result.tamperProbability != null && (
                      <ScoreGauge value={result.tamperProbability * 100} max={100} label="Tamper Probability" color="bg-orange-500" />
                    )}
                    {result.deepfakeProbability != null && (
                      <ScoreGauge value={result.deepfakeProbability * 100} max={100} label="Deepfake Confidence" color="bg-purple-500" />
                    )}
                    {result.threatBreakdown && <ThreatRadar breakdown={result.threatBreakdown} />}
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4 text-cyber-400" /> Steganalysis & LSB Analysis</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                        <p className="text-xs text-muted-foreground">LSB Ratio</p>
                        <p className="text-lg font-mono font-bold mt-1">{result.lsbRatio.toFixed(4)}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                        <p className="text-xs text-muted-foreground">LSB Deviation</p>
                        <p className="text-lg font-mono font-bold mt-1">{result.lsbDeviation.toFixed(4)}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30 border border-border/40">
                      <span className="text-xs text-muted-foreground">Expected LSB Ratio (Clean)</span>
                      <span className="font-mono text-xs">0.5000</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30 border border-border/40">
                      <span className="text-xs font-medium">LSB Suspicion Status</span>
                      <Badge variant={result.stegoSuspicion ? "destructive" : "success"}>
                        {result.stegoSuspicion ? "SUSPICIOUS BIT DISTRIBUTION" : "CLEAN BIT DISTRIBUTION"}
                      </Badge>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Steganalysis Summary</p>
                      <p className="text-xs leading-relaxed">
                        {result.stegoSuspicion
                          ? "LSB bit distribution deviates significantly from expected 50/50 ratio, suggesting encrypted or hidden payload embedding."
                          : "LSB bit distribution matches baseline expectations (50/50 ratio). No obvious steganographic payload detected."}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileCode className="h-4 w-4 text-cyber-400" /> Structure Integrity & Malware Audit</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-xl bg-muted/30 border border-border/40">
                      <span className="text-xs font-medium">File Structure Status</span>
                      <Badge variant={result.fileStructureValid ? "success" : "destructive"}>
                        {result.fileStructureValid ? "VALID FORMAT" : "CORRUPT / MALFORMED"}
                      </Badge>
                    </div>
                    {result.fileStructureIssues.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Structure Anomalies</p>
                        {result.fileStructureIssues.map((issue, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span>{issue}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {result.malwareIndicators && (
                      <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
                        <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                          <Bug className="h-4 w-4" /> Malware / Suspicious Indicators Detected
                        </p>
                        {result.maliciousStrings.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">Suspicious Code Patterns</p>
                            <div className="flex flex-wrap gap-1">
                              {result.maliciousStrings.map((s, i) => (
                                <Badge key={i} variant="destructive" className="text-[9px]">{s}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {result.executableHeaders.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">Executable Header Carvings</p>
                            {result.executableHeaders.slice(0, 5).map((h: any, i: number) => (
                              <p key={i} className="text-[10px] font-mono text-red-400">{h.type} at byte offset {h.offset}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {result.embeddedFiles.length > 0 && (
                  <Card className="glass-card lg:col-span-2">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4 text-cyber-400" /> Embedded / Carved Files ({result.embeddedFiles.length})</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {result.embeddedFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40 text-xs">
                            <div className="flex items-center gap-2">
                              <File className="h-4 w-4 text-cyber-400" />
                              <span className="font-bold">{f.type}</span>
                            </div>
                            <span className="text-muted-foreground font-mono">Byte Offset: {f.offset}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {result.extractedStrings.length > 0 && (
                  <Card className="glass-card lg:col-span-2">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><List className="h-4 w-4 text-cyber-400" /> Extracted ASCII Strings ({result.extractedStrings.length})</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto font-mono text-[10px]">
                        {result.extractedStrings.slice(0, 45).map((s, i) => (
                          <div key={i} className="p-2 rounded-lg bg-muted/20 border border-border/30 truncate text-foreground/80 hover:text-foreground">
                            {s}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <Card className="glass-card border-dashed border-border/40">
              <CardContent className="p-16 text-center text-muted-foreground">
                <FileSearch className="h-12 w-12 mx-auto mb-3 opacity-40 text-cyber-400" />
                <p className="text-sm font-medium text-foreground mb-1">No Active Scan Result</p>
                <p className="text-xs text-muted-foreground">Upload and analyze a file in the "Analyze" tab or select a report from history</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Forensic Reports History</CardTitle>
                  <CardDescription className="text-xs">Past file scans and threat assessments saved to database</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadReports} disabled={loadingReports} className="h-8 text-xs gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingReports ? "animate-spin" : ""}`} /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-cyber-400" />
                </div>
              ) : reports.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-foreground mb-1">No forensic reports saved</p>
                  <p className="text-xs text-muted-foreground">Analyze a file to generate permanent reports</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map((r) => (
                    <div key={r.id} className="p-4 rounded-xl border border-border/40 bg-muted/20 flex items-center justify-between hover:border-cyber-500/40 hover:bg-muted/40 transition-all cursor-pointer"
                      onClick={() => { setResult(r); setActiveTab("results") }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{r.fileName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{new Date(r.timestamp).toLocaleString()}</span>
                          <span>&middot;</span>
                          <span>{formatSize(r.fileSize)}</span>
                          <span>&middot;</span>
                          <span className="font-mono text-[10px]">{r.sha256.substring(0, 16)}...</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <RiskBadge level={r.overallRisk} />
                        <Badge variant="outline" className="text-[10px] font-mono">
                          Entropy: {r.entropy.toFixed(2)}
                        </Badge>
                        <button onClick={(e) => deleteReportItem(r.id, e)} className="text-muted-foreground hover:text-red-400 transition-colors p-1" title="Delete Report">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
