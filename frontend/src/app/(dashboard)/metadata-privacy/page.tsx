"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import {
  Upload, Search, Trash2, Loader2, CheckCircle2, AlertTriangle,
  File, MapPin, Camera, Monitor, FileText, Shield, Download,
  Image as ImageIcon, X, Clock, Info, Layers, RotateCcw, Copy, Check,
  ExternalLink, Filter, Sparkles, Zap,
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

const MAX_FILE_SIZE = 200 * 1024 * 1024

interface ExifField {
  [key: string]: string
}

interface Risk {
  field: string
  severity: string
  value: string
  recommendation: string
}

interface AnalyzeResult {
  fileName: string
  fileSize: number
  isImage: boolean
  hasExif: boolean
  totalFields: number
  fields: ExifField
  categories: Record<string, ExifField>
  gpsCoordinates: { latitude: number; longitude: number } | null
  riskLevel: string
  risks: Risk[]
  recommendations: string[]
  timestamp: string
}

interface CleanResult {
  fileName: string
  cleaned: boolean
  removedCategories: string[]
  removedFieldsCount: number
  originalSize: number
  cleanedSize: number
  sizeReduction: number
  cleanedFilePath: string
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
    high: { variant: "destructive", label: "HIGH" },
    medium: { variant: "warning", label: "MEDIUM" },
    low: { variant: "success", label: "LOW" },
    none: { variant: "default", label: "NONE" },
  }
  const m = map[level] || map.none
  return <Badge variant={m.variant}>{m.label}</Badge>
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "high": return <AlertTriangle className="h-4 w-4 text-destructive" />
    case "medium": return <Info className="h-4 w-4 text-amber-500" />
    default: return <Info className="h-4 w-4 text-muted-foreground" />
  }
}

export default function MetadataPrivacyPage() {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [cleanResult, setCleanResult] = useState<CleanResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [activeTab, setActiveTab] = useState("analyze")
  const [searchFilter, setSearchFilter] = useState("")
  const [copiedCoords, setCopiedCoords] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const clearAll = useCallback(() => {
    setFile(null)
    setAnalyzeResult(null)
    setCleanResult(null)
    setActiveTab("analyze")
    setSearchFilter("")
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  const handleFile = useCallback((f: File) => {
    if (f.size > MAX_FILE_SIZE) { toast.error(`File too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Max: 200MB`); return }
    setFile(f)
    setAnalyzeResult(null)
    setCleanResult(null)
  }, [])

  const runAnalyze = async () => {
    if (!file) { toast.error("Drop or select a file first"); return }
    setAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const data: any = await api.upload("/metadata/analyze", formData)
      setAnalyzeResult(data as AnalyzeResult)
      setActiveTab("results")
      toast.success("Metadata analysis complete")
    } catch (e: any) {
      toast.error(e?.message || "Analysis failed")
    } finally {
      setAnalyzing(false)
    }
  }

  const runClean = async () => {
    if (!file) { toast.error("Drop or select a file first"); return }
    setCleaning(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const data: any = await api.upload("/metadata/clean", formData)
      setCleanResult(data as CleanResult)
      setActiveTab("clean")
      toast.success("Metadata stripped successfully")
    } catch (e: any) {
      toast.error(e?.message || "Cleaning failed")
    } finally {
      setCleaning(false)
    }
  }

  const downloadCleaned = async () => {
    if (!cleanResult) return
    const filename = cleanResult.cleanedFilePath
    try {
      const blob = await api.download(`/metadata/download/${encodeURIComponent(filename)}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `cleaned-${file?.name || "image.png"}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Cleaned file downloaded")
    } catch {
      toast.error("Download failed")
    }
  }

  const copyGps = (lat: number, lon: number) => {
    navigator.clipboard.writeText(`${lat}, ${lon}`)
    setCopiedCoords(true)
    toast.success("GPS coordinates copied")
    setTimeout(() => setCopiedCoords(false), 2000)
  }

  const filteredFields = useMemo(() => {
    if (!analyzeResult?.fields) return []
    const q = searchFilter.toLowerCase().trim()
    const entries = Object.entries(analyzeResult.fields)
    if (!q) return entries
    return entries.filter(([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q))
  }, [analyzeResult, searchFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metadata Privacy & EXIF Stripper"
        description="Analyze and remove hidden EXIF, GPS, camera, device, and software metadata from image files"
        action={{ label: "Reset / Clear", icon: RotateCcw, onClick: clearAll }}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="analyze"><Upload className="h-4 w-4 mr-2" />Upload</TabsTrigger>
          <TabsTrigger value="results"><Search className="h-4 w-4 mr-2" />Results</TabsTrigger>
          <TabsTrigger value="clean"><Trash2 className="h-4 w-4 mr-2" />Clean</TabsTrigger>
        </TabsList>

        <TabsContent value="analyze">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader><CardTitle>Upload File for Metadata Inspection</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div
                  className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragOver ? "border-cyber-500 bg-cyber-500/10 shadow-lg shadow-cyber-500/10" : "border-border hover:border-cyber-500/50 bg-background/20"
                  }`}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                  />
                  <ImageIcon className="h-10 w-10 text-cyber-400 mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">Drop image or file here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">JPEG, PNG, TIFF, WebP, GIF, BMP (max 200MB)</p>
                </div>

                {/* Hero Preview */}
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
                        <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                      </div>
                      <button onClick={() => { setFile(null); setAnalyzeResult(null); setCleanResult(null) }} className="text-muted-foreground hover:text-foreground">
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {(analyzing || cleaning) ? (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-xs text-cyber-400">
                          <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {analyzing ? "Reading EXIF tags..." : "Stripping metadata tags..."}</span>
                        </div>
                        <Progress value={analyzing ? 65 : 85} className="h-2" />
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="cyber" className="flex-1 h-11" onClick={runAnalyze} disabled={analyzing}>
                          <Search className="mr-2 h-4 w-4" /> Analyze Metadata
                        </Button>
                        <Button variant="destructive" className="flex-1 h-11" onClick={runClean} disabled={cleaning}>
                          <Trash2 className="mr-2 h-4 w-4" /> Strip Metadata
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle>What Gets Exposed</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { icon: MapPin, name: "GPS Coordinates", desc: "Latitude & longitude where photo was captured", risk: "high" },
                  { icon: Camera, name: "Camera & Lens Info", desc: "Make, model, serial number, focal length, ISO", risk: "medium" },
                  { icon: Monitor, name: "Software Identifier", desc: "Editing software used (Photoshop, Lightroom, etc.)", risk: "low" },
                  { icon: FileText, name: "Author & Copyright", desc: "Creator name, copyright holder, comments", risk: "low" },
                  { icon: ImageIcon, name: "Embedded Thumbnails", desc: "Old preview images that may reveal unedited content", risk: "medium" },
                  { icon: Clock, name: "Timestamps", desc: "Exact date and time photo was captured", risk: "low" },
                ].map(({ icon: Icon, name, desc, risk }) => (
                  <div key={name} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors border border-transparent hover:border-border/40">
                    <Icon className="h-5 w-5 text-cyber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium">{name}</p>
                        <Badge variant={risk === "high" ? "destructive" : risk === "medium" ? "warning" : "success"} className="text-[9px] px-1.5 py-0">
                          {risk.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="results">
          {analyzeResult ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <RiskBadge level={analyzeResult.riskLevel} />
                    </div>
                    <p className="text-2xl font-bold capitalize">{analyzeResult.riskLevel}</p>
                    <p className="text-xs text-muted-foreground">Privacy Risk Level</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <Badge variant={analyzeResult.hasExif ? "warning" : "success"}>
                        {analyzeResult.hasExif ? "FOUND" : "CLEAN"}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">{analyzeResult.totalFields}</p>
                    <p className="text-xs text-muted-foreground">EXIF Fields Found</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Camera className="h-5 w-5 text-muted-foreground" />
                      <Badge variant={analyzeResult.categories?.Camera ? "warning" : "success"}>
                        {analyzeResult.categories?.Camera ? "FOUND" : "NONE"}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">{Object.keys(analyzeResult.categories?.Camera || {}).length}</p>
                    <p className="text-xs text-muted-foreground">Camera Fields</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <Badge variant={analyzeResult.gpsCoordinates ? "destructive" : "success"}>
                        {analyzeResult.gpsCoordinates ? "FOUND" : "NONE"}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">{analyzeResult.gpsCoordinates ? "YES" : "NO"}</p>
                    <p className="text-xs text-muted-foreground">GPS Location</p>
                  </CardContent>
                </Card>
              </div>

              {analyzeResult.risks.length > 0 && (
                <Card className="glass-card border-destructive/20">
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5 text-destructive" /> Privacy Risks Detected</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {analyzeResult.risks.map((risk, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-destructive/5 border border-destructive/15">
                        <div className="flex items-start gap-3">
                          <SeverityIcon severity={risk.severity} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-bold">{risk.field}</p>
                              <RiskBadge level={risk.severity} />
                            </div>
                            {risk.value && (
                              <p className="text-xs text-muted-foreground mb-1 font-mono truncate">{risk.value}</p>
                            )}
                            <p className="text-xs text-amber-400">{risk.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                {analyzeResult.gpsCoordinates && (
                  <Card className="glass-card border-destructive/30">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-5 w-5 text-destructive" /> GPS Coordinates Detected</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-4 rounded-xl bg-muted/30 border border-border/40 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Latitude</span>
                          <span className="font-mono font-bold text-foreground">{analyzeResult.gpsCoordinates.latitude}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Longitude</span>
                          <span className="font-mono font-bold text-foreground">{analyzeResult.gpsCoordinates.longitude}</span>
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                          <Button size="sm" variant="outline" className="text-xs h-8 gap-1.5"
                            onClick={() => copyGps(analyzeResult.gpsCoordinates!.latitude, analyzeResult.gpsCoordinates!.longitude)}>
                            {copiedCoords ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedCoords ? "Copied" : "Copy Coordinates"}
                          </Button>
                          <a
                            href={`https://www.google.com/maps?q=${analyzeResult.gpsCoordinates.latitude},${analyzeResult.gpsCoordinates.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-cyber-400 hover:underline ml-auto"
                          >
                            Google Maps <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {Object.keys(analyzeResult.categories).length > 0 && (
                  <Card className="glass-card">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Layers className="h-5 w-5 text-cyber-400" /> Metadata Categories</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(analyzeResult.categories).map(([category, fields]) => (
                        <div key={category}>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{category} ({Object.keys(fields).length})</p>
                          <div className="space-y-1">
                            {Object.entries(fields).slice(0, 8).map(([key, val]) => (
                              <div key={key} className="flex justify-between items-center p-2 rounded-lg bg-muted/30 text-xs">
                                <span className="text-muted-foreground truncate mr-2">{key}</span>
                                <span className="font-mono truncate max-w-[200px] text-right font-medium text-foreground">{val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {Object.keys(analyzeResult.fields).length > 0 && (
                  <Card className="glass-card lg:col-span-2">
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <FileText className="h-5 w-5 text-cyber-400" /> All EXIF Fields ({filteredFields.length} of {analyzeResult.totalFields})
                        </CardTitle>
                        <div className="relative w-48">
                          <Input
                            placeholder="Filter EXIF tags..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="h-8 text-xs pr-7 bg-muted/30"
                          />
                          {searchFilter && (
                            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setSearchFilter("")}>
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-80 overflow-y-auto space-y-1 divide-y divide-border/20">
                        {filteredFields.map(([key, val]) => (
                          <div key={key} className="flex justify-between items-center py-1.5 px-2 rounded hover:bg-muted/30 text-xs">
                            <span className="text-muted-foreground font-medium min-w-[200px]">{key}</span>
                            <span className="font-mono truncate max-w-[400px] text-right text-foreground">{val}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-12 text-center text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Upload and analyze a file to see metadata results</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clean">
          {cleanResult ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Trash2 className="h-5 w-5 text-muted-foreground" />
                      <Badge variant={cleanResult.cleaned ? "success" : "default"}>
                        {cleanResult.cleaned ? "CLEANED" : "NONE"}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">{cleanResult.removedFieldsCount}</p>
                    <p className="text-xs text-muted-foreground">Fields Removed</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Layers className="h-5 w-5 text-muted-foreground" />
                      <Badge variant="outline">{cleanResult.removedCategories.length}</Badge>
                    </div>
                    <p className="text-2xl font-bold">{cleanResult.removedCategories.length}</p>
                    <p className="text-xs text-muted-foreground">Categories Cleaned</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <File className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold">{formatSize(cleanResult.originalSize)}</p>
                    <p className="text-xs text-muted-foreground">Original Size</p>
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <File className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-2xl font-bold">{formatSize(cleanResult.cleanedSize)}</p>
                    <p className="text-xs text-muted-foreground">Cleaned Size ({cleanResult.sizeReduction > 0 ? `-${formatSize(cleanResult.sizeReduction)}` : "no change"})</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="glass-card border-success/30 bg-success/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-success">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    Metadata Stripped Successfully
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cleanResult.removedCategories.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Removed Categories:</p>
                      <div className="flex flex-wrap gap-2">
                        {cleanResult.removedCategories.map((cat) => (
                          <Badge key={cat} variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                            <X className="h-3 w-3 mr-1" /> {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button variant="cyber" className="h-11 px-6" onClick={downloadCleaned}>
                    <Download className="mr-2 h-4 w-4" /> Download Cleaned File
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-12 text-center text-muted-foreground">
                <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-50 text-cyber-400" />
                <p className="text-sm mb-4">Upload an image file to strip EXIF & GPS metadata tags</p>
                <Button variant="cyber" onClick={() => setActiveTab("analyze")}>
                  <Upload className="mr-2 h-4 w-4" /> Upload File to Clean
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
