"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  Brain, Send, Upload, Shield, Lock, FileText, AlertTriangle,
  CheckCircle, CheckCircle2, Key, ScanFace, Search, StopCircle, Sparkles,
  Bot, User, Zap, Trash2, Copy, Check, RotateCcw, Eye, EyeOff,
  X, Activity, Info, Loader2, TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { api, streamChat } from "@/lib/api"
import { Markdown } from "@/components/chat/markdown"
import toast from "react-hot-toast"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: Date
}

interface AnalysisResult {
  entropy?: number
  stego_probability?: number
  threat_score?: number
  threat_level?: string
  indicators?: { type: string; severity: string; value: string; description: string }[]
  tamper_probability?: number
  tamper_score?: number
  deepfake_probability?: number
  deepfake_confidence?: number
  strength_score?: number
  security_score?: number
  issues?: { severity: string; title: string; description: string }[]
  grade?: string
  overall_score?: number
  error?: string
  hash?: string
  entropy_ratio?: number
  suspicious?: boolean
  lsb_ratio?: number
  lsb_deviation?: number
  segment_cv?: number
  recommended_action?: string
  analysis?: string
  dimensions?: string
  size?: number
  file_format?: string
  recommendations?: string[]
  segmented_analysis?: {
    segments: number
    avg_segment_entropy: number
    max_segment_entropy: number
    segment_std_dev: number
    high_entropy_segments: number
  }
  feedback?: string
  checks?: Record<string, boolean>
  entropy_bits?: number
  crack_time_display?: string
  charset_size?: number
  has_lowercase?: boolean
  has_uppercase?: boolean
  has_digits?: boolean
  has_symbols?: boolean
  password_length?: number
}

const SUGGESTED_PROMPTS = [
  { icon: Lock,     label: "Password tips",     query: "What makes a strong password? Give me specific tips." },
  { icon: Search,   label: "Steganography",      query: "How does LSB steganography detection work in images?" },
  { icon: Shield,   label: "Threat detection",   query: "What are signs of a malicious file I should watch for?" },
  { icon: Key,      label: "Best encryption",    query: "What encryption algorithm should I use for files?" },
  { icon: ScanFace, label: "Deepfake detection", query: "How can deepfakes be detected using AI analysis?" },
  { icon: FileText, label: "Metadata risks",     query: "What sensitive metadata do image files leak, and how do I strip it?" },
  { icon: Brain,    label: "Zero-day threats",   query: "What are zero-day vulnerabilities and how can I protect against them?" },
  { icon: Activity, label: "Forensics tips",     query: "What are key steps in digital forensic file analysis?" },
]

function mkId() { return Math.random().toString(36).slice(2) }

function ScoreRing({ value, max = 100, label, color }: { value: number; max?: number; label: string; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  const r = 36
  const circ = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
          <circle cx="44" cy="44" r={r} fill="none" strokeWidth="7"
            strokeDasharray={`${(pct / 100) * circ} ${circ}`}
            strokeLinecap="round"
            className={`${color} transition-all duration-700`}
            stroke="currentColor"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className={`text-xl font-black ${color}`}>{Math.round(value)}</span>
          <span className="text-[9px] text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  )
}

function AnalysisCard({ analysis, type }: { analysis: AnalysisResult; type: "file" | "threat" }) {
  if (analysis.error) {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p className="text-sm">{analysis.error}</p>
      </div>
    )
  }

  const threatLevel = analysis.threat_level || (
    (analysis.threat_score || 0) > 70 ? "high" : (analysis.threat_score || 0) > 30 ? "medium" : "low"
  )
  const threatVariant = threatLevel === "critical" || threatLevel === "high" ? "destructive"
    : threatLevel === "medium" ? "warning" : "success"

  return (
    <div className="space-y-4">
      {/* Score ring header */}
      {(analysis.entropy !== undefined || analysis.threat_score !== undefined || analysis.tamper_probability !== undefined || analysis.stego_probability !== undefined || analysis.deepfake_probability !== undefined) && (
        <div className="flex flex-wrap items-center justify-center gap-6 py-4 bg-muted/20 rounded-2xl border border-border/30">
          {analysis.entropy !== undefined && (
            <ScoreRing value={analysis.entropy} max={8} label="Entropy" color={analysis.entropy > 7.5 ? "text-red-400" : "text-green-400"} />
          )}
          {analysis.threat_score !== undefined && (
            <ScoreRing value={analysis.threat_score} max={100} label="Threat" color={analysis.threat_score > 50 ? "text-orange-400" : "text-green-400"} />
          )}
          {analysis.stego_probability !== undefined && (
            <ScoreRing value={analysis.stego_probability * 100} max={100} label="Stego %" color={analysis.stego_probability > 0.5 ? "text-red-400" : "text-cyan-400"} />
          )}
          {analysis.tamper_probability !== undefined && (
            <ScoreRing value={analysis.tamper_probability * 100} max={100} label="Tamper %" color={analysis.tamper_probability > 0.5 ? "text-orange-400" : "text-green-400"} />
          )}
          {analysis.deepfake_probability !== undefined && (
            <ScoreRing value={analysis.deepfake_probability * 100} max={100} label="Deepfake %" color={analysis.deepfake_probability > 0.5 ? "text-purple-400" : "text-green-400"} />
          )}
        </div>
      )}

      {/* AI Analysis Summary text */}
      {(analysis.analysis || analysis.recommended_action) && (
        <div className="p-3.5 rounded-xl bg-cyber-500/10 border border-cyber-500/30 text-xs">
          <p className="font-bold text-cyber-300 mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> AI Verdict & Recommendation
          </p>
          <p className="text-muted-foreground leading-relaxed">{analysis.analysis || analysis.recommended_action}</p>
        </div>
      )}

      {/* Threat level badge */}
      {analysis.threat_score !== undefined && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40">
          <span className="text-xs font-medium">Threat Assessment Level</span>
          <Badge variant={threatVariant} className="uppercase text-xs">{threatLevel}</Badge>
        </div>
      )}

      {/* LSB Steganalysis Detailed Panel */}
      {analysis.lsb_ratio !== undefined && analysis.lsb_deviation !== undefined && (
        <div className="p-3 rounded-xl bg-muted/30 border border-border/40 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">LSB Steganography Metrics</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-muted/40 text-center">
              <p className="text-[10px] text-muted-foreground">LSB Ratio</p>
              <p className="font-mono font-bold text-foreground mt-0.5">{analysis.lsb_ratio.toFixed(4)}</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/40 text-center">
              <p className="text-[10px] text-muted-foreground">LSB Deviation</p>
              <p className={`font-mono font-bold mt-0.5 ${analysis.lsb_deviation > 0.05 ? "text-red-400" : "text-green-400"}`}>
                {analysis.lsb_deviation.toFixed(4)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-muted/40 text-center">
              <p className="text-[10px] text-muted-foreground">Segment CV</p>
              <p className="font-mono font-bold text-foreground mt-0.5">{(analysis.segment_cv || 0).toFixed(4)}</p>
            </div>
          </div>
          <Progress value={Math.abs(analysis.lsb_deviation) * 1000} className="h-1.5" />
        </div>
      )}

      {/* Segmented Entropy Analysis Profile */}
      {analysis.segmented_analysis && (
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Segmented Entropy Profile</span>
            <Badge variant={analysis.suspicious ? "destructive" : "success"} className="text-[9px]">
              {analysis.suspicious ? "SUSPICIOUS VARIANCE" : "NORMAL DISTRIBUTION"}
            </Badge>
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between p-2 rounded-lg bg-muted/40">
              <span className="text-muted-foreground">Average Entropy</span>
              <span className="font-mono font-bold">{analysis.segmented_analysis.avg_segment_entropy}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-muted/40">
              <span className="text-muted-foreground">Max Segment Entropy</span>
              <span className="font-mono font-bold text-cyber-400">{analysis.segmented_analysis.max_segment_entropy}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-muted/40">
              <span className="text-muted-foreground">Std Deviation</span>
              <span className="font-mono font-bold">{analysis.segmented_analysis.segment_std_dev}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-muted/40">
              <span className="text-muted-foreground">High Entropy Slices</span>
              <span className={`font-mono font-bold ${analysis.segmented_analysis.high_entropy_segments > 0 ? "text-orange-400" : "text-green-400"}`}>
                {analysis.segmented_analysis.high_entropy_segments} / {analysis.segmented_analysis.segments}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Threat Indicators */}
      {analysis.indicators && analysis.indicators.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Threat Indicators ({analysis.indicators.length})</p>
          {analysis.indicators.map((ind, i) => {
            const color = ind.severity === "critical" || ind.severity === "high"
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : ind.severity === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
              : "border-green-500/30 bg-green-500/10 text-cyan-300"
            return (
              <div key={i} className={`p-3 rounded-xl border text-xs ${color}`}>
                <div className="flex justify-between items-start">
                  <span className="font-bold">{ind.type.replace(/_/g, " ")}</span>
                  <Badge variant={ind.severity === "critical" || ind.severity === "high" ? "destructive" : ind.severity === "medium" ? "warning" : "success"} className="text-[9px] ml-2 shrink-0">
                    {ind.severity.toUpperCase()}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{ind.description}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> Security Recommendations
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
            {analysis.recommendations.map((rec, i) => (
              <li key={i} className="leading-relaxed">{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Hash & Metadata Footer */}
      {analysis.hash && (
        <div className="p-3 rounded-xl bg-muted/30 border border-border/40 flex flex-col gap-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>SHA-256 Hash</span>
            {analysis.file_format && <span className="uppercase font-bold text-cyber-400">{analysis.file_format} Format</span>}
          </div>
          <p className="text-[10px] font-mono break-all text-foreground">{analysis.hash}</p>
        </div>
      )}
    </div>
  )
}

export default function AIAssistantPage() {
  const [message, setMessage] = useState("")
  const [chat, setChat] = useState<ChatMessage[]>([{
    id: mkId(),
    role: "assistant",
    timestamp: new Date(),
    text: "**Welcome to StegShield X AI Security Assistant** 🔒\n\nI'm your AI-powered cybersecurity analyst. I can help you with:\n\n- **🔐 Password Security** — Check and improve password strength\n- **🕵️ Steganalysis** — Detect hidden data in files\n- **🛡️ Threat Detection** — Scan files for malware indicators\n- **📷 Tamper Detection** — Detect image forgeries\n- **🤖 Deepfake Analysis** — Spot AI-generated media\n- **🏷️ Metadata Privacy** — Analyze and strip EXIF data\n- **🔎 Digital Forensics** — Full forensic file analysis\n\n**Ask me anything about security** or try one of the suggestions →",
  }])
  const [loading, setLoading] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  // File Analysis tab
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analysisFile, setAnalysisFile] = useState<File | null>(null)
  const [analysisType, setAnalysisType] = useState<"entropy" | "stego" | "threat" | "tamper" | "deepfake">("stego")
  const [scanning, setScanning] = useState(false)
  const [analysisDragOver, setAnalysisDragOver] = useState(false)

  // Password tab
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [passwordResult, setPasswordResult] = useState<AnalysisResult | null>(null)
  const [checkingPassword, setCheckingPassword] = useState(false)

  // Security scan
  const [securityResult, setSecurityResult] = useState<AnalysisResult | null>(null)
  const [runningScan, setRunningScan] = useState(false)

  // Threat tab
  const [threatAnalysis, setThreatAnalysis] = useState<AnalysisResult | null>(null)
  const [threatDragOver, setThreatDragOver] = useState(false)
  const [threatScanning, setThreatScanning] = useState(false)

  // Misc
  const [copiedMsg, setCopiedMsg] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("chat")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const threatFileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat])

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? message).trim()
    if (!msg || loading) return
    setMessage("")
    const userMsg: ChatMessage = { id: mkId(), role: "user", text: msg, timestamp: new Date() }
    const asstMsg: ChatMessage = { id: mkId(), role: "assistant", text: "", timestamp: new Date() }
    setChat(prev => [...prev, userMsg, asstMsg])
    setLoading(true)

    const controller = new AbortController()
    setAbortController(controller)

    try {
      const history = [...chat, userMsg].map(m => ({ role: m.role, content: m.text }))
      let accumulated = ""
      for await (const chunk of streamChat("/ai/chat/stream", history, controller.signal)) {
        accumulated += chunk
        setChat(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...asstMsg, text: accumulated }
          return updated
        })
      }
    } catch (err: any) {
      if (err.name === "AbortError") return
      setChat(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...asstMsg, text: "⚠️ **Error**: Failed to get a response. The AI service may be unavailable." }
        return updated
      })
    } finally {
      setLoading(false)
      setAbortController(null)
    }
  }, [message, chat, loading])

  const stopGeneration = useCallback(() => {
    abortController?.abort()
    setLoading(false)
  }, [abortController])

  const clearChat = () => {
    setChat([{
      id: mkId(), role: "assistant", timestamp: new Date(),
      text: "Chat cleared. Ask me anything about cybersecurity! 🔒",
    }])
    toast.success("Chat cleared")
  }

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedMsg(id)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedMsg(null), 2000)
  }

  const handleFileAnalysis = useCallback(async (file: File, type: typeof analysisType) => {
    setAnalysisFile(file)
    setAnalysisType(type)
    setScanning(true)
    setAnalysis(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const endpoint = type === "tamper" || type === "deepfake" ? `/ai/detect/${type}` : `/ai/analyze/${type}`
      const result = await api.upload<AnalysisResult>(endpoint, formData)
      setAnalysis(result)
      toast.success("Analysis complete")
    } catch (err: any) {
      const errMsg = err?.message || "Analysis failed"
      setAnalysis({ error: errMsg })
      toast.error(errMsg)
    } finally {
      setScanning(false)
    }
  }, [])

  const handleThreatAnalysis = useCallback(async (file: File) => {
    setThreatScanning(true)
    setThreatAnalysis(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await api.upload<AnalysisResult>("/ai/analyze/threat", formData)
      setThreatAnalysis(result)
      toast.success("Threat scan complete")
    } catch (err: any) {
      const errMsg = err?.message || "Threat scan failed"
      setThreatAnalysis({ error: errMsg })
      toast.error(errMsg)
    } finally {
      setThreatScanning(false)
    }
  }, [])

  const checkPassword = useCallback(async () => {
    if (!password) return
    setCheckingPassword(true)
    setPasswordResult(null)
    try {
      const result = await api.post<AnalysisResult>("/ai/analyze/password", { password })
      setPasswordResult(result)
    } catch (err: any) {
      setPasswordResult({ error: err?.message || "AI service unavailable" })
    } finally {
      setCheckingPassword(false)
    }
  }, [password])

  const runSecurityScan = useCallback(async () => {
    setRunningScan(true)
    setSecurityResult(null)
    try {
      const result = await api.post<AnalysisResult>("/ai/analyze/security", {})
      setSecurityResult(result)
      toast.success(`Security scan complete — Score: ${result.security_score || 0}/100`)
    } catch (err: any) {
      setSecurityResult({ error: err?.message || "AI service unavailable" })
      toast.error("Security scan failed")
    } finally {
      setRunningScan(false)
    }
  }, [])

  const strengthScore = passwordResult?.strength_score || 0
  const strengthLabel = strengthScore >= 80 ? "Strong" : strengthScore >= 60 ? "Fair" : strengthScore >= 40 ? "Weak" : "Very Weak"
  const strengthColor = strengthScore >= 80 ? "text-green-400" : strengthScore >= 60 ? "text-yellow-400" : strengthScore >= 40 ? "text-orange-400" : "text-red-400"
  const strengthBarColor = strengthScore >= 80 ? "bg-green-500" : strengthScore >= 60 ? "bg-yellow-500" : strengthScore >= 40 ? "bg-orange-500" : "bg-red-500"

  const ANALYSIS_TYPES: { value: typeof analysisType; label: string; desc: string }[] = [
    { value: "stego",    label: "Steganalysis",       desc: "Detect hidden data in LSB" },
    { value: "entropy",  label: "Entropy Analysis",   desc: "Byte randomness & encryption" },
    { value: "threat",   label: "Threat Scan",        desc: "Malware & suspicious patterns" },
    { value: "tamper",   label: "Tamper Detection",   desc: "Image manipulation detection" },
    { value: "deepfake", label: "Deepfake Detection", desc: "AI-generated content detection" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Security Assistant"
        description="Intelligent threat detection, analysis, and recommendations powered by AI"
        action={{ label: runningScan ? "Scanning..." : "Run Security Scan", icon: runningScan ? Loader2 : Shield, onClick: runSecurityScan }}
      />

      {/* Security Scan Result Banner */}
      {securityResult && (
        <Card className={`border ${securityResult.error ? "border-red-500/30 bg-red-500/10" : "border-cyber-500/30 bg-cyber-500/5"}`}>
          <CardContent className="p-4">
            {securityResult.error ? (
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm">{securityResult.error}</span>
                <button className="ml-auto" onClick={() => setSecurityResult(null)}><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-cyber-400" />
                    <span className="font-bold">Security Health Scan</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-cyber-400">{securityResult.security_score || 0}/100</span>
                    <button onClick={() => setSecurityResult(null)}><X className="h-4 w-4 text-muted-foreground hover:text-foreground" /></button>
                  </div>
                </div>
                <Progress value={securityResult.security_score || 0} className="h-2" />
                {securityResult.issues && securityResult.issues.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                    {securityResult.issues.map((issue, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded-lg border ${issue.severity === "high" ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"}`}>
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>{issue.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="chat"><Bot className="mr-1.5 h-3.5 w-3.5" /> AI Chat</TabsTrigger>
          <TabsTrigger value="analyze"><Search className="mr-1.5 h-3.5 w-3.5" /> Analyze File</TabsTrigger>
          <TabsTrigger value="password"><Key className="mr-1.5 h-3.5 w-3.5" /> Password Check</TabsTrigger>
          <TabsTrigger value="threats"><AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Threat Detection</TabsTrigger>
        </TabsList>

        {/* ── AI Chat Tab ── */}
        <TabsContent value="chat">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Chat window */}
            <Card className="glass-card lg:col-span-2 flex flex-col h-[600px] border-cyber-500/20">
              <CardHeader className="border-b border-border py-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-cyber-500/20 border border-cyber-500/30 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-cyber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">StegShield X AI</CardTitle>
                    <p className="text-[10px] text-muted-foreground">Powered by advanced AI</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Badge variant="cyber" className="text-[10px]">
                      {loading ? "Thinking..." : "● Online"}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearChat} title="Clear chat">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                {chat.map((msg) => (
                  <div key={msg.id} className={`group flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "assistant" && (
                      <div className="h-8 w-8 rounded-lg bg-cyber-500/20 border border-cyber-500/30 flex items-center justify-center shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-cyber-400" />
                      </div>
                    )}
                    <div className="relative max-w-[85%]">
                      <div className={`p-3 rounded-2xl ${
                        msg.role === "assistant"
                          ? "bg-muted/50 border border-border/50"
                          : "bg-cyber-500/15 border border-cyber-500/20"
                      }`}>
                        {msg.role === "assistant"
                          ? <Markdown content={msg.text} />
                          : <p className="text-sm">{msg.text}</p>}
                        {msg.role === "assistant" && msg.id === chat[chat.length - 1]?.id && loading && (
                          <span className="inline-block w-2 h-4 bg-cyber-400 animate-pulse ml-0.5 rounded-sm" />
                        )}
                      </div>
                      <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                        <button
                          className="p-1 rounded bg-background/80 border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => copyMessage(msg.id, msg.text)}
                          title="Copy message"
                        >
                          {copiedMsg === msg.id ? <Check className="h-2.5 w-2.5 text-green-400" /> : <Copy className="h-2.5 w-2.5" />}
                        </button>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5 px-1" suppressHydrationWarning>
                        {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString() : new Date(msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="h-8 w-8 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center shrink-0 mt-1">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </CardContent>

              {/* Input */}
              <div className="p-4 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask about security, threats, encryption..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !loading) { e.preventDefault(); sendMessage() } }}
                    disabled={loading}
                    className="bg-muted/30 h-11"
                  />
                  {loading ? (
                    <Button variant="cyber" size="icon" className="h-11 w-11" onClick={stopGeneration} title="Stop generation">
                      <StopCircle className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button variant="cyber" size="icon" className="h-11 w-11" onClick={() => sendMessage()} disabled={!message.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>

            {/* Suggestions sidebar */}
            <div className="space-y-4">
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4 text-cyber-400" /> Suggested Questions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {SUGGESTED_PROMPTS.map(({ icon: Icon, label, query }) => (
                    <Button
                      key={label}
                      variant="outline"
                      className="w-full justify-start text-xs h-auto py-2.5 px-3 hover:border-cyber-500/50"
                      size="sm"
                      disabled={loading}
                      onClick={() => { setActiveTab("chat"); sendMessage(query) }}
                    >
                      <Icon className="mr-2 h-3.5 w-3.5 shrink-0 text-cyber-400" />
                      <span className="truncate">{label}</span>
                    </Button>
                  ))}
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyber-400" /> Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start text-xs h-auto py-2.5 px-3" size="sm"
                    onClick={() => setActiveTab("analyze")}>
                    <Upload className="mr-2 h-3.5 w-3.5 text-cyber-400" /> Analyze File
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-xs h-auto py-2.5 px-3" size="sm"
                    onClick={() => setActiveTab("password")}>
                    <Lock className="mr-2 h-3.5 w-3.5 text-cyber-400" /> Check Password
                  </Button>
                  <Button variant="outline" className="w-full justify-start text-xs h-auto py-2.5 px-3" size="sm"
                    onClick={() => setActiveTab("threats")}>
                    <AlertTriangle className="mr-2 h-3.5 w-3.5 text-cyber-400" /> Threat Scan
                  </Button>
                  <Button variant="cyber" className="w-full justify-start text-xs h-auto py-2.5 px-3" size="sm"
                    onClick={runSecurityScan} disabled={runningScan}>
                    {runningScan ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Shield className="mr-2 h-3.5 w-3.5" />}
                    Security Scan
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── File Analysis Tab ── */}
        <TabsContent value="analyze">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {/* Analysis type selector */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Analysis Type</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2">
                  {ANALYSIS_TYPES.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        analysisType === value
                          ? "border-cyber-500/60 bg-cyber-500/10"
                          : "border-border/40 hover:border-cyber-500/30 bg-muted/10"
                      }`}
                      onClick={() => setAnalysisType(value)}
                    >
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${analysisType === value ? "bg-cyber-400" : "bg-muted-foreground"}`} />
                      <div>
                        <p className="text-xs font-bold">{label}</p>
                        <p className="text-[10px] text-muted-foreground">{desc}</p>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Drop zone */}
              <Card className="glass-card">
                <CardContent className="pt-6">
                  <div
                    className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                      analysisDragOver ? "border-cyber-500 bg-cyber-500/10" : "border-border/60 hover:border-cyber-500/50"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setAnalysisDragOver(true) }}
                    onDragLeave={() => setAnalysisDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setAnalysisDragOver(false)
                      const f = e.dataTransfer.files[0]
                      if (f) handleFileAnalysis(f, analysisType)
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileAnalysis(f, analysisType) }} />
                    {scanning ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-10 w-10 text-cyber-400 animate-spin" />
                        <p className="text-sm font-medium text-cyber-400">Running {analysisType} analysis...</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium">Drop file or click to browse</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Selected: <span className="text-cyber-400 font-medium">{ANALYSIS_TYPES.find(t => t.value === analysisType)?.label}</span>
                        </p>
                        {analysisFile && <p className="text-[10px] text-muted-foreground mt-2 font-mono">{analysisFile.name}</p>}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyber-400" /> Analysis Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {scanning ? (
                  <div className="py-16 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-cyber-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-cyber-400">Analyzing file...</p>
                    <p className="text-xs text-muted-foreground mt-1">Running {ANALYSIS_TYPES.find(t => t.value === analysisType)?.label}</p>
                  </div>
                ) : analysis ? (
                  <AnalysisCard analysis={analysis} type="file" />
                ) : (
                  <div className="py-16 text-center text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-3 opacity-30 text-cyber-400" />
                    <p className="text-sm font-medium text-foreground mb-1">No analysis yet</p>
                    <p className="text-xs">Select analysis type and upload a file</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Password Check Tab ── */}
        <TabsContent value="password">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm">Password Strength Checker</CardTitle>
                <CardDescription className="text-xs">AI-powered analysis of password strength and vulnerabilities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password to analyze..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") checkPassword() }}
                    className="pr-10 h-11 font-mono"
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Live preview bar */}
                {password && (
                  <div className="space-y-1">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          password.length >= 16 ? "bg-green-500" :
                          password.length >= 12 ? "bg-yellow-500" :
                          password.length >= 8 ? "bg-orange-500" : "bg-red-500"
                        }`}
                        style={{ width: `${Math.min((password.length / 20) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{password.length} chars</span>
                      <span>{password.length < 8 ? "Too short" : password.length < 12 ? "Acceptable" : password.length < 16 ? "Good" : "Excellent length"}</span>
                    </div>
                  </div>
                )}

                {/* Char class indicators */}
                {password && (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "a-z", ok: /[a-z]/.test(password) },
                      { label: "A-Z", ok: /[A-Z]/.test(password) },
                      { label: "0-9", ok: /[0-9]/.test(password) },
                      { label: "!@#", ok: /[^a-zA-Z0-9]/.test(password) },
                    ].map(({ label, ok }) => (
                      <div key={label} className={`p-2 rounded-lg text-center text-xs font-mono border ${ok ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-muted/20 border-border/40 text-muted-foreground"}`}>
                        {label}
                      </div>
                    ))}
                  </div>
                )}

                <Button variant="cyber" onClick={checkPassword} disabled={checkingPassword || !password} className="w-full h-11">
                  {checkingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</> : <><Zap className="mr-2 h-4 w-4" /> Check Password Strength</>}
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm">Strength Analysis Result</CardTitle>
              </CardHeader>
              <CardContent>
                {checkingPassword ? (
                  <div className="py-16 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-cyber-400 mx-auto mb-3" />
                    <p className="text-sm text-cyber-400">Analyzing password...</p>
                  </div>
                ) : passwordResult ? (
                  passwordResult.error ? (
                    <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                      {passwordResult.error}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex items-center justify-center gap-6">
                        <ScoreRing value={strengthScore} label="Score" color={strengthScore >= 80 ? "text-green-400" : strengthScore >= 60 ? "text-yellow-400" : "text-red-400"} />
                        <div className="text-center">
                          <Badge variant={strengthScore >= 60 ? "success" : "destructive"} className="text-sm px-4 py-1 mb-2">
                            {strengthLabel}
                          </Badge>
                          {passwordResult.crack_time_display && (
                            <p className="text-xs text-muted-foreground">
                              Crack time: <span className="font-mono text-foreground">{passwordResult.crack_time_display}</span>
                            </p>
                          )}
                          {passwordResult.entropy_bits && (
                            <p className="text-xs text-muted-foreground">
                              Entropy: <span className="font-mono text-foreground">{passwordResult.entropy_bits} bits</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <Progress value={strengthScore} className="h-2" />

                      {passwordResult.feedback && (
                        <div className="p-3 rounded-xl border border-border/40 bg-muted/20 text-xs text-muted-foreground">
                          {passwordResult.feedback}
                        </div>
                      )}

                      {passwordResult.checks && (
                        <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Security Checks</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {Object.entries(passwordResult.checks).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 text-xs">
                                {value
                                  ? <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                                  : <X className="h-3 w-3 text-red-400 shrink-0" />}
                                <span className="capitalize text-muted-foreground">{key.replace(/_/g, " ")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="py-16 text-center text-muted-foreground">
                    <Key className="h-12 w-12 mx-auto mb-3 opacity-30 text-cyber-400" />
                    <p className="text-sm font-medium text-foreground mb-1">No analysis yet</p>
                    <p className="text-xs">Enter a password and click Check Strength</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Threat Detection Tab ── */}
        <TabsContent value="threats">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm">Upload File for Threat Scan</CardTitle>
                <CardDescription className="text-xs">Scans for malware signatures, executable headers, and entropy anomalies</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    threatDragOver ? "border-red-500/60 bg-red-500/10" : "border-border/60 hover:border-red-500/30"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setThreatDragOver(true) }}
                  onDragLeave={() => setThreatDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setThreatDragOver(false)
                    const f = e.dataTransfer.files[0]
                    if (f) handleThreatAnalysis(f)
                  }}
                  onClick={() => threatFileInputRef.current?.click()}
                >
                  <input ref={threatFileInputRef} type="file" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleThreatAnalysis(f) }} />
                  {threatScanning ? (
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-10 w-10 text-red-400 animate-spin" />
                      <p className="text-sm font-medium text-red-400">Deep threat scanning...</p>
                    </div>
                  ) : (
                    <>
                      <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm font-medium">Drop file for threat analysis</p>
                      <p className="text-xs text-muted-foreground mt-1">Images, documents, archives, binaries</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4 text-cyber-400" /> Threat Scan Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                {threatScanning ? (
                  <div className="py-16 text-center">
                    <Loader2 className="h-10 w-10 animate-spin text-red-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-red-400">Deep scanning...</p>
                  </div>
                ) : threatAnalysis ? (
                  <AnalysisCard analysis={threatAnalysis} type="threat" />
                ) : (
                  <div className="py-16 text-center text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-30 text-cyber-400" />
                    <p className="text-sm font-medium text-foreground mb-1">No scan yet</p>
                    <p className="text-xs">Upload a file to scan for threats</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
