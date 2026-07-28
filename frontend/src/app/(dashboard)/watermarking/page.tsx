"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { Droplets, Upload, Shield, Loader2, List, Trash2, Image, Download, Move, X, Eye, RotateCcw, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/api"
import toast from "react-hot-toast"

interface WatermarkItem {
  id: string
  fileId: string
  type: string
  text: string
  createdAt: string
  positionX?: number
  positionY?: number
  opacity?: number
  fontSize?: number
  fontColor?: string
  originalPath?: string
  watermarkedPath?: string
  originalMime?: string
  originalSize?: number
}

export default function WatermarkingPage() {
  const [items, setItems] = useState<WatermarkItem[]>([])
  const [currentTab, setCurrentTab] = useState("invisible")
  const [loading, setLoading] = useState(true)
  const [embedding, setEmbedding] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [watermarkText, setWatermarkText] = useState("")
  const [watermarkX, setWatermarkX] = useState(85)
  const [watermarkY, setWatermarkY] = useState(85)
  const [opacity, setOpacity] = useState(50)
  const [fontSize, setFontSize] = useState(4)
  const [fontColor, setFontColor] = useState("#ffffff")
  const [fileName, setFileName] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [renderedWatermarkUrl, setRenderedWatermarkUrl] = useState<string | null>(null)
  const [watermarkApplied, setWatermarkApplied] = useState(false)
  const [lastEmbeddedId, setLastEmbeddedId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dropzoneActive, setDropzoneActive] = useState(false)
  const [imgDisplaySize, setImgDisplaySize] = useState({ w: 0, h: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const [viewingWatermark, setViewingWatermark] = useState<WatermarkItem | null>(null)
  const [viewingWatermarkUrl, setViewingWatermarkUrl] = useState<string | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0, wx: 0, wy: 0 })

  const fetchItems = async () => {
    setLoading(true)
    try {
      const result = await api.get<{ items: WatermarkItem[] }>("/watermark")
      setItems(result.items || [])
    } catch { /* offline */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchItems() }, [])

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  useEffect(() => {
    return () => { if (renderedWatermarkUrl) URL.revokeObjectURL(renderedWatermarkUrl) }
  }, [renderedWatermarkUrl])

  useEffect(() => {
    if (watermarkApplied) {
      setWatermarkApplied(false)
      setPreviewing(false)
      if (renderedWatermarkUrl) URL.revokeObjectURL(renderedWatermarkUrl)
      setRenderedWatermarkUrl(null)
    }
  }, [watermarkText, watermarkX, watermarkY, opacity, fontSize, fontColor, lastEmbeddedId])

  const processSelectedFile = useCallback((f: File) => {
    if (f.size > 100 * 1024 * 1024) {
      toast.error("File exceeds 100MB size limit")
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (renderedWatermarkUrl) { URL.revokeObjectURL(renderedWatermarkUrl); setRenderedWatermarkUrl(null) }
    setLastEmbeddedId(null)
    setSelectedFile(f)
    setFileName(f.name)
    setPreviewUrl(URL.createObjectURL(f))
    setWatermarkApplied(false)
  }, [previewUrl, renderedWatermarkUrl])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processSelectedFile(f)
  }

  const generatePreview = useCallback(async () => {
    if (!selectedFile || !watermarkText.trim()) {
      toast.error("Select a file and enter watermark text")
      return
    }
    setPreviewing(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("text", watermarkText.trim())
      formData.append("x", watermarkX.toString())
      formData.append("y", watermarkY.toString())
      formData.append("opacity", opacity.toString())
      formData.append("fontSize", fontSize.toString())
      formData.append("color", fontColor)
      const blob = await api.downloadBlob("/watermark/visible/preview", formData)
      const url = URL.createObjectURL(blob)
      if (renderedWatermarkUrl) URL.revokeObjectURL(renderedWatermarkUrl)
      setRenderedWatermarkUrl(url)
      setWatermarkApplied(true)
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate preview")
    } finally {
      setPreviewing(false)
    }
  }, [selectedFile, watermarkText, watermarkX, watermarkY, fontSize, fontColor, opacity])

  const handleDownload = useCallback(() => {
    if (lastEmbeddedId) {
      downloadWatermark(lastEmbeddedId, "watermarked")
    } else if (renderedWatermarkUrl) {
      const a = document.createElement("a")
      a.href = renderedWatermarkUrl
      a.download = `watermarked-${fileName || "image"}.png`
      a.click()
      toast.success("Watermarked image downloaded")
    }
  }, [renderedWatermarkUrl, fileName, lastEmbeddedId])

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pos = "touches" in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }
    dragStartRef.current = { x: pos.x, y: pos.y, wx: watermarkX, wy: watermarkY }
    setIsDragging(true)
  }, [watermarkX, watermarkY])

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !previewContainerRef.current) return
    const pos = "touches" in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }
    const rect = previewContainerRef.current.getBoundingClientRect()
    const dx = ((pos.x - dragStartRef.current.x) / rect.width) * 100
    const dy = ((pos.y - dragStartRef.current.y) / rect.height) * 100
    setWatermarkX(Math.max(0, Math.min(100, dragStartRef.current.wx + dx)))
    setWatermarkY(Math.max(0, Math.min(100, dragStartRef.current.wy + dy)))
  }, [isDragging])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleDragMove)
      window.addEventListener("mouseup", handleDragEnd)
      window.addEventListener("touchmove", handleDragMove, { passive: true })
      window.addEventListener("touchend", handleDragEnd)
      return () => {
        window.removeEventListener("mousemove", handleDragMove)
        window.removeEventListener("mouseup", handleDragEnd)
        window.removeEventListener("touchmove", handleDragMove)
        window.removeEventListener("touchend", handleDragEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  const embedWatermark = async (type: "invisible" | "visible") => {
    if (!selectedFile || !watermarkText.trim()) {
      toast.error("Select a file and enter watermark text")
      return
    }
    setEmbedding(true)
    try {
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("text", watermarkText.trim())
      if (type === "visible") {
        formData.append("x", watermarkX.toString())
        formData.append("y", watermarkY.toString())
        formData.append("opacity", opacity.toString())
        formData.append("fontSize", fontSize.toString())
        formData.append("color", fontColor)
      }
      const endpoint = type === "invisible" ? "/watermark/invisible" : "/watermark/visible"
      const res = await api.upload<{id: string}>(endpoint, formData)
      setLastEmbeddedId(res.id)
      await fetchWatermarkedImage(res.id)
      if (type === "visible") {
        toast.success("Visible watermark applied — click Download to save")
      } else {
        toast.success("Invisible LSB watermark embedded successfully!")
      }
      fetchItems()
    } catch (err: any) {
      toast.error(err?.message || "Failed to embed watermark")
    } finally {
      setEmbedding(false)
    }
  }

  const fetchWatermarkedImage = async (id: string) => {
    try {
      const blob = await api.download(`/watermark/${id}/download`)
      const url = URL.createObjectURL(blob)
      if (renderedWatermarkUrl) URL.revokeObjectURL(renderedWatermarkUrl)
      setRenderedWatermarkUrl(url)
      setWatermarkApplied(true)
    } catch {
      toast.error("Failed to load watermarked image from server")
    }
  }

  const viewWatermark = async (item: WatermarkItem) => {
    setViewingWatermark(item)
    if (viewingWatermarkUrl) URL.revokeObjectURL(viewingWatermarkUrl)
    setViewingWatermarkUrl(null)
    try {
      const blob = await api.download(`/watermark/${item.id}/download`)
      const url = URL.createObjectURL(blob)
      setViewingWatermarkUrl(url)
    } catch (error) {
      console.error("Failed to fetch watermark image:", error)
    }
  }

  const downloadWatermark = async (id: string, type: "watermarked" | "original") => {
    try {
      const endpoint = type === "watermarked" ? `/watermark/${id}/download` : `/watermark/${id}/original`
      const blob = await api.download(endpoint)
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      // Use backend Content-Disposition filename; fallback to constructed name
      a.download = `stegshield-watermark-${type}-${id.substring(0, 8)}`
      a.click()
      URL.revokeObjectURL(downloadUrl)
      toast.success(`${type === "watermarked" ? "Watermarked" : "Original"} file downloaded`)
    } catch (error: any) {
      toast.error(`Failed to download: ${error.message}`)
    }
  }

  const extractWatermark = async (id: string) => {
    try {
      const endpoint = "/watermark/" + id + "/extract"
      const result = await api.post<{ text: string; verified: boolean }>(endpoint)
      if (result.verified && result.text) {
        toast.success(`Invisible watermark verified: "${result.text}"`, { duration: 5000 })
      } else {
        toast.error("Watermark verification failed or payload corrupted", { duration: 4000 })
      }
      fetchItems()
    } catch (error: any) {
      toast.error("Failed to extract watermark: " + error.message)
    }
  }

  const resetAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (renderedWatermarkUrl) { URL.revokeObjectURL(renderedWatermarkUrl); setRenderedWatermarkUrl(null) }
    setLastEmbeddedId(null)
    setSelectedFile(null)
    setFileName("")
    setPreviewUrl(null)
    setWatermarkText("")
    setWatermarkApplied(false)
    setPreviewing(false)
    setWatermarkX(85)
    setWatermarkY(85)
    setOpacity(50)
    setFontSize(4)
    setFontColor("#ffffff")
    setImgDisplaySize({ w: 0, h: 0 })
    if (fileInputRef.current) fileInputRef.current.value = ""
    toast.success("State reset")
  }

  const deleteItem = async (id: string) => {
    setDeleting(id)
    try {
      await api.delete("/watermark/" + id)
      setItems(prev => prev.filter(i => i.id !== id))
      localStorage.removeItem("wm_img_" + id)
      if (viewingWatermark?.id === id) { setViewingWatermark(null); setViewingWatermarkUrl(null) }
      toast.success("Watermark deleted")
    } catch {
      toast.error("Failed to delete")
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (d: string) => {
    const date = new Date(d)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 60000) return "Just now"
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago"
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago"
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Digital Watermarking"
        description="Embed invisible LSB and visible dynamic watermarks for copyright protection and leak tracing"
        action={{ label: "Reset", icon: RotateCcw, onClick: resetAll }}
      />

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*" />

      <Tabs value={currentTab} onValueChange={(v) => { setCurrentTab(v); resetAll() }} className="space-y-6">
        <TabsList>
          <TabsTrigger value="invisible"><Droplets className="mr-2 h-4 w-4" />Invisible Watermark</TabsTrigger>
          <TabsTrigger value="visible"><Image className="mr-2 h-4 w-4" />Visible Watermark</TabsTrigger>
          <TabsTrigger value="history"><List className="mr-2 h-4 w-4" />History ({items.length})</TabsTrigger>
        </TabsList>

        {/* ── INVISIBLE WATERMARK TAB ── */}
        <TabsContent value="invisible">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-cyber-400" /> Watermark Settings
                </CardTitle>
                <CardDescription>LSB bit-plane invisible steganographic watermark</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dropzoneActive ? "border-cyber-500 bg-cyber-500/10 shadow-lg shadow-cyber-500/10" : "border-border hover:border-cyber-500/50 bg-background/20"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDropzoneActive(true) }}
                  onDragLeave={() => setDropzoneActive(false)}
                  onDrop={(e) => { e.preventDefault(); setDropzoneActive(false); const f = e.dataTransfer.files[0]; if (f) processSelectedFile(f) }}
                >
                  <Upload className={`h-8 w-8 mx-auto mb-2 transition-colors ${dropzoneActive ? "text-cyber-400" : "text-muted-foreground"}`} />
                  <p className="text-sm font-semibold">{fileName || "Click or drop file to select"}</p>
                  <p className="text-xs text-muted-foreground mt-1">Supported: PNG, JPEG, WEBP, BMP, TIFF (max 100MB)</p>
                </div>

                {selectedFile && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-cyber-500/10 border border-cyber-500/20 text-xs">
                    <span className="font-semibold text-cyber-300 truncate">{selectedFile.name}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-destructive" onClick={resetAll}>
                      <X className="h-3.5 w-3.5" /> Clear
                    </Button>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Watermark Payload Text</label>
                  <Input
                    placeholder="Enter confidential watermark text (e.g. Copyright 2026 StegShield)"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                  />
                </div>

                <Button variant="cyber" className="w-full h-11 text-base font-semibold" onClick={() => embedWatermark("invisible")} disabled={embedding || !selectedFile || !watermarkText.trim()}>
                  {embedding ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Embedding Watermark...</>
                  ) : (
                    <><Droplets className="mr-2 h-4 w-4" /> Embed Invisible Watermark</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-cyber-400" /> {previewUrl ? "Image Preview" : "Recent Invisible Watermarks"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[300px]">
                {previewUrl ? (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="w-full rounded-2xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Uploaded preview" className="max-w-full max-h-[380px] object-contain rounded-xl" />
                    </div>
                    <p className="text-xs text-muted-foreground text-center font-mono">{fileName}</p>
                    {lastEmbeddedId && (
                      <Button variant="cyber" size="sm" onClick={() => downloadWatermark(lastEmbeddedId, "watermarked")}>
                        <Download className="mr-2 h-4 w-4" /> Download Invisible Watermarked Image
                      </Button>
                    )}
                  </div>
                ) : items.filter(i => i.type === "INVISIBLE").length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground space-y-2">
                    <Droplets className="h-10 w-10 mx-auto opacity-30" />
                    <p className="text-sm font-medium">No invisible watermarks yet</p>
                    <p className="text-xs">Select an image to view preview and embed payload</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 w-full">
                    {items.filter(i => i.type === "INVISIBLE").slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40 hover:bg-muted/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{item.fileId}</p>
                          <p className="text-[11px] text-muted-foreground truncate">&ldquo;{item.text}&rdquo;</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <Badge variant="outline" className="text-[10px]">Invisible</Badge>
                          <button onClick={() => extractWatermark(item.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-emerald-400 transition-colors" title="Verify & Extract">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => downloadWatermark(item.id, "watermarked")} className="p-1.5 rounded-lg text-muted-foreground hover:text-cyber-400 transition-colors" title="Download">
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                            {deleting === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── VISIBLE WATERMARK TAB ── */}
        <TabsContent value="visible">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5 text-cyber-400" /> Visible Watermark Settings
                </CardTitle>
                <CardDescription>Custom text, font size, opacity, and drag positioning</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    dropzoneActive ? "border-cyber-500 bg-cyber-500/10 shadow-lg shadow-cyber-500/10" : "border-border hover:border-cyber-500/50 bg-background/20"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDropzoneActive(true) }}
                  onDragLeave={() => setDropzoneActive(false)}
                  onDrop={(e) => { e.preventDefault(); setDropzoneActive(false); const f = e.dataTransfer.files[0]; if (f) processSelectedFile(f) }}
                >
                  <Upload className={`h-8 w-8 mx-auto mb-2 transition-colors ${dropzoneActive ? "text-cyber-400" : "text-muted-foreground"}`} />
                  <p className="text-sm font-semibold">{fileName || "Click or drop image to select"}</p>
                  <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WEBP, BMP</p>
                </div>

                {selectedFile && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-cyber-500/10 border border-cyber-500/20 text-xs">
                    <span className="font-semibold text-cyber-300 truncate">{selectedFile.name}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-destructive" onClick={resetAll}>
                      <X className="h-3.5 w-3.5" /> Clear
                    </Button>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Watermark Text</label>
                  <Input placeholder="e.g. CONFIDENTIAL / SAMPLE" value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Opacity</span> <span className="text-cyber-400 font-mono">{opacity}%</span>
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      className="w-full accent-cyber-500"
                      value={opacity}
                      onChange={(e) => setOpacity(parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Font Size</span> <span className="text-cyber-400 font-mono">{fontSize}%</span>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={15}
                      step={0.5}
                      className="w-full accent-cyber-500"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground block">Text Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={fontColor}
                      onChange={(e) => setFontColor(e.target.value)}
                      className="sr-only"
                    />
                    <button
                      className="w-9 h-9 rounded-full border-2 border-border hover:border-cyber-500 transition-colors cursor-pointer shrink-0"
                      style={{ backgroundColor: fontColor }}
                      onClick={() => colorInputRef.current?.click()}
                    />
                    <span className="text-xs text-muted-foreground font-mono">{fontColor}</span>
                    <div className="flex gap-1.5 ml-auto flex-wrap">
                      {("#ffffff #000000 #ff4444 #44ff44 #4488ff #ffdd00 #ff8800 #ff44ff").split(" ").map((c) => (
                        <button
                          key={c}
                          className={`w-5 h-5 rounded-full border transition-all ${fontColor === c ? "border-cyber-400 ring-2 ring-cyber-400/50 scale-110" : "border-border"}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setFontColor(c)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 text-xs text-muted-foreground flex items-start gap-2 border border-border/40">
                  <Move className="h-4 w-4 shrink-0 text-cyber-400 mt-0.5" />
                  <span>Drag the watermark text directly on the live preview to position it anywhere on the image.</span>
                </div>

                <Button variant="cyber" className="w-full h-11 text-base font-semibold" onClick={() => embedWatermark("visible")} disabled={embedding || !selectedFile || !watermarkText.trim()}>
                  {embedding ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing Watermark...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" /> Apply Visible Watermark</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-cyber-400" /> Interactive Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center min-h-[400px]">
                {(() => {
                  const showApplied = watermarkApplied && renderedWatermarkUrl
                  if (showApplied) {
                    return (
                      <div className="flex flex-col items-center gap-4 w-full">
                        <div className="relative w-full max-h-[500px] flex items-center justify-center rounded-2xl border border-border bg-muted/20 overflow-hidden p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={renderedWatermarkUrl!} alt="Watermarked" className="w-full h-full max-h-[500px] object-contain rounded-xl" />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Rendered by server — matches download exactly</p>
                        <Button variant="cyber" size="sm" onClick={handleDownload}>
                          <Download className="mr-2 h-4 w-4" /> Download Watermarked Image
                        </Button>
                      </div>
                    )
                  }
                  if (previewUrl) {
                    return (
                      <div className="flex flex-col items-center gap-4 w-full">
                        <div
                          ref={previewContainerRef}
                          className="relative mx-auto select-none rounded-2xl border border-border bg-muted/20 overflow-hidden p-2"
                          style={{
                            maxWidth: "100%",
                            maxHeight: "500px",
                            aspectRatio: (imgDisplaySize.w && imgDisplaySize.h) ? `${imgDisplaySize.w} / ${imgDisplaySize.h}` : "auto",
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewUrl}
                            alt="Original"
                            className="w-full h-full object-contain pointer-events-none rounded-xl"
                            draggable={false}
                            style={{ maxHeight: "500px" }}
                            onLoad={(e) => {
                              const img = e.currentTarget
                              const nw = img.naturalWidth; const nh = img.naturalHeight
                              let dw = nw; let dh = nh
                              const maxDim = 500
                              if (dw > maxDim) { dh = (dh * maxDim) / dw; dw = maxDim }
                              if (dh > maxDim) { dw = (dw * maxDim) / dh; dh = maxDim }
                              setImgDisplaySize({ w: Math.round(dw), h: Math.round(dh) })
                            }}
                          />
                          {watermarkText && (
                            <div
                              className="absolute font-bold cursor-move"
                              style={{
                                left: `${watermarkX}%`,
                                top: `${watermarkY}%`,
                                transform: "translate(-50%, -50%)",
                              }}
                              onMouseDown={handleDragStart}
                              onTouchStart={handleDragStart}
                            >
                              <span
                                className="inline-block pointer-events-none select-none"
                                style={{
                                  opacity: opacity / 100,
                                  fontSize: `${Math.max(8, (fontSize / 100) * (imgDisplaySize.w || 500))}px`,
                                  color: fontColor,
                                  textShadow: "0 0 6px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.7)",
                                }}
                              >
                                {watermarkText}
                              </span>
                              <Move className="absolute -top-3 -right-3 h-4 w-4 text-white drop-shadow-lg opacity-70" />
                            </div>
                          )}
                        </div>
                        {watermarkText && (
                          <p className="text-xs text-muted-foreground text-center mt-3">
                            Drag watermark to adjust position, then click <strong>Generate Preview</strong>
                          </p>
                        )}
                        {watermarkText && (
                          <Button variant="cyber" size="sm" onClick={generatePreview} disabled={previewing}>
                            {previewing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Eye className="mr-2 h-4 w-4" /> Generate Server-Side Preview</>}
                          </Button>
                        )}
                      </div>
                    )
                  }
                  return (
                    <div className="flex flex-col items-center py-16 text-muted-foreground space-y-2">
                      <Image className="h-14 w-14 opacity-30" />
                      <p className="text-sm font-medium">Select an image to preview watermark</p>
                      <p className="text-xs opacity-60">Server-side rendered preview matches actual watermark output</p>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── HISTORY TAB ── */}
        <TabsContent value="history">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5 text-cyber-400" /> Watermark History ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-cyber-400" />
                </div>
              ) : items.length === 0 ? (
                <div className="p-16 text-center text-muted-foreground space-y-3">
                  <Shield className="h-10 w-10 mx-auto opacity-30" />
                  <p className="text-sm font-medium">No watermark history recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 border border-border/40 hover:border-cyber-500/30 hover:bg-muted/30 transition-all cursor-pointer group"
                      onClick={() => viewWatermark(item)}
                    >
                      <div className="p-2.5 rounded-xl bg-cyber-500/10 shrink-0">
                        {item.type === "INVISIBLE" ? <Droplets className="h-5 w-5 text-cyber-400" /> : <Image className="h-5 w-5 text-cyber-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{item.fileId}</p>
                        <p className="text-xs text-muted-foreground truncate">&ldquo;{item.text}&rdquo;</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={item.type === "INVISIBLE" ? "outline" : "secondary"} className="text-[10px]">
                          {item.type === "INVISIBLE" ? "Invisible LSB" : "Visible"}
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden sm:inline">{formatDate(item.createdAt)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-cyber-400"
                          onClick={(e) => { e.stopPropagation(); downloadWatermark(item.id, "watermarked") }}
                          title="Download Watermarked File"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {item.type === "INVISIBLE" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-emerald-400"
                            onClick={(e) => { e.stopPropagation(); extractWatermark(item.id) }}
                            title="Verify & Extract Watermark"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteItem(item.id) }}
                          disabled={deleting === item.id}
                          title="Delete"
                        >
                          {deleting === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Viewing Watermark Modal */}
      {viewingWatermark && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in" onClick={() => { setViewingWatermark(null); setViewingWatermarkUrl(null) }}>
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold truncate">{viewingWatermark.fileId}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(viewingWatermark.createdAt)}</p>
              </div>
              <button
                className="p-2 rounded-xl hover:bg-muted/50 transition-colors shrink-0 ml-4"
                onClick={() => { setViewingWatermark(null); setViewingWatermarkUrl(null) }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 pt-0">
              <div className="flex items-center gap-2">
                <Badge variant={viewingWatermark.type === "INVISIBLE" ? "outline" : "secondary"}>
                  {viewingWatermark.type === "INVISIBLE" ? "Invisible LSB" : "Visible"}
                </Badge>
                <span className="text-xs text-muted-foreground font-semibold">Watermark Payload: &ldquo;{viewingWatermark.text}&rdquo;</span>
              </div>
              {viewingWatermarkUrl ? (
                <div className="rounded-xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={viewingWatermarkUrl} alt="Watermarked preview" className="max-w-full max-h-[480px] object-contain rounded-lg" />
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 text-muted-foreground rounded-xl border border-dashed border-border/50">
                  <Image className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm font-medium">No cached preview</p>
                  <p className="text-xs opacity-60">Click download to fetch file from server</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="cyber" className="flex-1" onClick={() => downloadWatermark(viewingWatermark.id, "watermarked")}>
                  <Download className="mr-2 h-4 w-4" /> Download Watermarked
                </Button>
                {viewingWatermark.type === "INVISIBLE" && (
                  <Button variant="outline" className="flex-1" onClick={() => extractWatermark(viewingWatermark.id)}>
                    <Eye className="mr-2 h-4 w-4 text-emerald-400" /> Verify & Extract Payload
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
