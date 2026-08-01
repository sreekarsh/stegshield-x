"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  Upload, FileSearch, Loader2, File, AlertTriangle, CheckCircle2,
  Clock, Trash2, Download, Shield, Bug, ScanLine, Image, FileCode,
  Sigma, Zap, Eye, Layers, Fingerprint, X, Search, FileText, List, WifiOff,
  RotateCcw, Copy, Check, ChevronRight, Activity, ArrowRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { Progress } from "@/components/ui/progress"
import toast from "react-hot-toast"
import { api } from "@/lib/api"

interface TamperReport {
  id: string
  fileName: string
  fileType: string
  fileSize: number
  sha256: string
  tamperProbability: number | null
  tamperScore: number | null
  tamperAnalysis: string | null
  deepfakeProbability: number | null
  deepfakeConfidence: number | null
  deepfakeAnalysis: string | null
  deepfakeFeatures: string[]
  threatScore: number
  threatLevel: string
  threatBreakdown: Record<string, boolean>
  malwareHeaders: any[]
  malwareStrings: string[]
  avgEntropy: number
  maxEntropy: number
  entropySuspicious: boolean
  lsbRatio: number
  lsbDeviation: number
  stegoSuspicion: boolean
  structureValid: boolean
  structureIssues: string[]
  elaAvailable: boolean
  elaScore: number | null
  elaProbability: number | null
  overallRisk: string
  degraded: boolean
  timestamp: string
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
    high: { variant: "destructive", label: "HIGH" },
    medium: { variant: "warning", label: "MEDIUM" },
    low: { variant: "success", label: "LOW" },
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
        <span className="font-mono font-medium">{value.toFixed(value > 10 ? 0 : 2)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ThreatGrid({ breakdown }: { breakdown: Record<string, boolean> }) {
  const items = Object.entries(breakdown)
  const active = items.filter(([, v]) => v).length
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Threat Indicators ({active}/{items.length})
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {items.map(([key, val]) => (
          <div key={key} className={`flex items-center gap-1.5 text-xs p-1.5 rounded ${val ? "bg-destructive/10 text-destructive" : "bg-muted/30 text-muted-foreground"}`}>
            {val ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <CheckCircle2 className="h-3 w-3 shrink-0" />}
            <span className="truncate">{key.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TamperDetectionPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<TamperReport | null>(null)
  const [reports, setReports] = useState<TamperReport[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)
  const [activeTab, setActiveTab] = useState("analyze")
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const loadReports = useCallback(async () => {
    setLoadingReports(true)
    try {
      const data: any = await api.get("/tamper/reports?limit=50")
      setReports(data.items || [])
    } catch { setReports([]) }
    finally { setLoadingReports(false) }
  }, [])

  useEffect(() => {
    if (!file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      return
    }
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setPreviewUrl(null)
    }
  }, [file])

  const MAX_FILE_SIZE = 500 * 1024 * 1024

  const handleFile = useCallback((f: File) => {
    if (f.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 500MB.")
      return
    }
    setFile(f)
    setResult(null)
  }, [])

  const resetAll = () => {
    setFile(null)
    setResult(null)
    setActiveTab("analyze")
    if (inputRef.current) inputRef.current.value = ""
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
      const data: any = await api.upload("/tamper/analyze", formData)
      setProgress(95)
      setResult(data as TamperReport)
      setProgress(100)
      toast.success("Full forensic analysis complete")
      setActiveTab("results")
      loadReports()
    } catch (e: any) {
      toast.error(e?.message || "Analysis failed")
    } finally {
      setAnalyzing(false)
      setProgress(0)
    }
  }

  const deleteReport = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Delete this tamper report?")) return
    setDeletingId(id)
    try {
      await api.delete(`/tamper/reports/${id}`)
      setReports(prev => prev.filter(r => r.id !== id))
      if (result?.id === id) setResult(null)
      toast.success("Report deleted")
    } catch {
      toast.error("Failed to delete report")
    } finally {
      setDeletingId(null)
    }
  }

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
    setCopiedHash(true)
    toast.success("SHA-256 copied to clipboard")
    setTimeout(() => setCopiedHash(false), 2000)
  }

  const exportReport = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tamper-${result.fileName}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Report exported")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tamper & Deepfake Detection"
        description="AI-powered detection of image tampering, deepfakes, malware, steganography, and file integrity threats"
        action={{ label: "Reset / Clear", icon: RotateCcw, onClick: resetAll }}
      />

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === "reports") loadReports() }} className="space-y-6">
        <TabsList>
          <TabsTrigger value="analyze"><Upload className="h-4 w-4 mr-2" />Analyze</TabsTrigger>
          <TabsTrigger value="results"><Search className="h-4 w-4 mr-2" />Results</TabsTrigger>
          <TabsTrigger value="reports"><FileText className="h-4 w-4 mr-2" />Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="analyze">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader><CardTitle>Upload File for Tamper & Deepfake Scan</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragOver ? "border-cyber-500 bg-cyber-500/10 shadow-lg shadow-cyber-500/10" : "border-border hover:border-cyber-500/50 bg-background/20"
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
                  <Upload className="h-10 w-10 text-cyber-400 mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">Drop file here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Images, videos, binaries — any file up to 500MB</p>
                </div>

                {/* Hero preview card */}
                {file && (
                  <div className="p-4 rounded-xl border border-cyber-500/30 bg-cyber-500/5 space-y-3">
                    <div className="flex items-center gap-3">
                      {previewUrl ? (
                        <div className="relative h-16 w-16 rounded-lg overflow-hidden border border-cyber-500/40 bg-black shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-cyber-500/10 border border-cyber-500/30 flex items-center justify-center shrink-0">
                          <File className="h-6 w-6 text-cyber-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(file.size)} &middot; {file.type || "unknown"}</p>
                      </div>
                      <button onClick={() => { setFile(null); setResult(null) }} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {analyzing ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs text-cyber-400">
                          <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing tampering, deepfakes & malware...</span>
                          <span className="font-mono">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    ) : (
                      <Button variant="cyber" className="w-full h-11" onClick={runAnalysis}>
                        <Zap className="mr-2 h-4 w-4" /> Run Full Forensics Suite
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle>Detection Capabilities</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: ScanLine, name: "Image Tamper Detection", desc: "Gradient-based analysis to detect pixel-level manipulation and splicing" },
                  { icon: Layers, name: "Deepfake Detection", desc: "Frequency domain, color correlation, noise consistency, and edge coherence analysis" },
                  { icon: Image, name: "Error Level Analysis (ELA)", desc: "Detect JPEG re-save artifacts indicating region-specific tampering" },
                  { icon: Bug, name: "Malware & Payload Scanning", desc: "Executable headers (PE/ELF/Mach-O) and malicious API string patterns" },
                  { icon: Sigma, name: "Segmented Entropy Analysis", desc: "16-segment entropy scan to find encrypted or obfuscated payload regions" },
                  { icon: Eye, name: "LSB Steganalysis", desc: "Least Significant Bit deviation analysis for hidden data detection" },
                  { icon: FileCode, name: "File Structure Validation", desc: "Magic byte verification, null-byte ratio, and truncation detection" },
                  { icon: Fingerprint, name: "SHA-256 Integrity Hashing", desc: "Cryptographic hash for evidence integrity and chain-of-custody" },
                ].map(({ icon: Icon, name, desc }) => (
                  <div key={name} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors border border-transparent hover:border-border/40">
                    <Icon className="h-5 w-5 text-cyber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
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
                    <ScanLine className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold truncate max-w-xs sm:max-w-md">{result.fileName}</p>
                    <p className="text-xs text-muted-foreground">Scanned at {new Date(result.timestamp).toLocaleTimeString()} · {formatSize(result.fileSize)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="destructive" size="sm" onClick={resetAll}>
                    <Trash2 className="h-4 w-4 mr-1.5" /> Clear & Delete Analysis
                  </Button>
                </div>
              </div>
              {result.degraded && (
                <Card className="glass-card border-amber-500/30">
                  <CardContent className="p-3 flex items-center gap-2 text-sm">
                    <WifiOff className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="text-amber-500 font-medium">Degraded Analysis</span>
                    <span className="text-muted-foreground">
                      &mdash; AI service was partially unavailable. Some scores use local fallbacks and may be less accurate.
                    </span>
                  </CardContent>
                </Card>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <RiskBadge level={result.overallRisk} />
                    </div>
                    <p className="text-2xl font-bold">{result.overallRisk.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">Overall Threat Level</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <ScanLine className="h-5 w-5 text-muted-foreground" />
                      {result.tamperProbability != null ? (
                        <Badge variant={result.tamperProbability > 0.5 ? "destructive" : result.tamperProbability > 0.3 ? "warning" : "success"}>
                          {(result.tamperProbability * 100).toFixed(0)}%
                        </Badge>
                      ) : <Badge variant="outline">N/A</Badge>}
                    </div>
                    <p className="text-2xl font-bold">{result.tamperProbability != null ? (result.tamperProbability * 100).toFixed(0) : "—"}%</p>
                    <p className="text-xs text-muted-foreground">Tamper Probability</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Layers className="h-5 w-5 text-muted-foreground" />
                      {result.deepfakeProbability != null ? (
                        <Badge variant={result.deepfakeProbability > 0.6 ? "destructive" : result.deepfakeProbability > 0.3 ? "warning" : "success"}>
                          {(result.deepfakeProbability * 100).toFixed(0)}%
                        </Badge>
                      ) : <Badge variant="outline">N/A</Badge>}
                    </div>
                    <p className="text-2xl font-bold">{result.deepfakeProbability != null ? (result.deepfakeProbability * 100).toFixed(0) : "—"}%</p>
                    <p className="text-xs text-muted-foreground">Deepfake Probability</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <Badge variant={result.threatLevel === "critical" || result.threatLevel === "high" ? "destructive" : result.threatLevel === "medium" ? "warning" : "success"}>
                        {result.threatLevel.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">{result.threatScore}</p>
                    <p className="text-xs text-muted-foreground">Aggregate Threat Score</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="glass-card">
                  <CardHeader><CardTitle>File Info & Verification</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">File</p>
                      <p className="text-sm font-medium truncate">{result.fileName}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(result.fileSize)} &middot; {result.fileType}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">SHA-256 Hash</p>
                        <button className="text-xs text-cyber-400 hover:underline flex items-center gap-1" onClick={() => copyHash(result.sha256)}>
                          {copiedHash ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                          {copiedHash ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <p className="text-[10px] font-mono break-all">{result.sha256}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Analyzed {new Date(result.timestamp).toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={exportReport}>
                        <Download className="mr-2 h-4 w-4" />Export JSON
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { setResult(null); setFile(null); setActiveTab("analyze") }}>
                        <Upload className="mr-2 h-4 w-4" />New Analysis
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader><CardTitle>Score Breakdown</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <ScoreGauge value={result.avgEntropy} max={8} label="Avg Entropy" color="bg-cyan-500" />
                    <ScoreGauge value={result.threatScore} max={100} label="Threat Score" color="bg-red-500" />
                    {result.tamperProbability != null && (
                      <ScoreGauge value={result.tamperProbability * 100} max={100} label="Tamper Risk" color="bg-orange-500" />
                    )}
                    {result.deepfakeProbability != null && (
                      <ScoreGauge value={result.deepfakeProbability * 100} max={100} label="Deepfake Risk" color="bg-purple-500" />
                    )}
                    <ScoreGauge value={Math.abs(result.lsbDeviation) * 200} max={100} label="LSB Anomaly" color="bg-amber-500" />
                    <ThreatGrid breakdown={result.threatBreakdown} />
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader><CardTitle>Entropy Analysis</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">Average Entropy</span>
                      <Badge variant={result.entropySuspicious ? "warning" : "success"}>
                        {result.avgEntropy.toFixed(4)}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">Max Segment Entropy</span>
                      <span className="font-mono text-sm">{result.maxEntropy.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">Suspicious Segments</span>
                      <Badge variant={result.entropySuspicious ? "destructive" : "success"}>
                        {result.entropySuspicious ? "DETECTED" : "CLEAN"}
                      </Badge>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Interpretation</p>
                      <p className="text-xs mt-1">
                        {result.entropySuspicious
                          ? "File contains segments with entropy > 7.5, indicating possible encrypted or compressed payloads hidden within."
                          : "Entropy across all segments is within normal range. No signs of encrypted or obfuscated payloads."}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader><CardTitle>LSB Steganalysis</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">LSB Bit Ratio</span>
                      <span className="font-mono text-sm">{result.lsbRatio.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">Deviation from 50%</span>
                      <span className="font-mono text-sm">{result.lsbDeviation.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">Hidden Data Suspicion</span>
                      <Badge variant={result.stegoSuspicion ? "destructive" : "success"}>
                        {result.stegoSuspicion ? "SUSPICIOUS" : "CLEAN"}
                      </Badge>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Interpretation</p>
                      <p className="text-xs mt-1">
                        {result.stegoSuspicion
                          ? "LSB distribution deviates significantly from expected 50/50. Possible steganographic embedding detected."
                          : "LSB distribution is close to expected 50/50 ratio. No obvious hidden data in least significant bits."}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader><CardTitle>File Structure</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">Magic Bytes Valid</span>
                      <Badge variant={result.structureValid ? "success" : "destructive"}>
                        {result.structureValid ? "VALID" : "CORRUPT"}
                      </Badge>
                    </div>
                    {result.structureIssues.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Issues</p>
                        {result.structureIssues.map((issue, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-destructive/10 text-destructive">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            {issue}
                          </div>
                        ))}
                      </div>
                    )}
                    {result.malwareHeaders.length > 0 && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-xs font-medium text-destructive flex items-center gap-1 mb-1">
                          <Bug className="h-3 w-3" /> Executable Headers Detected
                        </p>
                        {result.malwareHeaders.slice(0, 5).map((h: any, i: number) => (
                          <p key={i} className="text-[10px] font-mono text-destructive/80">{h.type} at offset {h.offset} ({h.section})</p>
                        ))}
                      </div>
                    )}
                    {result.malwareStrings.length > 0 && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-xs font-medium text-destructive flex items-center gap-1 mb-1">
                          <List className="h-3 w-3" /> Malicious API Strings
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.malwareStrings.map((s, i) => (
                            <Badge key={i} variant="destructive" className="text-[9px]">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {result.tamperProbability != null && (
                  <Card className="glass-card">
                    <CardHeader><CardTitle>Tamper Detection</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                        <span className="text-sm">Tamper Probability</span>
                        <Badge variant={result.tamperProbability > 0.5 ? "destructive" : result.tamperProbability > 0.3 ? "warning" : "success"}>
                          {(result.tamperProbability * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                        <span className="text-sm">Tamper Score</span>
                        <span className="font-mono text-sm">{result.tamperScore?.toFixed(2)}</span>
                      </div>
                      {result.tamperAnalysis && (
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground mb-1">Analysis</p>
                          <p className="text-xs">{result.tamperAnalysis}</p>
                        </div>
                      )}
                      {result.elaAvailable && (
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs font-medium mb-1">Error Level Analysis (ELA)</p>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Score</span>
                            <span className="font-mono">{result.elaScore?.toFixed(4) ?? "—"}</span>
                          </div>
                          <div className="flex justify-between items-center mt-1 text-xs">
                            <span className="text-muted-foreground">Anomaly Probability</span>
                            <Badge variant={(result.elaProbability ?? 0) > 0.5 ? "destructive" : "success"}>
                              {((result.elaProbability ?? 0) * 100).toFixed(0)}%
                            </Badge>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {result.deepfakeProbability != null && (
                  <Card className="glass-card">
                    <CardHeader><CardTitle>Deepfake Detection</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                        <span className="text-sm">Deepfake Probability</span>
                        <Badge variant={result.deepfakeProbability > 0.6 ? "destructive" : result.deepfakeProbability > 0.3 ? "warning" : "success"}>
                          {(result.deepfakeProbability * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                        <span className="text-sm">Confidence</span>
                        <span className="font-mono text-sm">{(result.deepfakeConfidence! * 100).toFixed(0)}%</span>
                      </div>
                      {result.deepfakeAnalysis && (
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground mb-1">Analysis</p>
                          <p className="text-xs">{result.deepfakeAnalysis}</p>
                        </div>
                      )}
                      {result.deepfakeFeatures.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Features Analyzed</p>
                          <div className="flex flex-wrap gap-1">
                            {result.deepfakeFeatures.map((f, i) => (
                              <Badge key={i} variant="outline" className="text-[9px]">{f.replace(/_/g, " ")}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-12 text-center text-muted-foreground">
                <FileSearch className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Run a forensic analysis to see results</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Tamper Analysis Reports</CardTitle>
                  <CardDescription className="text-xs">History of all analyzed files and forensic scans</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadReports} disabled={loadingReports}>
                  <RotateCcw className={`mr-2 h-3.5 w-3.5 ${loadingReports ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingReports ? (
                <div className="p-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : reports.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium text-foreground mb-1">No tamper reports yet</p>
                  <p className="text-xs">Analyze a file to generate forensic reports</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {reports.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => { setResult(r); setActiveTab("results") }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold truncate max-w-[300px]">{r.fileName}</p>
                          <RiskBadge level={r.overallRisk} />
                          {r.tamperProbability != null && (
                            <Badge variant="outline" className="text-[9px]">Tamper: {(r.tamperProbability * 100).toFixed(0)}%</Badge>
                          )}
                          {r.deepfakeProbability != null && (
                            <Badge variant="outline" className="text-[9px]">Deepfake: {(r.deepfakeProbability * 100).toFixed(0)}%</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-3">
                          <span>{new Date(r.timestamp).toLocaleString()}</span>
                          <span>&middot;</span>
                          <span>{formatSize(r.fileSize)}</span>
                          <span>&middot;</span>
                          <span className="font-mono text-[10px]">{r.sha256.substring(0, 12)}...</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => deleteReport(r.id, e)}
                          disabled={deletingId === r.id}
                          title="Delete report"
                        >
                          {deletingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
