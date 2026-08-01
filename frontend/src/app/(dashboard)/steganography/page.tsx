"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Eye, EyeOff, Upload, Download, Shield, Image, FileAudio, Film, FileText, Key, Loader2, RotateCcw, RefreshCw, Activity, AlertTriangle, CheckCircle2, FileCheck, BarChart3, Info, ShieldAlert, Sparkles, Layers, HardDrive, X, Copy, Check, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import {
  steganographyEncodeFile,
  steganographyDecodeFile,
} from "@/lib/crypto"
import {
  detectFormat,
  parseWavDataChunk,
  parseWavHeader,
  computeEntropy,
  computeLsbRatio,
  computeLsbCapacity,
  computeChiSquare,
  computeLsbStreamStats,
  rgbOnlyFromRgba,
  detectAppendMarker,
  imageToPixels,
  canUseSpatialLsb,
  type CarrierFormat,
  type WavHeaderInfo,
} from "@/lib/stego-formats"
import toast from "react-hot-toast"

function FilePreviewCard({
  file,
  onRemove,
}: {
  file: File
  onRemove: () => void
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null)

  const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|bmp|gif|webp)$/i.test(file.name)
  const isAudio = file.type.startsWith("audio/") || /\.(wav|mp3|ogg|m4a)$/i.test(file.name)
  const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|avi|mkv)$/i.test(file.name)
  const isPdf   = /\.pdf$/i.test(file.name)

  const ext = file.name.split(".").pop()?.toUpperCase() || "FILE"
  const sizeStr = file.size >= 1024 * 1024
    ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
    : `${(file.size / 1024).toFixed(1)} KB`

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      const img = new window.Image()
      img.onload = () => setImgDimensions({ w: img.naturalWidth, h: img.naturalHeight })
      img.src = url
      return () => URL.revokeObjectURL(url)
    }
  }, [file, isImage])

  /* ── Image carrier: full-bleed hero preview ── */
  if (isImage && previewUrl) {
    return (
      <div className="mt-4 rounded-xl overflow-hidden border border-border/60 relative group">
        {/* blurred background fill */}
        <div
          className="absolute inset-0 scale-105 blur-xl opacity-40"
          style={{ backgroundImage: `url(${previewUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
        {/* main image */}
        <div className="relative flex items-center justify-center bg-black/50 min-h-[160px] max-h-[260px] overflow-hidden">
          <img
            src={previewUrl}
            alt={file.name}
            className="max-h-[260px] max-w-full object-contain relative z-10"
            style={{ display: "block" }}
          />
        </div>
        {/* info bar at bottom */}
        <div className="relative z-10 flex items-center gap-3 px-4 py-2.5 bg-black/70 backdrop-blur-sm border-t border-white/10">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{file.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyber-500/30 text-cyber-300 tracking-wider">{ext}</span>
              <span className="text-xs text-white/60">{sizeStr}</span>
              {imgDimensions && (
                <span className="text-xs text-white/60">{imgDimensions.w} × {imgDimensions.h} px</span>
              )}
            </div>
          </div>
          <Badge variant="success" className="shrink-0 text-[10px]">Loaded</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-white/60 hover:text-red-400 hover:bg-red-400/10"
            onClick={onRemove}
            title="Remove file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  /* ── Non-image carrier: compact card with icon ── */
  const iconColor = isAudio ? "text-cyan-400" : isVideo ? "text-purple-400" : isPdf ? "text-rose-400" : "text-muted-foreground"
  const iconBg    = isAudio ? "bg-cyan-500/10 border-cyan-500/20" : isVideo ? "bg-purple-500/10 border-purple-500/20" : isPdf ? "bg-rose-500/10 border-rose-500/20" : "bg-muted border-border"
  const IconEl    = isAudio ? FileAudio : isVideo ? Film : isPdf ? FileText : FileText

  return (
    <div className="mt-4 p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-4">
      <div className={`h-14 w-14 rounded-xl ${iconBg} border flex items-center justify-center shrink-0`}>
        <IconEl className={`h-7 w-7 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground tracking-wider">{ext}</span>
          <span className="text-xs text-muted-foreground">{sizeStr}</span>
        </div>
      </div>
      <Badge variant="success" className="shrink-0 text-[10px]">Loaded</Badge>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        onClick={onRemove}
        title="Remove file"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

const supportedFormats = [
  { icon: Image, name: "PNG", desc: "Lossless, best for stego" },
  { icon: Image, name: "JPEG", desc: "Good compression" },
  { icon: Image, name: "BMP", desc: "Uncompressed, large" },
  { icon: Image, name: "GIF", desc: "Animation support" },
  { icon: FileAudio, name: "WAV", desc: "Lossless audio" },
  { icon: FileAudio, name: "MP3", desc: "Compressed audio" },
  { icon: Film, name: "MP4", desc: "Video container" },
  { icon: FileText, name: "PDF", desc: "Document carrier" },
]

const MAX_FILE_SIZE = 100 * 1024 * 1024

const yieldToMain = () => new Promise<void>(r => setTimeout(r, 0))

const dropProps = (handler: (f: File) => void) => ({
  role: "button" as const,
  tabIndex: 0,
  onDragOver: (e: React.DragEvent) => { e.preventDefault() },
  onDrop: (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handler(f) },
  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.target as HTMLElement).click() } },
})

export default function SteganographyPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [message, setMessage] = useState("")
  const [charCount, setCharCount] = useState(0)
  const [encryptKey, setEncryptKey] = useState("")
  const [showEncryptKey, setShowEncryptKey] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(false)
  const [isEncoding, setIsEncoding] = useState(false)

  const [stegoFile, setStegoFile] = useState<File | null>(null)
  const [decryptKey, setDecryptKey] = useState("")
  const [showDecryptKey, setShowDecryptKey] = useState(false)
  const [isDecoding, setIsDecoding] = useState(false)
  const [extractedMessage, setExtractedMessage] = useState("")

  const carrierInputRef = useRef<HTMLInputElement>(null)
  const stegoInputRef = useRef<HTMLInputElement>(null)
  const analysisInputRef = useRef<HTMLInputElement>(null)

  const clearAll = useCallback(() => {
    setSelectedFile(null)
    setMessage("")
    setEncryptKey("")
    setStegoFile(null)
    setDecryptKey("")
    setExtractedMessage("")
    setAnalysisFile(null)
    setAnalysisResult(null)
    if (carrierInputRef.current) carrierInputRef.current.value = ""
    if (stegoInputRef.current) stegoInputRef.current.value = ""
    if (analysisInputRef.current) analysisInputRef.current.value = ""
  }, [])

  const validateFile = useCallback((file: File | null, label: string): boolean => {
    if (!file) { toast.error(`Select a ${label}`); return false }
    if (file.size > MAX_FILE_SIZE) { toast.error(`${label} too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 100MB`); return false }
    return true
  }, [])

  const [analysisFile, setAnalysisFile] = useState<File | null>(null)
  const [analysisResult, setAnalysisResult] = useState<{
    format: CarrierFormat
    fileSize: number
    entropy: number
    lsbPercent: number
    lsbDeviation: number
    chiSquare: number
    stegoProbability: number
    capacity: number
    canAnalyzeSpatial: boolean
    dimensions?: { width: number; height: number }
    wavInfo?: WavHeaderInfo
    hasAppendMarker: boolean
    trailingBytes: number
  } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleEncode = useCallback(async () => {
    if (!validateFile(selectedFile, "carrier file")) return
    if (!message.trim()) { toast.error("Enter a message to hide"); return }
    setIsEncoding(true)
    try {
      const blob = await steganographyEncodeFile(selectedFile!, message, encryptKey || undefined)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = selectedFile!.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      toast.success("Message embedded successfully")
    } catch (err: any) {
      toast.error(err.message || "Encoding failed")
    } finally {
      setIsEncoding(false)
    }
  }, [selectedFile, message, encryptKey, validateFile])

  const handleDecode = useCallback(async () => {
    if (!validateFile(stegoFile, "stego file")) return
    setIsDecoding(true)
    try {
      const result = await steganographyDecodeFile(stegoFile!, decryptKey || undefined)
      setExtractedMessage(result)
      if (!result.trim()) {
        toast("No hidden message found", { icon: "🔍" })
      } else {
        toast.success("Message extracted")
      }
    } catch (err: any) {
      toast.error(err.message || "Extraction failed")
    } finally {
      setIsDecoding(false)
    }
  }, [stegoFile, decryptKey, validateFile])

  const handleAnalyze = useCallback(async () => {
    if (!analysisFile || !validateFile(analysisFile, "file")) return
    setIsAnalyzing(true)
    try {
      const buffer = await analysisFile.arrayBuffer()
      const raw = new Uint8Array(buffer)
      const format = detectFormat(analysisFile.name, raw)
      const canSpatial = canUseSpatialLsb(format)
      const isImage = format === "PNG" || format === "JPEG" || format === "BMP" || format === "GIF"

      let pixelData: Uint8Array = raw
      let dimensions: { width: number; height: number } | undefined
      let wavInfo: WavHeaderInfo | undefined

      if (isImage) {
        const img = await imageToPixels(analysisFile)
        dimensions = { width: img.width, height: img.height }
        pixelData = img.pixels
      } else if (format === "WAV") {
        const wav = parseWavDataChunk(raw)
        if (wav) pixelData = raw.slice(wav.offset, wav.offset + wav.size)
        const header = parseWavHeader(raw)
        if (header) wavInfo = header
      }

      await yieldToMain()
      const entropy = computeEntropy(pixelData)
      await yieldToMain()
      let lsbRatio = 0.5
      let lsbDeviation = 0
      let chiSquare = 0
      let entropyDrop = 0
      let pairBias = 0
      if (canSpatial) {
        const spatialData = format === "WAV" ? pixelData : rgbOnlyFromRgba(pixelData)
        lsbRatio = computeLsbRatio(spatialData)
        lsbDeviation = Math.abs(lsbRatio - 0.5)
        await yieldToMain()
        chiSquare = computeChiSquare(spatialData)
        await yieldToMain()
        const stream = computeLsbStreamStats(spatialData)
        entropyDrop = stream.entropyDrop
        pairBias = stream.pairBias
        await yieldToMain()
      }
      const capacity = computeLsbCapacity(pixelData.length, canSpatial)
      const marker = detectAppendMarker(raw)
      const fileSize = raw.length

      const devScore = Math.min(1, Math.max(0, (lsbDeviation - 0.06) / 0.25))
      const dropScore = Math.min(1, Math.max(0, (entropyDrop - 0.004) / 0.02))
      const pairScore = Math.min(1, Math.max(0, (pairBias - 0.06) / 0.25))
      const spatialProb = canSpatial
        ? Math.min(1, Math.max(0.25 * devScore, 0.55 * dropScore + 0.45 * pairScore))
        : 0
      const stegoProbability = Math.round((marker.present ? Math.max(spatialProb, 0.9) : spatialProb) * 100) / 100

      setAnalysisResult({
        format,
        fileSize,
        canAnalyzeSpatial: canSpatial,
        entropy: Math.round(entropy * 100) / 100,
        lsbPercent: Math.round(lsbRatio * 10000) / 100,
        lsbDeviation: Math.round(lsbDeviation * 10000) / 100,
        chiSquare: Math.round(chiSquare * 10000) / 100,
        stegoProbability: Math.round(stegoProbability * 10000) / 100,
        capacity,
        dimensions,
        wavInfo,
        hasAppendMarker: marker.present,
        trailingBytes: marker.trailingBytes,
      })
    } catch (err: any) {
      toast.error(err.message || "Analysis failed")
    } finally {
      setIsAnalyzing(false)
    }
  }, [analysisFile, validateFile])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Steganography"
        description="Hide secret data inside images, audio, and video files"
        action={{ label: "New File", icon: RotateCcw, onClick: clearAll }}
      />

      <Tabs defaultValue="hide" className="space-y-6">
        <TabsList>
          <TabsTrigger value="hide">Hide Data</TabsTrigger>
          <TabsTrigger value="extract">Extract Data</TabsTrigger>
          <TabsTrigger value="analyze">Analyze Carrier</TabsTrigger>
        </TabsList>

        <TabsContent value="hide" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Select Carrier File</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-cyber-500/50 transition-colors"
                  onClick={() => carrierInputRef.current?.click()}
                  {...dropProps((f) => { if (f.size <= MAX_FILE_SIZE) setSelectedFile(f); else toast.error(`File too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Max: 100MB`) })}
                >
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium mb-1">Drop carrier file here</p>
                  <p className="text-xs text-muted-foreground">PNG, JPEG, BMP, WAV, MP3, MP4, PDF (max 100MB)</p>
                  <input
                    ref={carrierInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>
                {selectedFile && (
                  <FilePreviewCard
                    file={selectedFile}
                    onRemove={() => { setSelectedFile(null); if (carrierInputRef.current) carrierInputRef.current.value = "" }}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Hidden Payload</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold">Message to Hide</label>
                    <span className="text-xs text-muted-foreground">{charCount} chars</span>
                  </div>
                  <textarea
                    className="w-full h-28 rounded-xl border border-input bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyber-500/30 focus:border-cyber-500/50 transition-all"
                    placeholder="Enter your secret message..."
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); setCharCount(e.target.value.length) }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Encryption Key</label>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Optional</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showEncryptKey ? "text" : "password"}
                        placeholder="Leave empty for no encryption"
                        value={encryptKey}
                        onChange={(e) => setEncryptKey(e.target.value)}
                        className="pr-10 font-mono"
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowEncryptKey((v) => !v)}
                        tabIndex={-1}
                        aria-label={showEncryptKey ? "Hide key" : "Show key"}
                      >
                        {showEncryptKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setEncryptKey(
                        Array.from({ length: 4 }, () =>
                          Math.random().toString(36).slice(2, 10)
                        ).join("-")
                      )}
                      title="Generate random key"
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-xs"
                    onClick={() => {
                      setSelectedFile(null)
                      setMessage("")
                      setEncryptKey(
                        Array.from({ length: 4 }, () =>
                          Math.random().toString(36).slice(2, 10)
                        ).join("-")
                      )
                      if (carrierInputRef.current) carrierInputRef.current.value = ""
                      toast.success("Carrier & encryption fields refreshed")
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh — clear carrier & generate new key
                  </Button>
                </div>
                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleEncode}
                  disabled={isEncoding || !selectedFile || !message}
                >
                  {isEncoding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  {isEncoding ? "Embedding..." : "Embed & Download"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Supported Carrier Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {supportedFormats.map((format) => (
                  <div key={format.name} className="p-3 rounded-lg bg-muted/30 text-center">
                    <format.icon className="h-6 w-6 mx-auto mb-2 text-cyber-400" />
                    <p className="text-sm font-medium">{format.name}</p>
                    <p className="text-xs text-muted-foreground">{format.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extract">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Extract Hidden Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-cyber-500/50 transition-colors"
                onClick={() => stegoInputRef.current?.click()}
                {...dropProps((f) => { if (f.size <= MAX_FILE_SIZE) setStegoFile(f); else toast.error(`File too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Max: 100MB`) })}
              >
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-medium">Drop stego file to extract</p>
                <p className="text-xs text-muted-foreground">Supports all carrier formats</p>
                <input
                  ref={stegoInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setStegoFile(e.target.files?.[0] || null)}
                />
              </div>
              {stegoFile && (
                <FilePreviewCard
                  file={stegoFile}
                  onRemove={() => { setStegoFile(null); setExtractedMessage(""); if (stegoInputRef.current) stegoInputRef.current.value = "" }}
                />
              )}

              {/* Optional decryption key */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-cyber-400" />
                    Decryption Passphrase
                  </label>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Optional</span>
                </div>
                <div className="relative">
                  <Input
                    id="stego-decrypt-key"
                    type={showDecryptKey ? "text" : "password"}
                    placeholder="Leave blank if message was not encrypted"
                    value={decryptKey}
                    onChange={(e) => setDecryptKey(e.target.value)}
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowDecryptKey((v) => !v)}
                    tabIndex={-1}
                    aria-label={showDecryptKey ? "Hide key" : "Show key"}
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Only fill this in if you used a passphrase when hiding the data. Wrong key will show garbled text.
                </p>
              </div>

              <Button
                variant="cyber"
                className="w-full"
                onClick={handleDecode}
                disabled={isDecoding || !stegoFile}
              >
                {isDecoding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {isDecoding ? "Extracting..." : "Extract Hidden Data"}
              </Button>
              {extractedMessage && (
                <div className="p-4 rounded-xl border border-success/20 bg-success/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" /> Extracted Message
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => {
                        navigator.clipboard.writeText(extractedMessage)
                        setCopiedMessage(true)
                        toast.success("Copied to clipboard")
                        setTimeout(() => setCopiedMessage(false), 2000)
                      }}
                    >
                      {copiedMessage ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedMessage ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background border border-border text-sm font-mono break-all leading-relaxed max-h-48 overflow-y-auto">
                    {extractedMessage || (
                      <span className="text-muted-foreground italic">No hidden message found</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{extractedMessage.length} characters extracted</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analyze">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Carrier Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-cyber-500/50 transition-colors"
                onClick={() => analysisInputRef.current?.click()}
                {...dropProps((f) => { if (f.size <= MAX_FILE_SIZE) { setAnalysisFile(f); setAnalysisResult(null) } else toast.error(`File too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Max: 100MB`) })}
              >
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm font-medium">Drop file for steganographic analysis</p>
                <input
                  ref={analysisInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    setAnalysisFile(e.target.files?.[0] || null)
                    setAnalysisResult(null)
                  }}
                />
              </div>
              {analysisFile && (
                <FilePreviewCard
                  file={analysisFile}
                  onRemove={() => { setAnalysisFile(null); setAnalysisResult(null); if (analysisInputRef.current) analysisInputRef.current.value = "" }}
                />
              )}
              <Button
                variant="cyber"
                className="w-full"
                onClick={handleAnalyze}
                disabled={isAnalyzing || !analysisFile}
              >
                {isAnalyzing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="mr-2 h-4 w-4" />
                )}
                {isAnalyzing ? "Analyzing..." : "Run Analysis"}
              </Button>

              {analysisResult && (
                <div className="space-y-6 pt-2">
                  {/* Modern Threat Summary Header Card */}
                  <div className={`p-5 rounded-xl border transition-all ${
                    analysisResult.stegoProbability > 0.6 || analysisResult.hasAppendMarker
                      ? "bg-destructive/10 border-destructive/40"
                      : analysisResult.stegoProbability > 0.35
                      ? "bg-amber-500/10 border-amber-500/40"
                      : "bg-emerald-500/10 border-emerald-500/40"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${
                          analysisResult.stegoProbability > 0.6 || analysisResult.hasAppendMarker
                            ? "bg-destructive/20 text-destructive"
                            : analysisResult.stegoProbability > 0.35
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}>
                          <ShieldAlert className="h-7 w-7" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold">
                              {analysisResult.stegoProbability > 0.6
                                ? "High Steganographic Risk"
                                : analysisResult.stegoProbability > 0.35
                                ? "Suspicious Anomalies Detected"
                                : "Carrier Clean / Normal"}
                            </h3>
                            <Badge variant={
                              analysisResult.stegoProbability > 0.6 ? "destructive" : analysisResult.stegoProbability > 0.35 ? "warning" : "success"
                            }>
                              {analysisResult.format}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Analysis completed on <span className="font-semibold text-foreground">{analysisFile?.name || "carrier file"}</span> &middot; {(analysisResult.fileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-border/50 pt-3 sm:pt-0 sm:pl-4">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground font-medium">Stego Probability</p>
                          <p className={`text-2xl font-black tabular-nums ${
                            analysisResult.stegoProbability > 0.6 ? "text-destructive" : analysisResult.stegoProbability > 0.35 ? "text-amber-400" : "text-emerald-400"
                          }`}>
                            {(analysisResult.stegoProbability * 100).toFixed(0)}%
                          </p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={clearAll} className="ml-2">
                          <Trash2 className="h-4 w-4 mr-1.5" /> Clear & Delete Analysis
                        </Button>
                      </div>
                    </div>
                  </div>

                  {!analysisResult.canAnalyzeSpatial && (
                    <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs flex items-center gap-2 text-amber-300">
                      <Info className="h-4 w-4 shrink-0 text-amber-400" />
                      <span>
                        <strong>Compressed Container ({analysisResult.format})</strong>: Spatial LSB bit-plane analysis is disabled for compressed codecs. Entropy evaluation and trailer append detection are active.
                      </span>
                    </div>
                  )}

                  {/* Forensic Metrics Grid */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Shannon Entropy Card */}
                    <div className="p-4 rounded-xl glass-card border border-border/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 text-cyber-400" /> Shannon Entropy
                        </span>
                        <Badge variant="outline" className="text-[10px]">Max 8.0</Badge>
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className={`text-2xl font-black tabular-nums ${
                            analysisResult.entropy > 7.5 ? "text-destructive" : analysisResult.entropy > 6.5 ? "text-amber-400" : "text-cyber-400"
                          }`}>
                            {analysisResult.entropy.toFixed(2)}
                          </span>
                          <span className="text-xs font-medium text-muted-foreground">bits / byte</span>
                        </div>
                        {/* Progress Meter Bar */}
                        <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              analysisResult.entropy > 7.5 ? "bg-destructive" : analysisResult.entropy > 6.5 ? "bg-amber-400" : "bg-cyber-500"
                            }`}
                            style={{ width: `${(analysisResult.entropy / 8.0) * 100}%` }}
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {analysisResult.entropy > 7.5
                          ? "⚠️ High randomness — typical of encrypted or hidden binary payloads."
                          : analysisResult.entropy > 6.5
                          ? "⚡ Moderate randomness — typical of compressed imagery/audio."
                          : "✅ Low entropy — normal uncompressed pattern distribution."}
                      </p>
                    </div>

                    {/* LSB Parity Distribution */}
                    {analysisResult.canAnalyzeSpatial ? (
                      <div className="p-4 rounded-xl glass-card border border-border/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <BarChart3 className="h-3.5 w-3.5 text-blue-400" /> LSB Uniformity
                          </span>
                          <Badge variant="outline" className="text-[10px]">Ideal 50%</Badge>
                        </div>
                        <div>
                          <div className="flex items-baseline justify-between mb-1">
                            <span className={`text-2xl font-black tabular-nums ${
                              analysisResult.lsbDeviation > 0.06 ? "text-amber-400" : "text-cyber-400"
                            }`}>
                              {analysisResult.lsbPercent.toFixed(1)}%
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                              dev: {analysisResult.lsbDeviation.toFixed(2)}
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-muted/60 overflow-hidden relative">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${analysisResult.lsbPercent}%` }}
                            />
                            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-foreground/60 z-10" title="50% Midline" />
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {analysisResult.lsbDeviation > 0.05
                            ? "⚠️ Biased LSB bit parity — possible stego layer detected."
                            : "✅ Ideal 50% bit distribution observed across carrier."}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl glass-card border border-border/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <HardDrive className="h-3.5 w-3.5 text-amber-400" /> Append Trailer Data
                          </span>
                          <Badge variant={analysisResult.hasAppendMarker ? "destructive" : "outline"} className="text-[10px]">
                            {analysisResult.hasAppendMarker ? "Appended Payload" : "Clean EOF"}
                          </Badge>
                        </div>
                        <div>
                          <p className={`text-2xl font-black tabular-nums ${analysisResult.hasAppendMarker ? "text-destructive" : "text-cyber-400"}`}>
                            {analysisResult.hasAppendMarker ? `${analysisResult.trailingBytes} B` : "None"}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {analysisResult.hasAppendMarker
                            ? "⚠️ Trailing data bytes detected beyond the official file EOF marker."
                            : "✅ File structure clean — no trailing appended payload detected."}
                        </p>
                      </div>
                    )}

                    {/* Chi-Square Test */}
                    {analysisResult.canAnalyzeSpatial ? (
                      <div className="p-4 rounded-xl glass-card border border-border/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-purple-400" /> Chi-Square Test
                          </span>
                          <Badge variant="outline" className="text-[10px]">P-Value</Badge>
                        </div>
                        <div>
                          <p className={`text-2xl font-black tabular-nums ${
                            analysisResult.chiSquare > 0.5
                              ? "text-destructive"
                              : analysisResult.chiSquare > 0.2
                              ? "text-amber-400"
                              : "text-cyber-400"
                          }`}>
                            {analysisResult.chiSquare.toFixed(2)}
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {analysisResult.chiSquare > 0.5
                            ? "⚠️ Chi-square test indicates high probability of modified pairs of values."
                            : "✅ Pixel pairs exhibit natural, unmanipulated statistical variation."}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl glass-card border border-border/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-cyber-400" /> Payload Capacity
                          </span>
                          <Badge variant="outline" className="text-[10px]">LSB Limit</Badge>
                        </div>
                        <div>
                          <p className="text-2xl font-black text-cyber-400 tabular-nums">
                            {(analysisResult.capacity / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Max estimated hidden payload: ~{analysisResult.capacity.toLocaleString()} characters.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Technical Specs & Carrier Metadata */}
                  <div className="p-4 rounded-xl glass-card border border-border/60 space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck className="h-4 w-4 text-cyber-400" /> Carrier Specifications & Structure
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground">Format Codec</p>
                        <p className="font-semibold text-foreground mt-0.5">{analysisResult.format}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground">File Size</p>
                        <p className="font-semibold text-foreground mt-0.5">{(analysisResult.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                      {analysisResult.dimensions && (
                        <div className="p-2.5 rounded-lg bg-muted/40">
                          <p className="text-[10px] text-muted-foreground">Resolution</p>
                          <p className="font-semibold text-foreground mt-0.5">{analysisResult.dimensions.width} &times; {analysisResult.dimensions.height} px</p>
                        </div>
                      )}
                      {analysisResult.wavInfo && (
                        <>
                          <div className="p-2.5 rounded-lg bg-muted/40">
                            <p className="text-[10px] text-muted-foreground">Audio Sample Rate</p>
                            <p className="font-semibold text-foreground mt-0.5">{(analysisResult.wavInfo.sampleRate / 1000).toFixed(1)} kHz</p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-muted/40">
                            <p className="text-[10px] text-muted-foreground">Channels & Depth</p>
                            <p className="font-semibold text-foreground mt-0.5">{analysisResult.wavInfo.channels} ch / {analysisResult.wavInfo.bitDepth}-bit</p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-muted/40">
                            <p className="text-[10px] text-muted-foreground">Duration</p>
                            <p className="font-semibold text-foreground mt-0.5">{analysisResult.wavInfo.duration.toFixed(1)} s</p>
                          </div>
                        </>
                      )}
                      <div className="p-2.5 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground">Theoretical Capacity</p>
                        <p className="font-semibold text-cyber-400 mt-0.5">{(analysisResult.capacity / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
