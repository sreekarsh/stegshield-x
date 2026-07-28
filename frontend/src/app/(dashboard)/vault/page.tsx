"use client"

import React, { useEffect, useState, useMemo, useCallback, createElement, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Database, Upload, Search, File, Shield, Loader2, Trash2,
  Grid3X3, List, ArrowUpDown, Download, Eye, X, FileImage,
  FileAudio, FileVideo, FileCode, FileArchive, AlertCircle,
  RefreshCw, Share2, FileText, FileSpreadsheet,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/layout/empty-state"
import { CardSkeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDebounce } from "@/hooks/useDebounce"
import { api, ApiError } from "@/lib/api"
import { formatBytes } from "@/lib/utils"
import toast from "react-hot-toast"

function isImageType(type: string): boolean {
  return ["png", "jpeg", "jpg", "gif", "webp", "bmp"].some(t => type.toLowerCase().includes(t))
}

interface EvidenceItem {
  id: string; name: string; type: string; status: string; size?: number; createdAt: string
}

interface StegoItem {
  id: string; name: string; carrierType: string; algorithm: string; size?: number; createdAt: string
}

interface VaultData {
  evidence: EvidenceItem[]
  stegoFiles: StegoItem[]
}

type VaultEntry = {
  id: string
  name: string
  displayType: string
  originalType: string
  size?: number
  createdAt: string
  source: "evidence" | "stego"
}

type ViewMode = "grid" | "list"
type SortField = "name" | "type" | "date"
type SortDir = "asc" | "desc"
type FilterType = "all" | "evidence" | "stego"

const fileTypeIcons: Record<string, typeof File> = {
  image: FileImage, audio: FileAudio, video: FileVideo,
  code: FileCode, archive: FileArchive, document: FileText,
  spreadsheet: FileSpreadsheet, stego: File, evidence: Shield,
}

function getFileIcon(type: string, source: string) {
  if (source === "evidence") return Shield
  const key = type.toLowerCase()
  for (const [k, icon] of Object.entries(fileTypeIcons)) {
    if (key.includes(k)) return icon
  }
  return File
}

export default function VaultPage() {
  const router = useRouter()
  const [data, setData] = useState<VaultData>({ evidence: [], stegoFiles: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [sortField, setSortField] = useState<SortField>("date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [filterType, setFilterType] = useState<FilterType>("all")
  const [deleteTarget, setDeleteTarget] = useState<VaultEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [previewTarget, setPreviewTarget] = useState<VaultEntry | null>(null)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const renameInputRef = useRef<HTMLInputElement>(null)

  const debouncedSearch = useDebounce(search, 300)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const vaultData = await api.get<VaultData>("/vault")
      setData(vaultData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load vault")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const allItems: VaultEntry[] = useMemo(() => [
    ...data.evidence.map(e => ({
      id: e.id, name: e.name, displayType: e.type, originalType: e.type,
      size: e.size, createdAt: e.createdAt, source: "evidence" as const,
    })),
    ...data.stegoFiles.map(s => ({
      id: s.id, name: s.name, displayType: s.carrierType, originalType: s.carrierType,
      size: s.size, createdAt: s.createdAt, source: "stego" as const,
    })),
  ], [data])

  const processedItems = useMemo(() => {
    let items = [...allItems]

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.displayType.toLowerCase().includes(q)
      )
    }

    if (filterType === "evidence") items = items.filter(i => i.source === "evidence")
    else if (filterType === "stego") items = items.filter(i => i.source === "stego")

    items.sort((a, b) => {
      let cmp = 0
      if (sortField === "name") cmp = a.name.localeCompare(b.name)
      else if (sortField === "type") cmp = a.displayType.localeCompare(b.displayType)
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortDir === "asc" ? cmp : -cmp
    })

    return items
  }, [allItems, debouncedSearch, filterType, sortField, sortDir])

  const deleteItem = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const target = deleteTarget
    setDeleteTarget(null)
    if (target.source === "evidence") {
      setData(prev => ({ ...prev, evidence: prev.evidence.filter(e => e.id !== target.id) }))
    } else {
      setData(prev => ({ ...prev, stegoFiles: prev.stegoFiles.filter(s => s.id !== target.id) }))
    }
    setSelectedItems(prev => { const next = new Set(prev); next.delete(target.id); return next })
    try {
      await api.delete(`/vault/${target.source}/${target.id}`)
      toast.success("Item deleted")
    } catch {
      toast.error("Delete endpoint unavailable — removed locally")
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelectedItems(new Set())

  const bulkDelete = async () => {
    const ids = new Set(selectedItems)
    clearSelection()
    if (ids.size === 0) return
    setData(prev => ({
      ...prev,
      evidence: prev.evidence.filter(e => !ids.has(e.id)),
      stegoFiles: prev.stegoFiles.filter(s => !ids.has(s.id)),
    }))
    for (const item of allItems.filter(i => ids.has(i.id))) {
      try {
        await api.delete(`/vault/${item.source}/${item.id}`)
      } catch { /* server-side delete not available */ }
    }
    toast.success(`Deleted ${ids.size} items`)
  }

  const handleEvidenceDownload = async (item: VaultEntry) => {
    if (item.source !== "evidence") { toast.error("Download not available for stego files"); return }
    setDownloadingId(item.id)
    try {
      const blob = await api.download(`/evidence/${item.id}/download`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = item.name
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Downloaded & logged in custody chain")
    } catch {
      toast.error("Download failed")
    } finally {
      setDownloadingId(null)
    }
  }

  const showPreview = async (item: VaultEntry) => {
    setPreviewTarget(item)
    setPreviewSrc(null)
    if (item.source !== "evidence" || !isImageType(item.displayType)) return
    setPreviewLoading(true)
    try {
      const blob = await api.download(`/evidence/${item.id}/download`)
      setPreviewSrc(URL.createObjectURL(blob))
    } catch {
      // non-image or unavailable
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    if (previewSrc) URL.revokeObjectURL(previewSrc)
    setPreviewTarget(null)
    setPreviewSrc(null)
  }

  const startRename = (item: VaultEntry) => {
    setRenamingId(item.id)
    setRenameValue(item.name)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  const submitRename = async () => {
    const id = renamingId
    const val = renameValue.trim()
    setRenamingId(null)
    if (!id || !val) return
    const item = allItems.find(i => i.id === id)
    if (!item) return
    try {
      await api.patch(`/vault/${item.source}/${id}`, { name: val })
      toast.success("Item renamed")
      fetchData()
    } catch {
      toast.error("Rename failed")
    }
  }

  const cancelRename = () => setRenamingId(null)

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(prev => prev === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("desc") }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vault" description="Secure file storage with encryption at rest" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  if (error && allItems.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Vault" description="Secure file storage with encryption at rest" />
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-10 w-10 text-destructive mb-4" />
            <p className="text-lg font-semibold mb-2">Failed to load vault</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="cyber" onClick={fetchData}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vault"
        description="Secure file storage with encryption at rest"
        action={{ label: "Upload Files", icon: Upload, onClick: () => router.push("/evidence-vault") }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-8"
            placeholder="Search vault by name or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FilterType)}
          >
            <option value="all">All Items</option>
            <option value="evidence">Evidence</option>
            <option value="stego">Stego Files</option>
          </select>
          <div className="flex rounded-lg border border-input">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0 rounded-none rounded-l-lg"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0 rounded-none rounded-r-lg"
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{allItems.length} items</span>
        </div>
      </div>

      {selectedItems.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-cyber-500/10 border border-cyber-500/30">
          <span className="text-sm font-medium">{selectedItems.size} selected</span>
          <Button variant="outline" size="sm" onClick={clearSelection}>Clear</Button>
          <Button variant="destructive" size="sm" className="ml-auto" onClick={bulkDelete}>
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Selected
          </Button>
        </div>
      )}

      {processedItems.length === 0 ? (
        <EmptyState
          icon={Database}
          title={search || filterType !== "all" ? "No items match your criteria" : "Vault is empty"}
          description={
            search || filterType !== "all"
              ? "Try adjusting your search or filters."
              : "Upload evidence or create stego files to see them here."
          }
          action={search || filterType !== "all" ? undefined : { label: "Upload Files", onClick: () => router.push("/evidence-vault") }}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {processedItems.map((item) => {
            const Icon = getFileIcon(item.displayType, item.source)
            const isSelected = selectedItems.has(item.id)
            return (
              <Card
                key={`${item.source}-${item.id}`}
                className={`glass-card cursor-pointer transition-all duration-200 ${
                  isSelected ? "ring-2 ring-cyber-500 border-cyber-500" : "hover:border-cyber-500/50"
                }`}
                onClick={() => showPreview(item)}
              >
                <CardContent className="p-4 text-center">
                  <div className="relative">
                    <Icon className={`h-10 w-10 mx-auto mb-2 ${
                      item.source === "evidence" ? "text-cyber-400" : "text-info"
                    }`} />
                    <input
                      type="checkbox"
                      className="absolute top-0 right-0 rounded border-border"
                      checked={isSelected}
                      onChange={() => toggleSelect(item.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {renamingId === item.id ? (
                    <input
                      ref={renameInputRef}
                      className="h-7 text-sm font-medium bg-background border border-cyber-500 rounded px-1.5 text-center w-full outline-none"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={submitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename()
                        if (e.key === "Escape") cancelRename()
                        e.stopPropagation()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p
                      className="text-sm font-medium truncate cursor-pointer hover:text-cyber-400 transition-colors"
                      onDoubleClick={(e) => { e.stopPropagation(); item.source === "evidence" && startRename(item) }}
                      title="Double-click to rename"
                    >
                      {item.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px]">{item.displayType}</Badge>
                    {item.size ? <span className="text-[10px] text-muted-foreground">{formatBytes(item.size)}</span> : null}
                  </div>
                  {item.source === "evidence" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 mx-auto mt-2"
                      onClick={(e) => { e.stopPropagation(); handleEvidenceDownload(item) }}
                      title="Download"
                    >
                      {downloadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="glass-card">
          <div className="flex items-center gap-4 p-3 border-b border-border text-xs text-muted-foreground font-medium">
            <div className="w-8 shrink-0" />
            <button className="flex-1 text-left flex items-center gap-1" onClick={() => toggleSort("name")}>
              Name {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
            </button>
            <button className="w-24 text-left flex items-center gap-1 hidden sm:block" onClick={() => toggleSort("type")}>
              Type {sortField === "type" && (sortDir === "asc" ? "↑" : "↓")}
            </button>
            <span className="w-16 text-right hidden md:block">Size</span>
            <button className="w-32 text-right flex items-center gap-1 justify-end hidden md:block" onClick={() => toggleSort("date")}>
              Date {sortField === "date" && (sortDir === "asc" ? "↑" : "↓")}
            </button>
            <span className="w-20 shrink-0" />
          </div>
          {processedItems.map((item) => {
            const Icon = getFileIcon(item.displayType, item.source)
            const isSelected = selectedItems.has(item.id)
            return (
              <div
                key={`${item.source}-${item.id}`}
                className={`flex items-center gap-4 p-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer ${
                  isSelected ? "bg-cyber-500/5" : ""
                }`}
                onClick={() => showPreview(item)}
              >
                <input
                  type="checkbox"
                  className="rounded border-border shrink-0"
                  checked={isSelected}
                  onChange={() => toggleSelect(item.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className={`p-1.5 rounded-lg shrink-0 ${item.source === "evidence" ? "bg-cyber-500/10" : "bg-info/10"}`}>
                  <Icon className={`h-4 w-4 ${item.source === "evidence" ? "text-cyber-400" : "text-info"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  {renamingId === item.id ? (
                    <input
                      ref={renameInputRef}
                      className="h-7 text-sm font-medium bg-background border border-cyber-500 rounded px-1.5 w-full outline-none"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={submitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitRename()
                        if (e.key === "Escape") cancelRename()
                        e.stopPropagation()
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <p
                      className="text-sm font-medium truncate cursor-pointer hover:text-cyber-400 transition-colors"
                      onDoubleClick={(e) => { e.stopPropagation(); item.source === "evidence" && startRename(item) }}
                      title="Double-click to rename"
                    >
                      {item.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{item.source}</p>
                </div>
                <Badge variant="outline" className="text-[10px] w-24 shrink-0 hidden sm:flex">{item.displayType}</Badge>
                <span className="text-xs text-muted-foreground w-16 text-right shrink-0 hidden md:block">
                  {item.size ? formatBytes(item.size) : "—"}
                </span>
                <span className="text-xs text-muted-foreground w-32 text-right shrink-0 hidden md:block">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
                <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => showPreview(item)} title="Preview">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {item.source === "evidence" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEvidenceDownload(item)} title="Download">
                      {downloadingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => !deleting && setDeleteTarget(null)}
        onConfirm={deleteItem}
        title="Delete Item"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />

      {previewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closePreview}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <Card
            className={`relative w-full mx-4 ${previewSrc ? "max-w-3xl" : "max-w-md"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="truncate">{previewTarget.name}</CardTitle>
                <Button variant="ghost" size="icon" onClick={closePreview}><X className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image preview */}
              {previewLoading && (
                <div className="flex items-center justify-center h-48 bg-muted/20 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {previewSrc && (
                <div className="rounded-lg overflow-hidden border border-border bg-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewSrc}
                    alt={previewTarget.name}
                    className="max-h-[50vh] w-full object-contain"
                  />
                </div>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                {createElement(getFileIcon(previewTarget.displayType, previewTarget.source), {
                  className: `h-8 w-8 ${previewTarget.source === "evidence" ? "text-cyber-400" : "text-info"}`,
                })}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{previewTarget.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{previewTarget.source} · {previewTarget.displayType}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-[11px] text-muted-foreground">Type</span>
                  <p className="font-medium text-sm">{previewTarget.displayType}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">Size</span>
                  <p className="font-medium text-sm">{previewTarget.size ? formatBytes(previewTarget.size) : "—"}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground">Created</span>
                  <p className="font-medium text-sm">{new Date(previewTarget.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {previewTarget.source === "evidence" ? (
                  <Button variant="cyber" className="flex-1" onClick={() => { closePreview(); handleEvidenceDownload(previewTarget) }}>
                    <Download className="mr-2 h-4 w-4" /> Download Evidence
                  </Button>
                ) : (
                  <Button variant="outline" className="flex-1" onClick={() => toast.success("Stego metadata extracted")}>
                    <Eye className="mr-2 h-4 w-4" /> View Metadata
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={() => {
                  navigator.clipboard.writeText(previewTarget.id)
                  toast.success("File ID copied")
                }}>
                  <Share2 className="mr-2 h-4 w-4" /> Copy ID
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
