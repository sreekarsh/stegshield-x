"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import {
  Shield, Plus, Download, Loader2, Clock, User, Fingerprint,
  Search, FileText, Image, FileArchive, File,
  FolderOpen, Database, HardDrive, Calendar,
  Activity, ChevronDown, Eye, Edit3, RotateCcw,
  Trash2, CheckCircle2, AlertTriangle, X, ChevronRight,
  Lock, Unlock, Copy, Check, RefreshCw, Zap, Filter,
  Upload, Package,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/layout/page-header"
import { api, ApiError } from "@/lib/api"
import toast from "react-hot-toast"

interface CustodyEntry {
  id: string
  userName: string
  action: string
  signature: string
  timestamp: string
}

interface EvidenceItem {
  id: string
  name: string
  type: string
  hash: string
  status: string
  caseId: string | null
  size: number
  createdAt: string
  lastAccessedAt: string | null
  lastModifiedAt: string | null
  custody: CustodyEntry[]
}

type SortKey = "name" | "createdAt" | "lastAccessedAt" | "size"
type SortDir = "asc" | "desc"

const STATUS_OPTIONS = ["COLLECTED", "ANALYZING", "VERIFIED", "SUBMITTED", "ARCHIVED"]

const statusConfig: Record<string, { variant: "success" | "warning" | "secondary" | "default" | "destructive"; icon: any; color: string }> = {
  VERIFIED:  { variant: "success",     icon: CheckCircle2, color: "text-green-400" },
  ANALYZING: { variant: "warning",     icon: Loader2,      color: "text-yellow-400" },
  COLLECTED: { variant: "secondary",   icon: Package,      color: "text-blue-400" },
  SUBMITTED: { variant: "default",     icon: Upload,       color: "text-purple-400" },
  ARCHIVED:  { variant: "destructive", icon: Lock,         color: "text-red-400" },
}

const typeIcon: Record<string, any> = {
  "application/pdf":  FileText,
  "image/png":        Image,
  "image/jpeg":       Image,
  "image/gif":        Image,
  "image/webp":       Image,
  "image/bmp":        Image,
  "application/zip":  FileArchive,
  "application/x-rar-compressed": FileArchive,
  pdf:   FileText,
  image: Image,
  archive: FileArchive,
  video:   File,
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i]
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function getTypeIcon(mime: string): any {
  if (typeIcon[mime]) return typeIcon[mime]
  if (mime.includes("pdf")) return FileText
  if (mime.includes("image")) return Image
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("7z")) return FileArchive
  return File
}

function truncateHash(hash: string, len = 16): string {
  // Remove "sha256:" prefix if present
  const raw = hash.startsWith("sha256:") ? hash.slice(7) : hash
  return raw.substring(0, len) + "..."
}

const ACTION_ICONS: Record<string, any> = {
  COLLECTED: Package,
  DOWNLOADED: Download,
  VERIFIED: CheckCircle2,
  ARCHIVED: Lock,
  STATUS_CHANGED: RefreshCw,
  RENAMED: Edit3,
  ACCESSED: Eye,
}

export default function EvidenceVaultPage() {
  const [items, setItems] = useState<EvidenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [caseId, setCaseId] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [sortKey, setSortKey] = useState<SortKey>("createdAt")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [dragOver, setDragOver] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchEvidence = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<{ items: EvidenceItem[] }>("/evidence")
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? (data as any) : []
      setItems(list)
    } catch {
      toast.error("Failed to load evidence vault")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvidence() }, [fetchEvidence])

  const handleUploadClick = () => fileInputRef.current?.click()

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      if (caseId.trim()) formData.append("caseId", caseId.trim())
      await api.upload("/evidence", formData)
      toast.success("Evidence encrypted & logged in custody chain")
      setCaseId("")
      fetchEvidence()
    } catch (err: any) {
      toast.error(err?.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }

  const handleDownload = async (item: EvidenceItem) => {
    try {
      const blob = await api.download(`/evidence/${item.id}/download`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = item.name
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Downloaded & logged in custody chain")
      fetchEvidence()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Download failed")
    }
  }

  const handleStatusChange = async (itemId: string, newStatus: string) => {
    setUpdatingId(itemId)
    try {
      await api.patch(`/evidence/${itemId}/status`, { status: newStatus })
      toast.success(`Status updated to ${newStatus}`)
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: newStatus } : i))
      fetchEvidence()
    } catch {
      toast.error("Status update failed")
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm("Permanently delete this evidence item and its custody chain?")) return
    setDeletingId(itemId)
    try {
      await api.delete(`/evidence/${itemId}`)
      setItems(prev => prev.filter(i => i.id !== itemId))
      if (selectedId === itemId) setSelectedId(null)
      toast.success("Evidence item deleted")
    } catch {
      toast.error("Delete failed")
    } finally {
      setDeletingId(null)
    }
  }

  const handleVerify = async (itemId: string) => {
    setVerifyingId(itemId)
    try {
      const result = await api.post<{ verified: boolean; hash: string; storedHash: string }>(`/evidence/${itemId}/verify`, {})
      if (result.verified) {
        toast.success("Integrity verified — hash matches!")
      } else {
        toast.error("Integrity check FAILED — file may have been tampered")
      }
      fetchEvidence()
    } catch {
      toast.error("Verification failed")
    } finally {
      setVerifyingId(null)
    }
  }

  const startRename = (item: EvidenceItem) => {
    setRenamingId(item.id)
    setRenameValue(item.name)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  const submitRename = async () => {
    const id = renamingId
    const val = renameValue.trim()
    setRenamingId(null)
    if (!id || !val) return
    try {
      await api.patch(`/evidence/${id}`, { name: val })
      toast.success("Evidence renamed")
      setItems(prev => prev.map(i => i.id === id ? { ...i, name: val } : i))
    } catch {
      toast.error("Rename failed")
    }
  }

  const copyHash = (hash: string, id: string) => {
    const raw = hash.startsWith("sha256:") ? hash.slice(7) : hash
    navigator.clipboard.writeText(raw)
    setCopiedHash(id)
    toast.success("Hash copied to clipboard")
    setTimeout(() => setCopiedHash(null), 2000)
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let result = items.filter(i => {
      const matchesSearch = !q || (
        i.name.toLowerCase().includes(q) ||
        (i.caseId && i.caseId.toLowerCase().includes(q)) ||
        i.type.toLowerCase().includes(q) ||
        i.hash.toLowerCase().includes(q)
      )
      const matchesStatus = statusFilter === "ALL" || i.status === statusFilter
      return matchesSearch && matchesStatus
    })

    return [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "createdAt") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      else if (sortKey === "lastAccessedAt") {
        cmp = (a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0) -
              (b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0)
      } else if (sortKey === "size") cmp = a.size - b.size
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [items, search, statusFilter, sortKey, sortDir])

  const stats = useMemo(() => {
    const totalSize = items.reduce((s, i) => s + i.size, 0)
    const cases = new Set(items.filter(i => i.caseId).map(i => i.caseId))
    const byStatus = STATUS_OPTIONS.reduce((acc, s) => {
      acc[s] = items.filter(i => i.status === s).length
      return acc
    }, {} as Record<string, number>)
    return { count: items.length, totalSize, cases: cases.size, byStatus }
  }, [items])

  const selectedItem = selectedId ? items.find(i => i.id === selectedId) : null

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
      />

      <PageHeader
        title="Evidence Vault"
        description="Chain-of-custody proven digital evidence management with AES-256-GCM encryption"
        action={{ label: "Add Evidence", icon: Plus, onClick: handleUploadClick }}
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass-card border-cyber-500/20">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2.5 rounded-xl bg-cyber-500/10 border border-cyber-500/20">
              <Database className="h-5 w-5 text-cyber-400" />
            </div>
            <div>
              <p className="text-2xl font-black">{stats.count}</p>
              <p className="text-xs text-muted-foreground">Evidence Items</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <HardDrive className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-black">{formatSize(stats.totalSize)}</p>
              <p className="text-xs text-muted-foreground">Total Storage</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <FolderOpen className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-black">{stats.cases}</p>
              <p className="text-xs text-muted-foreground">Active Cases</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-black">{stats.byStatus["VERIFIED"] || 0}</p>
              <p className="text-xs text-muted-foreground">Verified Items</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
          dragOver ? "border-cyber-500 bg-cyber-500/10 shadow-lg shadow-cyber-500/10" : "border-border/40 hover:border-cyber-500/30 bg-background/20"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={handleUploadClick}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-3 text-sm text-cyber-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Encrypting & logging to custody chain...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <Upload className="h-6 w-6 text-cyber-400" />
            <div className="text-left">
              <p className="text-sm font-medium">Drop file to add evidence, or click to browse</p>
              <p className="text-xs text-muted-foreground">AES-256-GCM encrypted · SHA-256 hashed · Chain-of-custody logged</p>
            </div>
            {caseId && (
              <Badge variant="outline" className="text-xs border-cyber-500/40 text-cyber-400">
                Case: {caseId}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-9 h-10"
            placeholder="Search by name, case, type, hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Input
          className="h-10 max-w-[180px]"
          placeholder="Case ID (optional)"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
        />
        {/* Status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 gap-2">
              <Filter className="h-3.5 w-3.5" />
              {statusFilter === "ALL" ? "All Status" : statusFilter}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter("ALL")}>
              {statusFilter === "ALL" ? "✓ " : ""}All Status
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map(s => (
              <DropdownMenuItem key={s} onClick={() => setStatusFilter(s)}>
                {statusFilter === s ? "✓ " : ""}{s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Sort buttons */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Sort:</span>
          {(["name", "createdAt", "lastAccessedAt", "size"] as SortKey[]).map((k) => (
            <Button key={k} variant={sortKey === k ? "secondary" : "ghost"} size="sm" onClick={() => toggleSort(k)} className="text-xs h-8 px-2.5">
              {k === "name" ? "Name" : k === "createdAt" ? "Created" : k === "lastAccessedAt" ? "Used" : "Size"}
              {sortKey === k && (sortDir === "asc" ? " ↑" : " ↓")}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="h-10 w-10 p-0 ml-auto" onClick={fetchEvidence} title="Refresh">
          <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">
            <Database className="h-3.5 w-3.5 mr-1.5" />
            All Evidence ({filtered.length})
          </TabsTrigger>
          <TabsTrigger value="chain">
            <Activity className="h-3.5 w-3.5 mr-1.5" />
            Chain of Custody {selectedItem ? `· ${selectedItem.name.substring(0, 20)}...` : ""}
          </TabsTrigger>
        </TabsList>

        {/* ── All Evidence Tab ── */}
        <TabsContent value="all">
          <Card className="glass-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-cyber-400" /> Evidence Items
              </CardTitle>
              <Badge variant="outline" className="text-xs">{filtered.length} of {items.length}</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-cyber-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-16 text-center text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-30 text-cyber-400" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    {search || statusFilter !== "ALL" ? "No items match your filters" : "Evidence vault is empty"}
                  </p>
                  <p className="text-xs">
                    {search || statusFilter !== "ALL" ? "Try adjusting your search or filter" : "Drop a file above or click 'Add Evidence' to get started"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filtered.map((item) => {
                    const TypeIcon = getTypeIcon(item.type)
                    const statusCfg = statusConfig[item.status] || statusConfig.COLLECTED
                    const isSelected = selectedId === item.id
                    return (
                      <div
                        key={item.id}
                        className={`transition-all ${isSelected ? "bg-cyber-500/5" : "hover:bg-muted/20"}`}
                      >
                        {/* Main row */}
                        <div
                          className="flex items-start gap-4 p-4 cursor-pointer"
                          onClick={() => setSelectedId(isSelected ? null : item.id)}
                        >
                          <div className="p-3 rounded-xl bg-cyber-500/10 border border-cyber-500/20 shrink-0">
                            <TypeIcon className="h-5 w-5 text-cyber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {renamingId === item.id ? (
                                <input
                                  ref={renameInputRef}
                                  className="h-7 text-sm font-bold bg-background border border-cyber-500 rounded-lg px-2 max-w-[300px] outline-none"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onBlur={submitRename}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") submitRename()
                                    if (e.key === "Escape") setRenamingId(null)
                                    e.stopPropagation()
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <p
                                  className="text-sm font-bold truncate max-w-[280px] hover:text-cyber-400 transition-colors cursor-pointer"
                                  onDoubleClick={(e) => { e.stopPropagation(); startRename(item) }}
                                  title={`${item.name} — double-click to rename`}
                                >
                                  {item.name}
                                </p>
                              )}
                              <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                                {item.type.split("/").pop() || item.type}
                              </Badge>
                              <Badge variant={statusCfg.variant} className="text-[10px] shrink-0">
                                {item.status}
                              </Badge>
                              {item.caseId && (
                                <Badge variant="secondary" className="text-[10px] shrink-0">
                                  Case: {item.caseId.substring(0, 12)}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3" />{formatSize(item.size)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Created: {new Date(item.createdAt).toLocaleDateString()} · {timeAgo(item.createdAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                Accessed: {item.lastAccessedAt ? `${new Date(item.lastAccessedAt).toLocaleDateString()} · ${timeAgo(item.lastAccessedAt)}` : "Never"}
                              </span>
                              {item.lastModifiedAt && item.lastModifiedAt !== item.createdAt && (
                                <span className="flex items-center gap-1">
                                  <Edit3 className="h-3 w-3" />
                                  Modified: {timeAgo(item.lastModifiedAt)}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                {item.custody.length} custody entries
                              </span>
                            </div>
                            {/* Hash row */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <p className="text-[11px] text-muted-foreground font-mono">
                                sha256:{truncateHash(item.hash)}
                              </p>
                              <button
                                className="text-muted-foreground hover:text-cyber-400 transition-colors"
                                onClick={(e) => { e.stopPropagation(); copyHash(item.hash, item.id) }}
                                title="Copy full SHA-256 hash"
                              >
                                {copiedHash === item.id
                                  ? <Check className="h-3 w-3 text-green-400" />
                                  : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>
                          {/* Action buttons */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => handleDownload(item)}
                              title="Download encrypted evidence"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => { setSelectedId(item.id); setActiveTab("chain") }}
                              title="View chain of custody"
                            >
                              <Activity className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  {updatingId === item.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => startRename(item)}>
                                  <Edit3 className="h-3.5 w-3.5 mr-2" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleVerify(item.id)}
                                  disabled={verifyingId === item.id}
                                >
                                  {verifyingId === item.id
                                    ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                    : <Zap className="h-3.5 w-3.5 mr-2" />}
                                  Verify Integrity
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <p className="text-[10px] text-muted-foreground px-2 py-1 uppercase tracking-wider">Set Status</p>
                                {STATUS_OPTIONS.map((s) => (
                                  <DropdownMenuItem
                                    key={s}
                                    disabled={s === item.status}
                                    onClick={() => handleStatusChange(item.id, s)}
                                    className={s === item.status ? "opacity-50" : ""}
                                  >
                                    {s === item.status ? "✓ " : "  "}{s}
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-400 focus:text-red-400"
                                  onClick={() => handleDelete(item.id)}
                                  disabled={deletingId === item.id}
                                >
                                  {deletingId === item.id
                                    ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5 mr-2" />}
                                  Delete Evidence
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Expanded inline custody */}
                        {isSelected && (
                          <div className="border-t border-border/40 px-4 py-3 bg-muted/10">
                            <div className="flex items-center gap-2 mb-3">
                              <Clock className="h-3.5 w-3.5 text-cyber-400" />
                              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                Custody Timeline ({item.custody.length} entries)
                              </span>
                              <button
                                className="ml-auto text-xs text-cyber-400 hover:underline flex items-center gap-1"
                                onClick={(e) => { e.stopPropagation(); setActiveTab("chain") }}
                              >
                                Full View <ChevronRight className="h-3 w-3" />
                              </button>
                            </div>
                            {item.custody.length === 0 ? (
                              <p className="text-xs text-muted-foreground pl-6">No custody records yet.</p>
                            ) : (
                              <div className="relative pl-6">
                                <div className="absolute left-[7px] top-1 bottom-1 w-0.5 bg-border" />
                                {item.custody.slice(0, 5).map((entry) => {
                                  const ActionIcon = ACTION_ICONS[entry.action] || Activity
                                  return (
                                    <div key={entry.id} className="relative flex gap-3 pb-3 last:pb-0">
                                      <div className="absolute left-[-17px] top-[5px] h-2.5 w-2.5 rounded-full bg-cyber-500 ring-2 ring-background" />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <Badge variant="outline" className="text-[9px] uppercase leading-none px-1.5 py-0.5 flex items-center gap-1">
                                            <ActionIcon className="h-2.5 w-2.5" />
                                            {entry.action}
                                          </Badge>
                                          <span className="text-[11px] text-muted-foreground">{timeAgo(entry.timestamp)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                                          <span className="flex items-center gap-1"><User className="h-2.5 w-2.5" />{entry.userName}</span>
                                          <span title={entry.signature} className="flex items-center gap-1">
                                            <Fingerprint className="h-2.5 w-2.5" />{entry.signature.slice(0, 12)}...
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                                {item.custody.length > 5 && (
                                  <p className="text-[10px] text-muted-foreground pl-2">{item.custody.length - 5} more entries...</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Chain of Custody Tab ── */}
        <TabsContent value="chain">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Item selector */}
            <Card className="glass-card lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Select Evidence</CardTitle>
                <CardDescription className="text-xs">Choose an item to view full chain of custody</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[500px] overflow-y-auto divide-y divide-border/40">
                  {items.map(item => {
                    const TypeIcon = getTypeIcon(item.type)
                    return (
                      <button
                        key={item.id}
                        className={`w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-muted/20 ${selectedId === item.id ? "bg-cyber-500/10 border-l-2 border-cyber-500" : ""}`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        <TypeIcon className="h-4 w-4 text-cyber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.custody.length} custody records</p>
                        </div>
                        <Badge variant={statusConfig[item.status]?.variant || "secondary"} className="text-[9px] shrink-0">
                          {item.status}
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Custody timeline */}
            <Card className="glass-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyber-400" /> Chain of Custody Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedItem ? (
                  <div className="py-16 text-center text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-30 text-cyber-400" />
                    <p className="text-sm font-medium text-foreground mb-1">No evidence selected</p>
                    <p className="text-xs">Select an evidence item from the left panel</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="p-4 rounded-xl border border-border/40 bg-muted/20 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-bold text-sm truncate">{selectedItem.name}</p>
                        <Badge variant={statusConfig[selectedItem.status]?.variant || "secondary"} className="shrink-0">
                          {selectedItem.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatSize(selectedItem.size)}</span>
                        <span>·</span>
                        <span>Created: {new Date(selectedItem.createdAt).toLocaleString()}</span>
                        {selectedItem.lastAccessedAt && <><span>·</span><span>Last used: {new Date(selectedItem.lastAccessedAt).toLocaleString()}</span></>}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-muted-foreground font-mono flex-1 truncate">
                          {selectedItem.hash}
                        </p>
                        <button
                          className="text-muted-foreground hover:text-cyber-400 transition-colors shrink-0"
                          onClick={() => copyHash(selectedItem.hash, selectedItem.id + "_chain")}
                          title="Copy hash"
                        >
                          {copiedHash === selectedItem.id + "_chain"
                            ? <Check className="h-3.5 w-3.5 text-green-400" />
                            : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {selectedItem.custody.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">
                        <Clock className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No custody records yet.</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />
                        {selectedItem.custody.map((entry, idx) => {
                          const ActionIcon = ACTION_ICONS[entry.action] || Activity
                          return (
                            <div key={entry.id} className="relative flex gap-4 pb-6 last:pb-0">
                              <div className="relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyber-500/20 border border-cyber-500/40">
                                <ActionIcon className="h-3 w-3 text-cyber-400" />
                              </div>
                              <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {entry.action}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
                                  {idx === 0 && <Badge variant="success" className="text-[9px]">Latest</Badge>}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1.5"><User className="h-3 w-3" />{entry.userName}</span>
                                  <span className="flex items-center gap-1.5 font-mono" title={`Signature: ${entry.signature}`}>
                                    <Fingerprint className="h-3 w-3 shrink-0" />{entry.signature.slice(0, 20)}...
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
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
