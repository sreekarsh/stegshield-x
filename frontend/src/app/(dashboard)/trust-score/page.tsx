"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Award, Shield, Lock, Eye, FileText, Upload,
  RefreshCw, Loader2, AlertCircle, Search,
  X, UploadCloud, Download, Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/layout/empty-state"
import { DashboardSkeleton } from "@/components/ui/skeleton"
import { useDebounce } from "@/hooks/useDebounce"
import { api, ApiError } from "@/lib/api"
import { formatBytes } from "@/lib/utils"
import toast from "react-hot-toast"

interface TrustScoreData {
  id: string
  fileId: string
  encryptionScore: number
  privacyScore: number
  integrityScore: number
  threatScore: number
  stegoRisk: number
  overallGrade: string
  analyzedAt: string
  fileName?: string
  fileSize?: number
  fileType?: string
}

const gradeColor = (grade: string) => {
  if (grade.startsWith("A")) return "success"
  if (grade.startsWith("B")) return "warning"
  if (grade.startsWith("C")) return "destructive"
  return "destructive" as const
}

export default function TrustScorePage() {
  const [scores, setScores] = useState<TrustScoreData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const debouncedSearch = useDebounce(searchQuery, 300)

  const fetchScores = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<TrustScoreData[]>("/trust")
      setScores(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load trust scores")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchScores() }, [fetchScores])

  const handleFileAnalysis = async (file: File) => {
    setAnalyzing(true)
    try {
      const result = await api.post<TrustScoreData>("/trust/score", {
        fileId: file.name,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || file.name.split(".").pop() || "unknown",
        size: file.size,
        type: file.type || file.name.split(".").pop(),
      })
      const enriched: TrustScoreData = {
        ...result,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || file.name.split(".").pop() || "unknown",
      }
      setScores(prev => [enriched, ...prev.filter(s => s.id !== enriched.id && s.fileId !== enriched.fileId)])
      toast.success(`Trust score for ${file.name}: ${result.overallGrade}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Analysis failed")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`Delete trust score for "${fileName}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      await api.delete(`/trust/${id}`)
      setScores(prev => prev.filter(s => s.id !== id))
      toast.success("Trust score deleted")
    } catch {
      toast.error("Failed to delete trust score")
    } finally {
      setDeletingId(null)
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileAnalysis(file)
  }

  const filteredScores = useMemo(() => {
    if (!debouncedSearch) return scores
    const q = debouncedSearch.toLowerCase()
    return scores.filter(
      s => (s.fileName || s.fileId).toLowerCase().includes(q) ||
           s.overallGrade.toLowerCase().includes(q) ||
           (s.fileType && s.fileType.toLowerCase().includes(q))
    )
  }, [scores, debouncedSearch])

  const stats = useMemo(() => {
    if (scores.length === 0) return null
    const avgEnc = Math.round(scores.reduce((a, s) => a + s.encryptionScore, 0) / scores.length)
    const avgPriv = Math.round(scores.reduce((a, s) => a + s.privacyScore, 0) / scores.length)
    const avgInt = Math.round(scores.reduce((a, s) => a + s.integrityScore, 0) / scores.length)
    const avgThreat = Math.round(scores.reduce((a, s) => a + s.threatScore, 0) / scores.length)
    const avgStego = Math.round(scores.reduce((a, s) => a + s.stegoRisk, 0) / scores.length)
    const overall = Math.round(
      scores.reduce((acc, s) => acc + (s.encryptionScore + s.privacyScore + s.integrityScore + (100 - s.threatScore) + (100 - s.stegoRisk)) / 5, 0) / scores.length
    )
    const grade = overall >= 90 ? "A+" : overall >= 80 ? "A" : overall >= 70 ? "B+" : overall >= 60 ? "B" : overall >= 50 ? "C" : overall >= 35 ? "D" : "F"
    return { avgEnc, avgPriv, avgInt, avgThreat, avgStego, overall, grade }
  }, [scores])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Trust Score" description="Comprehensive security grading for every uploaded file" />
        <DashboardSkeleton />
      </div>
    )
  }

  if (error && scores.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Trust Score" description="Comprehensive security grading for every uploaded file" />
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-10 w-10 text-destructive mb-4" />
            <p className="text-lg font-semibold mb-2">Failed to load trust scores</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="cyber" onClick={fetchScores}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trust Score"
        description="Comprehensive security grading for every uploaded file"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="files">File Analysis ({scores.length})</TabsTrigger>
          </TabsList>
          <Button variant="outline" size="sm" onClick={fetchScores} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <TabsContent value="overview" className="space-y-6">
          {stats ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="glass-card">
                  <CardContent className="p-6 text-center">
                    <Lock className="h-8 w-8 mx-auto mb-3 text-success" />
                    <div className="text-3xl font-bold mb-1">{stats.avgEnc}%</div>
                    <p className="text-sm text-muted-foreground">Encryption</p>
                    <Progress value={stats.avgEnc} className="mt-3 h-1.5" />
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-6 text-center">
                    <Eye className="h-8 w-8 mx-auto mb-3 text-info" />
                    <div className="text-3xl font-bold mb-1">{stats.avgPriv}%</div>
                    <p className="text-sm text-muted-foreground">Privacy</p>
                    <Progress value={stats.avgPriv} className="mt-3 h-1.5" />
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-6 text-center">
                    <Shield className="h-8 w-8 mx-auto mb-3 text-cyber-400" />
                    <div className="text-3xl font-bold mb-1">{stats.avgInt}%</div>
                    <p className="text-sm text-muted-foreground">Integrity</p>
                    <Progress value={stats.avgInt} className="mt-3 h-1.5" />
                  </CardContent>
                </Card>
                <Card className="glass-card">
                  <CardContent className="p-6 text-center">
                    <Award className="h-8 w-8 mx-auto mb-3 text-success" />
                    <div className="text-3xl font-bold mb-1">{stats.grade}</div>
                    <p className="text-sm text-muted-foreground">Overall Grade</p>
                    <Progress value={stats.overall} className="mt-3 h-1.5" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="glass-card">
                  <CardHeader><CardTitle>Risk Assessment</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Threat Score</span>
                        <span className={`font-mono font-medium ${stats.avgThreat > 50 ? "text-destructive" : stats.avgThreat > 30 ? "text-warning" : "text-success"}`}>
                          {stats.avgThreat}%
                        </span>
                      </div>
                      <Progress value={stats.avgThreat} className={`h-2 ${stats.avgThreat > 50 ? "bg-destructive/20 [&>*]:bg-destructive" : stats.avgThreat > 30 ? "bg-warning/20 [&>*]:bg-warning" : ""}`} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Steganography Risk</span>
                        <span className={`font-mono font-medium ${stats.avgStego > 50 ? "text-destructive" : stats.avgStego > 30 ? "text-warning" : "text-success"}`}>
                          {stats.avgStego}%
                        </span>
                      </div>
                      <Progress value={stats.avgStego} className={`h-2 ${stats.avgStego > 50 ? "bg-destructive/20 [&>*]:bg-destructive" : stats.avgStego > 30 ? "bg-warning/20 [&>*]:bg-warning" : ""}`} />
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-sm">
                      <p className="text-xs text-muted-foreground">Files Analyzed</p>
                      <p className="text-lg font-bold mt-1">{scores.length}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader><CardTitle>Analyze New File</CardTitle></CardHeader>
                  <CardContent>
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer hover:border-cyber-500/50 ${
                        analyzing ? "border-cyber-500/50 bg-cyber-500/5" : "border-border"
                      }`}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={handleFileSelect}
                    >
                      {analyzing ? (
                        <div className="space-y-3">
                          <Loader2 className="h-10 w-10 animate-spin text-cyber-400 mx-auto" />
                          <p className="text-sm text-muted-foreground">Analyzing file...</p>
                          <Progress value={45} className="h-1 max-w-[200px] mx-auto" />
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto" />
                          <p className="text-sm font-medium">Drop a file here or click to browse</p>
                          <p className="text-xs text-muted-foreground">Files are analyzed for encryption, privacy, integrity, and threats</p>
                          <Button variant="outline" size="sm">
                            <Upload className="mr-2 h-4 w-4" /> Select File
                          </Button>
                        </div>
                      )}
                    </div>
                    </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <EmptyState
                  icon={Award}
                  title="No files analyzed yet"
                  description="Upload a file to get its comprehensive trust score including encryption, privacy, integrity, and threat analysis."
                  action={{ label: "Analyze a File", onClick: handleFileSelect }}
                />
              </CardContent>
            </Card>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileAnalysis(file)
            }}
          />
        </TabsContent>

        <TabsContent value="files">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 pr-8"
                placeholder="Search analyzed files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="cyber" onClick={handleFileSelect} disabled={analyzing}>
              {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {analyzing ? "Analyzing..." : "Analyze File"}
            </Button>
            <Button variant="outline" onClick={fetchScores} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          {filteredScores.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={debouncedSearch ? "No files match your search" : "No files analyzed yet"}
              description={debouncedSearch ? "Try a different search term." : "Upload and analyze files to see their trust scores."}
              action={debouncedSearch ? undefined : { label: "Analyze a File", onClick: handleFileSelect }}
            />
          ) : (
            <div className="space-y-3">
              {filteredScores.map((s) => (
                <Card key={s.id} className="glass-card hover:border-cyber-500/30 transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{s.fileName || s.fileId}</p>
                          <Badge variant={gradeColor(s.overallGrade)} className="text-[10px] shrink-0">{s.overallGrade}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>{new Date(s.analyzedAt).toLocaleString()}</span>
                          {s.fileSize && <span>· {formatBytes(s.fileSize)}</span>}
                          {s.fileType && <span>· {s.fileType}</span>}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 ml-2" onClick={() => {
                        const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement("a")
                        a.href = url; a.download = `${s.fileName || s.fileId}-trust-score.json`
                        a.click(); URL.revokeObjectURL(url)
                        toast.success("Report downloaded")
                      }}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 ml-2 text-destructive hover:text-destructive" onClick={() => handleDelete(s.id, s.fileName || s.fileId)} disabled={deletingId === s.id}>
                        {deletingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1">Encryption</p>
                        <p className="font-medium">{s.encryptionScore}%</p>
                        <Progress value={s.encryptionScore} className="h-1 mt-1" />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Privacy</p>
                        <p className="font-medium">{s.privacyScore}%</p>
                        <Progress value={s.privacyScore} className="h-1 mt-1" />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Integrity</p>
                        <p className="font-medium">{s.integrityScore}%</p>
                        <Progress value={s.integrityScore} className="h-1 mt-1" />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Threat</p>
                        <p className={`font-medium ${s.threatScore > 50 ? "text-destructive" : ""}`}>{s.threatScore}%</p>
                        <Progress value={100 - s.threatScore} className={`h-1 mt-1 ${s.threatScore > 50 ? "bg-destructive/20 [&>*]:bg-destructive" : ""}`} />
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Stego Risk</p>
                        <p className={`font-medium ${s.stegoRisk > 50 ? "text-destructive" : ""}`}>{s.stegoRisk}%</p>
                        <Progress value={100 - s.stegoRisk} className={`h-1 mt-1 ${s.stegoRisk > 50 ? "bg-destructive/20 [&>*]:bg-destructive" : ""}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
