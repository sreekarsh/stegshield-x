"use client"

import { useEffect, useState } from "react"
import { Shield, Lock, Download, Clock, File, Loader2, AlertTriangle, CheckCircle2, Eye, EyeOff, FileText, Image as ImageIcon, Film, Music, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useParams } from "next/navigation"
import toast from "react-hot-toast"

const getApiBase = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL
  if (typeof window !== "undefined") {
    const host = window.location.hostname
    if (host !== "localhost" && host !== "127.0.0.1") {
      return `${window.location.origin}/api`
    }
    const port = process.env.NEXT_PUBLIC_BACKEND_PORT || "4000"
    return `http://localhost:${port}/api`
  }
  return "http://localhost:4000/api"
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getFileIcon(name: string) {
  const ext = (name || "").split(".").pop()?.toLowerCase() || ""
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext)) return ImageIcon
  if (["mp4", "webm", "mkv", "avi", "mov"].includes(ext)) return Film
  if (["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return Music
  if (["pdf", "doc", "docx", "txt", "csv", "json"].includes(ext)) return FileText
  return File
}

export default function SharedFilePage() {
  const { code } = useParams<{ code: string }>()
  const [meta, setMeta] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  useEffect(() => {
    if (!code) return
    setLoading(true)
    setError(null)
    const apiBase = getApiBase()
    fetch(`${apiBase}/sharing/access/${code}`)
      .then(r => {
        if (!r.ok) {
          if (r.status === 403) throw new Error("This link has expired or reached maximum downloads")
          throw new Error("Link not found or file removed")
        }
        return r.json()
      })
      .then(data => setMeta(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [code])

  const handleDownload = async () => {
    if (meta?.requiresPassword && password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    
    setDownloading(true)
    setDownloadSuccess(false)
    try {
      const apiBase = getApiBase()
      const res = await fetch(`${apiBase}/sharing/access/${code}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password || undefined }),
      })

      if (res.status === 403) {
        const err = await res.json().catch(() => ({ message: "Invalid password or link expired" }))
        toast.error(err.message || "Invalid password")
        return
      }
      if (res.status === 429) {
        toast.error("Too many attempts. Please wait before trying again.")
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Download failed" }))
        toast.error(err.message || "Download failed")
        return
      }

      const contentLength = res.headers.get("Content-Length")
      const expectedSize = contentLength ? parseInt(contentLength, 10) : meta?.fileSize
      
      const blob = await res.blob()
      
      // Verify file size matches expected
      if (expectedSize && blob.size !== expectedSize) {
        toast.error("Download incomplete. Please try again.")
        return
      }
      
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename="?([^"]+)"?/)
      const fileName = match ? match[1] : meta?.fileName || "download"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      setDownloadSuccess(true)
      toast.success("Download started successfully!")
    } catch {
      toast.error("Download failed. Please check network connection.")
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyber-950/30 p-4">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="p-4 rounded-2xl bg-cyber-500/10 border border-cyber-500/20 w-fit mx-auto shadow-lg shadow-cyber-500/10">
            <Loader2 className="h-10 w-10 animate-spin text-cyber-400" />
          </div>
          <div>
            <p className="text-base font-semibold">Decrypting Link Details...</p>
            <p className="text-xs text-muted-foreground mt-1">Connecting to StegShield Zero-Trust Access Gateway</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyber-950/30 p-4">
        <Card className="glass-card max-w-md w-full border-destructive/30 shadow-2xl">
          <CardContent className="flex flex-col items-center py-12 px-6 text-center space-y-4">
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertTriangle className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">File Unavailable</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{error}</p>
            </div>
            <div className="pt-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-cyber-400" /> Powered by StegShield X Secure Sharing
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const FileIconComponent = getFileIcon(meta?.fileName || "")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyber-950/30 p-4">
      <Card className="glass-card max-w-md w-full shadow-2xl border-cyber-500/20">
        <CardContent className="p-6 space-y-6">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-cyber-500/10 border border-cyber-500/30 text-cyber-400 mb-1 shadow-lg shadow-cyber-500/10">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Secure File Share</h1>
            <p className="text-xs text-muted-foreground">A zero-trust encrypted link has been delivered to you</p>
          </div>

          {/* File Card info */}
          <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-3.5">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-xl bg-cyber-500/10 border border-cyber-500/30 flex items-center justify-center shrink-0">
                <FileIconComponent className="h-6 w-6 text-cyber-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{meta?.fileName || "Protected File"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{meta?.fileSize ? formatBytes(meta.fileSize) : "Unknown size"}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40 text-xs">
              {meta?.expiresAt && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 text-cyber-400" />
                  <span className="truncate">Expires {new Date(meta.expiresAt).toLocaleDateString()}</span>
                </div>
              )}
              {meta?.maxDownloads != null && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Download className="h-3.5 w-3.5 text-cyber-400" />
                  <span>{Math.max(0, meta.maxDownloads - (meta.downloads || 0))} downloads left</span>
                </div>
              )}
            </div>

            {meta?.requiresPassword && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                <Lock className="h-4 w-4 shrink-0 text-amber-400" />
                <span>Password protected — enter passphrase to download</span>
              </div>
            )}
          </div>

          {/* Password Input */}
          {meta?.requiresPassword && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3 text-cyber-400" /> Access Password (minimum 8 characters)
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter the file password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && password.length >= 8 && handleDownload()}
                  className="pr-10 font-mono text-sm h-11"
                  minLength={8}
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
              {password.length > 0 && password.length < 8 && (
                <p className="text-[10px] text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Password must be at least 8 characters
                </p>
              )}
            </div>
          )}

          {/* Download Action Button */}
          <Button
            variant="cyber"
            className="w-full h-11 text-base font-semibold"
            onClick={handleDownload}
            disabled={downloading || (meta?.requiresPassword && password.length < 8)}
          >
            {downloading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing File Download...</>
            ) : downloadSuccess ? (
              <><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-300" /> Download Started Again</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Download File</>
            )}
          </Button>

          {/* Footer Security Seal */}
          <div className="pt-2 text-center border-t border-border/30">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Shield className="h-3 w-3 text-cyber-400" /> End-to-End Encrypted & Access Audited by StegShield X
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
