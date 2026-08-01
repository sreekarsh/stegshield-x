"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Copy, Check, QrCode, Download, ExternalLink, Share2, 
  Lock, Clock, Shield, Mail, MessageSquare, X 
} from "lucide-react"
import toast from "react-hot-toast"

interface ShareResultDialogProps {
  open: boolean
  onClose: () => void
  shareUrl: string
  fileName?: string
  fileSize?: number
  hasPassword: boolean
  maxDownloads?: number | null
  expiresAt?: string | null
}

export function ShareResultDialog({
  open,
  onClose,
  shareUrl,
  fileName,
  fileSize,
  hasPassword,
  maxDownloads,
  expiresAt,
}: ShareResultDialogProps) {
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(true)
  const [qrError, setQrError] = useState(false)

  const getScannableUrl = (url: string) => {
    if (typeof window === "undefined" || !url) return url
    if (url.includes("ngrok")) {
      return url.replace(/https?:\/\/[^/]*ngrok[^/]*\//i, `${window.location.origin}/`)
    }
    if ((url.includes("localhost") || url.includes("127.0.0.1")) && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      const port = window.location.port ? `:${window.location.port}` : ""
      return url.replace(/https?:\/\/[^/]+/, `${window.location.protocol}//${window.location.hostname}${port}`)
    }
    return url
  }

  const cleanShareUrl = getScannableUrl(shareUrl)

  // Auto-generate QR code when dialog opens
  useEffect(() => {
    if (!open || !cleanShareUrl) return
    
    setQrLoading(true)
    setQrError(false)
    
    const generateQR = async () => {
      try {
        const qrModule = await import("qrcode")
        const QRCode = (qrModule as any).default || qrModule
        const dataUrl = await QRCode.toDataURL(cleanShareUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000", // Pure black for maximum phone camera scannability
            light: "#ffffff",
          },
          errorCorrectionLevel: "M",
        })
        setQrDataUrl(dataUrl)
        setQrError(false)
      } catch (error) {
        console.error("QR generation failed:", error)
        setQrError(true)
      } finally {
        setQrLoading(false)
      }
    }

    generateQR()
  }, [open, cleanShareUrl])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(cleanShareUrl)
      setCopied(true)
      toast.success("Link copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const downloadQR = () => {
    if (!qrDataUrl) return
    const a = document.createElement("a")
    a.href = qrDataUrl
    a.download = `qr-${fileName || "share"}-${Date.now()}.png`
    a.click()
    toast.success("QR code downloaded!")
  }

  const shareVia = (method: "email" | "whatsapp" | "telegram") => {
    const text = `🔐 Secure file shared: ${fileName || "File"}\n\nDownload here: ${cleanShareUrl}${hasPassword ? "\n⚠️ Password protected" : ""}`
    
    const urls = {
      email: `mailto:?subject=Secure File Share&body=${encodeURIComponent(text)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(cleanShareUrl)}&text=${encodeURIComponent(`Secure file: ${fileName || "File"}`)}`,
    }
    
    window.open(urls[method], "_blank")
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const formatExpiry = (date: string | null): string => {
    if (!date) return "Never"
    const d = new Date(date)
    const diff = d.getTime() - Date.now()
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    return d.toLocaleDateString()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-success/10 border border-success/20">
              <Check className="h-5 w-5 text-success" />
            </div>
            Secure Link Created Successfully!
          </DialogTitle>
          <DialogDescription>
            Share this link via any method. Recipients can access it directly or scan the QR code.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          
          {/* File Info */}
          {fileName && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border">
              <div>
                <p className="text-sm font-semibold">{fileName}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {fileSize && <span>{formatSize(fileSize)}</span>}
                  {hasPassword && (
                    <Badge variant="outline" className="h-5 gap-1">
                      <Lock className="h-3 w-3" /> Password
                    </Badge>
                  )}
                  {expiresAt && (
                    <Badge variant="outline" className="h-5 gap-1">
                      <Clock className="h-3 w-3" /> Expires {formatExpiry(expiresAt)}
                    </Badge>
                  )}
                  {maxDownloads && (
                    <Badge variant="outline" className="h-5 gap-1">
                      <Shield className="h-3 w-3" /> {maxDownloads} downloads max
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Link + QR Code */}
          <div className="grid md:grid-cols-2 gap-4">
            
            {/* Link Section */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Share Link
              </label>
              
              {/* Link Display */}
              <div className="p-4 rounded-xl bg-cyber-500/5 border border-cyber-500/20">
                <p className="text-sm font-mono break-all text-cyber-400 leading-relaxed">
                  {cleanShareUrl}
                </p>
              </div>

              {/* Copy Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={copyToClipboard}
              >
                {copied ? (
                  <><Check className="mr-2 h-4 w-4 text-success" /> Copied!</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" /> Copy Link</>
                )}
              </Button>

              {/* Quick Share Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => shareVia("email")}
                  className="text-xs"
                >
                  <Mail className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => shareVia("whatsapp")}
                  className="text-xs"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(shareUrl, "_blank")}
                  className="text-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="space-y-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                QR Code
              </label>
              
              <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-white border border-border">
                {qrLoading && (
                  <div className="w-[300px] h-[300px] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin h-8 w-8 border-4 border-cyber-500 border-t-transparent rounded-full" />
                      <p className="text-xs text-muted-foreground">Generating QR...</p>
                    </div>
                  </div>
                )}
                
                {qrError && (
                  <div className="w-[300px] h-[300px] flex items-center justify-center">
                    <div className="text-center space-y-2">
                      <X className="h-12 w-12 text-destructive mx-auto" />
                      <p className="text-sm text-destructive font-semibold">QR Generation Failed</p>
                      <p className="text-xs text-muted-foreground">You can still share the link above</p>
                    </div>
                  </div>
                )}
                
                {!qrLoading && !qrError && qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    className="w-[300px] h-[300px] rounded-lg"
                  />
                )}
              </div>

              {!qrError && qrDataUrl && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={downloadQR}
                >
                  <Download className="mr-2 h-4 w-4" /> Download QR Code
                </Button>
              )}
            </div>
          </div>

          {/* Security Notice */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-300 mb-1">Security Notice</p>
                <p className="text-amber-200/80 text-xs leading-relaxed">
                  {hasPassword 
                    ? "Share the password separately via a secure channel. Never send it with the link."
                    : "This link is not password protected. Anyone with the link can access the file."
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button variant="cyber" onClick={() => { copyToClipboard(); onClose(); }}>
              <Share2 className="mr-2 h-4 w-4" /> Copy & Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
