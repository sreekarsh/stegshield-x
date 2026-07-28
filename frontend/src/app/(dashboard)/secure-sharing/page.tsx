"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import {
  Share2, Link, Shield, Clock, Globe, Lock, QrCode, Copy, Check, Loader2,
  Trash2, Upload, ExternalLink, File, RotateCcw, Download, Eye, EyeOff,
  Zap, CheckCircle2, AlertCircle, X, Image as ImageIcon, Film, Music, FileText,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { Progress } from "@/components/ui/progress"
import { api } from "@/lib/api"
import toast from "react-hot-toast"
import { ShareResultDialog } from "@/components/sharing/share-result-dialog"

const LAN_IP = process.env.NEXT_PUBLIC_LAN_IP || ""
const cleanLinkUrl = (url: string): string => {
  if (!url) return url
  if (typeof window !== "undefined" && url.includes("ngrok")) {
    return url.replace(/https?:\/\/[^/]*ngrok[^/]*\//i, `${window.location.origin}/`)
  }
  return url
}
const toLanUrl = (url: string): string => {
  const clean = cleanLinkUrl(url)
  if (!LAN_IP) return clean
  try {
    const u = new URL(clean)
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") u.hostname = LAN_IP
    return u.toString()
  } catch { return clean }
}

interface SharedLink {
  id: string
  url: string
  hasPassword: boolean
  fileName?: string
  fileSize?: number
  downloads: number
  maxDownloads: number | null
  expiresAt: string | null
  isGeoRestricted: boolean
  isIPRestricted: boolean
  createdAt: string
}

function parseExpiry(s: string): number {
  const map: Record<string, number> = { h: 3600000, d: 86400000, m: 60000 }
  const match = s.match(/^(\d+)([hdm])$/)
  if (!match) return 86400000
  return parseInt(match[1]) * (map[match[2]] || 86400000)
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatExpiry(d: string | null): string | null {
  if (!d) return null
  const date = new Date(d)
  const diff = date.getTime() - Date.now()
  if (diff < 0) return "Expired"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m left`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h left`
  return `${date.toLocaleDateString()}`
}

function getFileIcon(name: string) {
  const ext = (name || "").split(".").pop()?.toLowerCase() || ""
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return ImageIcon
  if (["mp4", "webm", "mkv", "avi", "mov"].includes(ext)) return Film
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return Music
  if (["pdf", "doc", "docx", "txt", "csv", "json"].includes(ext)) return FileText
  return File
}

// Production environment defaults
const DEFAULT_IP_RESTRICTED = process.env.NEXT_PUBLIC_SHARING_DEFAULT_IP_RESTRICTED === "true"
const DEFAULT_MAX_DOWNLOADS = process.env.NEXT_PUBLIC_SHARING_DEFAULT_MAX_DOWNLOADS || "unlimited"
const DEFAULT_EXPIRY = process.env.NEXT_PUBLIC_SHARING_DEFAULT_EXPIRY || "24h"
const DEFAULT_REQUIRE_PASSWORD = process.env.NEXT_PUBLIC_SHARING_REQUIRE_PASSWORD !== "false"

export default function SecureSharingPage() {
  const [links, setLinks] = useState<SharedLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Link settings with production defaults from environment
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [expiresIn, setExpiresIn] = useState(DEFAULT_EXPIRY)
  const [maxDownloads, setMaxDownloads] = useState(DEFAULT_MAX_DOWNLOADS)
  const [geoRestrict, setGeoRestrict] = useState(false)
  const [ipRestrict, setIpRestrict] = useState(DEFAULT_IP_RESTRICTED)
  const [allowedIPs, setAllowedIPs] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // QR
  const [qrUrl, setQrUrl] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrGenerating, setQrGenerating] = useState(false)
  const [qrHighCorrection, setQrHighCorrection] = useState(false)
  const [qrIncludeLogo, setQrIncludeLogo] = useState(false)
  const [qrLogoFile, setQrLogoFile] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState("create")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Share result dialog
  const [showShareResult, setShowShareResult] = useState(false)
  const [shareResult, setShareResult] = useState<{
    url: string
    fileName?: string
    fileSize?: number
    hasPassword: boolean
    maxDownloads?: number | null
    expiresAt?: string | null
  } | null>(null)

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<SharedLink[]>("/sharing/links")
      setLinks(data)
    } catch { /* offline */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchLinks() }, [fetchLinks])

  const handleFileSet = useCallback((f: File) => {
    if (f.size > 500 * 1024 * 1024) { toast.error("File exceeds 500MB limit"); return }
    setSelectedFile(f)
  }, [])

  const clearFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const createLink = async () => {
    if (!selectedFile) { toast.error("Select a file first"); return }
    setCreating(true)
    try {
      const expiresAt = expiresIn === "never" ? null : new Date(Date.now() + parseExpiry(expiresIn)).toISOString()
      const formData = new FormData()
      formData.append("file", selectedFile)
      if (password) formData.append("password", password)
      if (expiresAt) formData.append("expiresAt", expiresAt)
      formData.append("maxDownloads", maxDownloads === "unlimited" ? "" : String(maxDownloads))
      formData.append("isGeoRestricted", String(geoRestrict))
      formData.append("isIPRestricted", String(ipRestrict))
      formData.append("allowedIPs", JSON.stringify(allowedIPs ? allowedIPs.split(",").map(s => s.trim()).filter(Boolean) : []))
      
      const result = await api.upload("/sharing/links", formData) as any
      
      // Show result dialog with link and QR
      setShareResult({
        url: result?.url || "",
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        hasPassword: !!password,
        maxDownloads: maxDownloads === "unlimited" ? null : parseInt(maxDownloads),
        expiresAt: expiresAt,
      })
      setShowShareResult(true)
      
      toast.success("🔗 Secure link created!")
      clearFile()
      setPassword("")
      setAllowedIPs("")
      setMaxDownloads("unlimited")
      fetchLinks()
    } catch (e: any) {
      toast.error(e?.message || "Failed to create link")
    } finally {
      setCreating(false)
    }
  }

  const copyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
      toast.success("Link copied!")
    } catch { toast.error("Failed to copy") }
  }

  const deleteLink = async (id: string) => {
    setDeleting(id)
    try {
      await api.delete(`/sharing/links/${id}`)
      setLinks(prev => prev.filter(l => l.id !== id))
      toast.success("Link deleted")
    } catch { toast.error("Failed to delete link") }
    finally { setDeleting(null) }
  }

  const generateQrFromUrl = async (url: string) => {
    if (!url) return
    try {
      const QRCode = await import("qrcode")
      const correctionLevel = qrIncludeLogo || qrHighCorrection ? "H" : "M"
      const opts: any = {
        width: 400, margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
        errorCorrectionLevel: correctionLevel,
      }
      if (qrIncludeLogo && qrLogoFile) {
        const canvas = document.createElement("canvas")
        canvas.width = 400; canvas.height = 400
        await QRCode.toCanvas(canvas, url, opts)
        const ctx = canvas.getContext("2d")
        if (ctx) {
          const img = new Image()
          img.src = qrLogoFile
          await Promise.race([
            new Promise(resolve => { img.onload = resolve }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Logo load timeout")), 5000)),
          ])
          const logoSize = 80
          const x = (canvas.width - logoSize) / 2
          const y = (canvas.height - logoSize) / 2
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(x - 6, y - 6, logoSize + 12, logoSize + 12)
          ctx.drawImage(img, x, y, logoSize, logoSize)
        }
        setQrDataUrl(canvas.toDataURL("image/png"))
      } else {
        const dataUrl = await (QRCode as any).toDataURL(url, opts)
        setQrDataUrl(dataUrl as string)
      }
    } catch {
      toast.error("QR generation failed")
    }
  }

  const generateQr = async () => {
    if (!qrUrl) { toast.error("Enter a URL first"); return }
    setQrGenerating(true)
    setQrDataUrl(null)
    try { await generateQrFromUrl(qrUrl) }
    catch { toast.error("Failed to generate QR code") }
    finally { setQrGenerating(false) }
  }

  const downloadQr = (format: "png" | "svg") => {
    if (!qrDataUrl) return
    if (format === "svg") {
      // Generate a proper SVG wrapper around the data URL
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><image href="${qrDataUrl}" width="400" height="400"/></svg>`
      const blob = new Blob([svgContent], { type: "image/svg+xml" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `qrcode-${Date.now()}.svg`
      a.click()
      URL.revokeObjectURL(a.href)
    } else {
      const a = document.createElement("a")
      a.href = qrDataUrl
      a.download = `qrcode-${Date.now()}.png`
      a.click()
    }
  }

  const remaining = (link: SharedLink) => formatExpiry(link.expiresAt) || "Never"
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current += 1
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    dragCounter.current = 0
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0]
      handleFileSet(f)
      e.dataTransfer.clearData()
    }
  }, [handleFileSet])

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Secure File Sharing"
        description="Generate password-protected, time-limited, restricted-access secure links"
        action={{ label: "Reset", icon: RotateCcw, onClick: () => { clearFile(); setPassword(""); setAllowedIPs(""); setMaxDownloads("unlimited"); setGeoRestrict(false); setIpRestrict(false) } }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="create"><Link className="mr-2 h-4 w-4" />Create Link</TabsTrigger>
          <TabsTrigger value="links"><Shield className="mr-2 h-4 w-4" />My Links ({links.length})</TabsTrigger>
          <TabsTrigger value="qr"><QrCode className="mr-2 h-4 w-4" />QR Sharing</TabsTrigger>
        </TabsList>

        {/* ── CREATE LINK TAB ── */}
        <TabsContent value="create">
          <div className="grid gap-6 lg:grid-cols-2">

            {/* File Upload */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-cyber-400" /> File to Share
                </CardTitle>
                <CardDescription>Drop or select the file to share securely</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    dragOver ? "border-cyber-500 bg-cyber-500/10 shadow-lg shadow-cyber-500/10 scale-[1.01]" : "border-border hover:border-cyber-500/50 bg-background/20"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSet(f) }}
                  />
                  <div className="flex flex-col items-center gap-2 pointer-events-none">
                    <div className={`p-4 rounded-2xl transition-all ${dragOver ? "bg-cyber-500/20" : "bg-muted/50"}`}>
                      <Upload className={`h-8 w-8 transition-colors ${dragOver ? "text-cyber-400" : "text-muted-foreground"}`} />
                    </div>
                    <p className="text-sm font-semibold">{selectedFile ? "File Selected — Click or drop to change" : "Drop file or click to browse"}</p>
                    <p className="text-xs text-muted-foreground">Any file type (PDF, Images, Audio, Video, ZIP, Code) · Up to 500MB</p>
                  </div>
                </div>

                {selectedFile && (
                  <div className="p-4 rounded-xl border border-cyber-500/30 bg-cyber-500/5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-cyber-500/10 border border-cyber-500/30 flex items-center justify-center shrink-0">
                        {(() => {
                          const IconComp = getFileIcon(selectedFile.name)
                          return <IconComp className="h-6 w-6 text-cyber-400" />
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="success" className="shrink-0">Ready</Badge>
                        <button onClick={clearFile} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* Progress bar showing file size vs 500MB limit */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Size usage</span>
                        <span>{((selectedFile.size / (500 * 1024 * 1024)) * 100).toFixed(1)}% of 500MB</span>
                      </div>
                      <Progress value={(selectedFile.size / (500 * 1024 * 1024)) * 100} className="h-1.5" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Link Settings */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-cyber-400" /> Link Settings
                </CardTitle>
                <CardDescription>Configure access controls and restrictions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5 text-cyber-400" /> Password Protection
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Set access password (optional)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 font-mono"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(v => !v)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="flex items-center gap-1.5 text-xs text-success">
                      <Lock className="h-3 w-3" /> Password protection enabled
                    </div>
                  )}
                </div>

                {/* Expiry + Max Downloads */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Expires in
                    </label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={expiresIn}
                      onChange={(e) => setExpiresIn(e.target.value)}
                    >
                      <option value="1h">1 hour</option>
                      <option value="24h">24 hours</option>
                      <option value="7d">7 days</option>
                      <option value="30d">30 days</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Max Downloads</label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={maxDownloads}
                      onChange={(e) => setMaxDownloads(e.target.value)}
                    >
                      <option value="1">1 download</option>
                      <option value="5">5 downloads</option>
                      <option value="10">10 downloads</option>
                      <option value="unlimited">Unlimited</option>
                    </select>
                  </div>
                </div>

                {/* Restrictions */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Restrictions</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center gap-2 text-sm p-3 rounded-xl cursor-pointer transition-all ${geoRestrict ? "bg-cyber-500/10 border border-cyber-500/30 text-cyber-300" : "bg-muted/30 border border-border"}`}>
                      <input type="checkbox" checked={geoRestrict} onChange={(e) => setGeoRestrict(e.target.checked)} className="accent-cyber-500" />
                      <Globe className="h-4 w-4" />
                      <span>Geo-restrict</span>
                    </label>
                    <label className={`flex items-center gap-2 text-sm p-3 rounded-xl cursor-pointer transition-all ${ipRestrict ? "bg-cyber-500/10 border border-cyber-500/30 text-cyber-300" : "bg-muted/30 border border-border"}`}>
                      <input type="checkbox" checked={ipRestrict} onChange={(e) => setIpRestrict(e.target.checked)} className="accent-cyber-500" />
                      <Shield className="h-4 w-4" />
                      <span>IP-restrict</span>
                    </label>
                  </div>
                  {ipRestrict && (
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Allowed IPs (comma-separated)</label>
                      <Input
                        placeholder="192.168.1.1, 10.0.0.0/24"
                        value={allowedIPs}
                        onChange={(e) => setAllowedIPs(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                <Button variant="cyber" className="w-full h-11 text-base font-semibold" onClick={createLink} disabled={creating || !selectedFile}>
                  {creating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Link...</>
                  ) : (
                    <><Zap className="mr-2 h-4 w-4" /> Generate Secure Link</>
                  )}
                </Button>

                {/* Security summary */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: "Password", active: !!password, icon: Lock },
                    { label: "Time Limit", active: expiresIn !== "never", icon: Clock },
                    { label: "DL Limit", active: maxDownloads !== "unlimited", icon: Shield },
                  ].map(({ label, active, icon: Icon }) => (
                    <div key={label} className={`flex flex-col items-center p-2 rounded-lg text-center transition-all ${active ? "bg-success/10 border border-success/20" : "bg-muted/20 border border-border/30"}`}>
                      <Icon className={`h-4 w-4 mb-1 ${active ? "text-success" : "text-muted-foreground"}`} />
                      <span className={`text-[10px] font-semibold ${active ? "text-success" : "text-muted-foreground"}`}>{label}</span>
                    </div>
                  ))}
                </div>

              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── MY LINKS TAB ── */}
        <TabsContent value="links">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Shared Links ({links.length})</CardTitle>
                  <CardDescription>All your active secure file links</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchLinks} disabled={loading}>
                  <Loader2 className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-cyber-400" />
                </div>
              ) : links.length === 0 ? (
                <div className="p-16 text-center text-muted-foreground">
                  <div className="p-4 rounded-2xl bg-muted/30 w-fit mx-auto mb-4">
                    <Link className="h-10 w-10 opacity-40" />
                  </div>
                  <p className="text-sm font-medium">No shared links yet</p>
                  <p className="text-xs mt-1">Create your first secure link to get started</p>
                  <Button variant="cyber" size="sm" className="mt-4" onClick={() => setActiveTab("create")}>
                    <Zap className="mr-2 h-3.5 w-3.5" /> Create Link
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map((link) => {
                    const expiresLabel = remaining(link)
                    const isExpired = expiresLabel === "Expired"
                    return (
                      <div key={link.id} className={`flex items-start gap-4 p-4 rounded-xl border transition-all hover:border-border/60 group ${isExpired ? "opacity-50 bg-muted/10 border-border/20" : "bg-muted/20 border-border/40 hover:bg-muted/30"}`}>
                        <div className={`p-2.5 rounded-xl shrink-0 ${isExpired ? "bg-muted/30" : "bg-cyber-500/10"}`}>
                          <Link className={`h-5 w-5 ${isExpired ? "text-muted-foreground" : "text-cyber-400"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-mono text-cyber-400 truncate">{cleanLinkUrl(link.url)}</p>
                            {LAN_IP && (
                              <span className="text-xs text-muted-foreground shrink-0">/ <span className="text-success/70 font-mono">{toLanUrl(link.url)}</span></span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mb-2">{link.fileName || "Unknown file"}{link.fileSize ? ` · ${formatSize(link.fileSize)}` : ""}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {isExpired
                              ? <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                              : <Badge variant="success" className="text-[10px]"><CheckCircle2 className="h-3 w-3 mr-0.5" />Active</Badge>
                            }
                            {link.hasPassword && <Badge variant="outline" className="text-[10px]"><Lock className="h-3 w-3 mr-0.5" />Protected</Badge>}
                            {link.expiresAt && !isExpired && (
                              <Badge variant="outline" className="text-[10px]"><Clock className="h-3 w-3 mr-0.5" />{expiresLabel}</Badge>
                            )}
                            {link.maxDownloads != null && (
                              <Badge variant="outline" className="text-[10px]">{link.downloads}/{link.maxDownloads} DL</Badge>
                            )}
                            {link.isGeoRestricted && <Badge variant="outline" className="text-[10px]"><Globe className="h-3 w-3 mr-0.5" />Geo</Badge>}
                            {link.isIPRestricted && <Badge variant="outline" className="text-[10px]"><Shield className="h-3 w-3 mr-0.5" />IP</Badge>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(cleanLinkUrl(link.url), link.id)} title="Copy URL">
                            {copiedId === link.id ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          {LAN_IP && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-success/70 hover:text-success" onClick={() => copyLink(toLanUrl(link.url), "lan-" + link.id)} title="Copy LAN URL">
                              {copiedId === "lan-" + link.id ? <Check className="h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteLink(link.id)} disabled={deleting === link.id}>
                            {deleting === link.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── QR SHARING TAB ── */}
        <TabsContent value="qr">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-cyber-400" /> Generate QR Code
                </CardTitle>
                <CardDescription>Encode any link into a scannable QR code</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {LAN_IP && (
                  <div className="p-3 rounded-xl bg-success/10 border border-success/20">
                    <p className="text-xs font-semibold text-success mb-0.5">📡 LAN URL detected</p>
                    <p className="text-xs text-muted-foreground">QR codes will use your LAN URL — scannable from any device on your network</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">URL for QR Code</label>
                  <Input
                    placeholder="Paste your secure share link..."
                    value={qrUrl}
                    onChange={(e) => { setQrUrl(e.target.value); setQrDataUrl(null) }}
                    onKeyDown={(e) => e.key === "Enter" && generateQr()}
                  />
                </div>

                {links.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Recent Links</label>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {links.slice(0, 5).map(l => {
                        const displayUrl = LAN_IP ? toLanUrl(l.url) : l.url
                        return (
                          <button
                            key={l.id}
                            className="w-full text-left text-xs font-mono text-cyber-400 truncate p-2 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border/40"
                            onClick={() => { setQrUrl(displayUrl); setQrDataUrl(null) }}
                          >
                            {displayUrl}
                            {LAN_IP && <span className="ml-2 text-[10px] text-success/60">(LAN)</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold">QR Options</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className={`flex items-center gap-2 text-sm p-2.5 rounded-xl cursor-pointer transition-all ${qrHighCorrection ? "bg-cyber-500/10 border border-cyber-500/30 text-cyber-300" : "bg-muted/30 border border-border"}`}>
                      <input type="checkbox" checked={qrHighCorrection} onChange={(e) => setQrHighCorrection(e.target.checked)} className="accent-cyber-500" />
                      <span className="text-xs">High error correction</span>
                    </label>
                    <label className={`flex items-center gap-2 text-sm p-2.5 rounded-xl cursor-pointer transition-all ${qrIncludeLogo ? "bg-cyber-500/10 border border-cyber-500/30 text-cyber-300" : "bg-muted/30 border border-border"}`}>
                      <input type="checkbox" checked={qrIncludeLogo} onChange={(e) => setQrIncludeLogo(e.target.checked)} className="accent-cyber-500" />
                      <span className="text-xs">Include logo</span>
                    </label>
                  </div>
                  {qrIncludeLogo && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 border border-border">
                      <Button variant="outline" size="sm" onClick={() => document.getElementById("qr-logo-input")?.click()}>
                        <Upload className="mr-1.5 h-3 w-3" />
                        {qrLogoFile ? "Change Logo" : "Upload Logo"}
                      </Button>
                      {qrLogoFile && (
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qrLogoFile} alt="logo" className="h-10 w-10 rounded-lg object-contain border border-border" />
                          <button className="text-xs text-muted-foreground hover:text-destructive transition-colors" onClick={() => { setQrLogoFile(null); setQrIncludeLogo(false) }}>Remove</button>
                        </div>
                      )}
                      <input
                        id="qr-logo-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) {
                            const reader = new FileReader()
                            reader.onload = () => { setQrLogoFile(reader.result as string); setQrDataUrl(null) }
                            reader.readAsDataURL(f)
                          }
                        }}
                      />
                    </div>
                  )}
                </div>

                <Button variant="cyber" className="w-full h-11" onClick={generateQr} disabled={qrGenerating || !qrUrl}>
                  {qrGenerating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                  ) : (
                    <><QrCode className="mr-2 h-4 w-4" /> Generate QR Code</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* QR Preview */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-cyber-400" /> Preview
                </CardTitle>
                <CardDescription>Live QR code preview — scan to test</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[340px] gap-4">
                {qrDataUrl ? (
                  <>
                    <div className="relative w-52 h-52 rounded-2xl overflow-hidden border-2 border-cyber-500/30 shadow-lg shadow-cyber-500/10 bg-white p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold">QR Code Ready</p>
                      <p className="text-xs text-muted-foreground text-center mt-0.5 break-all max-w-[280px]">{qrUrl}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => downloadQr("png")}>
                        <Download className="mr-2 h-3.5 w-3.5" /> PNG
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => downloadQr("svg")}>
                        <Download className="mr-2 h-3.5 w-3.5" /> SVG
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(qrUrl); toast.success("URL copied") }}>
                        <Copy className="mr-2 h-3.5 w-3.5" /> Copy URL
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-52 h-52 bg-muted/30 rounded-2xl flex items-center justify-center border-2 border-dashed border-border/50">
                      <QrCode className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold">QR Code Preview</p>
                      <p className="text-xs text-muted-foreground mt-1">Enter a URL and click Generate</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Share Result Dialog */}
      {shareResult && (
        <ShareResultDialog
          open={showShareResult}
          onClose={() => setShowShareResult(false)}
          shareUrl={shareResult.url}
          fileName={shareResult.fileName}
          fileSize={shareResult.fileSize}
          hasPassword={shareResult.hasPassword}
          maxDownloads={shareResult.maxDownloads}
          expiresAt={shareResult.expiresAt}
        />
      )}
    </div>
  )
}
