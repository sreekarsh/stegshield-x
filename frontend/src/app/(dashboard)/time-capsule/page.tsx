"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Clock, Lock, Unlock, Trash2, Calendar, RefreshCw, Plus, Eye,
  AlertCircle, Shield, Timer, CheckCircle, Loader2, X,
  Hourglass, KeyRound, BookOpen, Key,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/layout/empty-state"
import { TableSkeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { api, ApiError } from "@/lib/api"
import { encryptTimeCapsule, decryptTimeCapsule } from "@/lib/crypto"
import toast from "react-hot-toast"

interface Capsule {
  id: string
  title: string
  unlockDate: string
  isOpened: boolean
  createdAt: string
  openedAt?: string | null
  encryptedData?: string
}

export default function TimeCapsulePage() {
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [capsules, setCapsules] = useState<Capsule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [secretData, setSecretData] = useState("")
  const [passphrase, setPassphrase] = useState("")
  const [unlockDate, setUnlockDate] = useState("")
  const [creating, setCreating] = useState(false)

  const [opening, setOpening] = useState<string | null>(null)
  const [openedCapsule, setOpenedCapsule] = useState<Capsule | null>(null)
  const [openPassphrase, setOpenPassphrase] = useState("")
  const [decrypting, setDecrypting] = useState(false)
  const [decryptedData, setDecryptedData] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Capsule | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [now, setNow] = useState(() => Date.now())

  const updateNow = useCallback(() => {
    setNow(Date.now())
  }, [])

  useEffect(() => {
    const nextUnlock = capsules
      .filter(c => !c.isOpened)
      .map(c => new Date(c.unlockDate).getTime())
      .filter(t => t > Date.now())
      .sort((a, b) => a - b)[0]

    const interval = nextUnlock
      ? Math.min(60000, Math.max(1000, nextUnlock - Date.now() - 60000))
      : 60000

    clearInterval(intervalRef.current!)
    intervalRef.current = setInterval(updateNow, interval)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [capsules, updateNow])

  const fetchCapsules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ capsules: Capsule[]; total: number }>("/time-capsule")
      setCapsules(data.capsules)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load capsules")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCapsules() }, [fetchCapsules])

  const handleCreate = async () => {
    if (!title.trim()) { toast.error("Enter a title"); return }
    if (!secretData.trim()) { toast.error("Enter secret data"); return }
    if (!unlockDate) { toast.error("Select an unlock date"); return }
    const unlock = new Date(unlockDate)
    if (unlock <= new Date()) { toast.error("Unlock date must be in the future"); return }
    setCreating(true)
    try {
      let encryptedPayload: string
      let useClientEncryption = false
      if (passphrase.trim()) {
        encryptedPayload = await encryptTimeCapsule(secretData.trim(), passphrase)
        useClientEncryption = true
      } else {
        encryptedPayload = secretData.trim()
      }
      const capsule = await api.post<Capsule>("/time-capsule", {
        title: title.trim(),
        encryptedData: encryptedPayload,
        unlockDate: unlock.toISOString(),
        useClientEncryption,
      })
      setCapsules(prev => [capsule, ...prev])
      setTitle(""); setSecretData(""); setPassphrase(""); setUnlockDate(""); setHasUnsaved(false)
      setShowCreateForm(false)
      toast.success("Time capsule sealed successfully!")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to create capsule")
    } finally {
      setCreating(false)
    }
  }

  const tryDecrypt = async () => {
    if (!openPassphrase.trim() || !openedCapsule?.encryptedData) return
    setDecrypting(true)
    try {
      const data = await decryptTimeCapsule(openedCapsule.encryptedData, openPassphrase)
      setDecryptedData(data)
      setOpenPassphrase("")
    } catch {
      toast.error("Incorrect passphrase or corrupted data")
    } finally {
      setDecrypting(false)
    }
  }

  const handleOpen = async (id: string) => {
    setOpening(id)
    setDecryptedData(null)
    setOpenPassphrase("")
    try {
      const capsule = await api.get<Capsule>(`/time-capsule/${id}`)
      setOpenedCapsule(capsule)
      setCapsules(prev => prev.map(c => c.id === id ? { ...c, isOpened: true, openedAt: capsule.openedAt } : c))
      if (!capsule.encryptedData?.startsWith("VA==") && capsule.encryptedData?.length! > 50) {
        setDecryptedData(null)
      } else {
        setDecryptedData(capsule.encryptedData || null)
      }
      toast.success("Capsule opened!")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Cannot open capsule yet")
    } finally {
      setOpening(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/time-capsule/${deleteTarget.id}`)
      setCapsules(prev => prev.filter(c => c.id !== deleteTarget.id))
      if (openedCapsule?.id === deleteTarget.id) { setOpenedCapsule(null); setDecryptedData(null) }
      toast.success("Capsule deleted")
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  const handleCloseForm = () => {
    if (hasUnsaved) { setConfirmClose(true) } else { setShowCreateForm(false) }
  }

  const forceCloseForm = () => {
    setTitle(""); setSecretData(""); setPassphrase(""); setUnlockDate(""); setHasUnsaved(false)
    setShowCreateForm(false); setConfirmClose(false)
  }

  useEffect(() => {
    setHasUnsaved(!!title || !!secretData || !!passphrase || !!unlockDate)
  }, [title, secretData, passphrase, unlockDate])

  const { locked, unlockable } = useMemo(() => {
    const lockedCapsules = capsules.filter(c => !c.isOpened && new Date(c.unlockDate).getTime() > now)
    const unlockableCapsules = capsules.filter(c => !c.isOpened && new Date(c.unlockDate).getTime() <= now)
    return { locked: lockedCapsules.length, unlockable: unlockableCapsules.length }
  }, [capsules, now])

  const formatTimeRemaining = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - now
    if (diff <= 0) return "Ready to open"
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    if (days > 0) return `${days}d ${hours}h remaining`
    const mins = Math.floor((diff % 3600000) / 60000)
    const secs = Math.floor((diff % 60000) / 1000)
    if (hours === 0 && days === 0) {
      if (mins > 0) return `${mins}m ${secs}s remaining`
      return `${secs}s remaining`
    }
    return `${hours}h ${mins}m remaining`
  }

  const getProgress = (createdAt: string, unlockDate: string) => {
    const created = new Date(createdAt).getTime()
    const unlock = new Date(unlockDate).getTime()
    if (now >= unlock) return 100
    if (now <= created) return 0
    const duration = unlock - created
    const elapsed = now - created
    return Math.min(100, Math.max(0, Math.round((elapsed / duration) * 100)))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Time Capsule" description="Encrypt data that can only be unlocked after a specific date" />
        <TableSkeleton rows={5} cols={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Time Capsule" description="Encrypt data that can only be unlocked after a specific date" />
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-10 w-10 text-destructive mb-4" />
            <p className="text-lg font-semibold mb-2">Failed to load capsules</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="cyber" onClick={fetchCapsules}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Time Capsule</h1>
          <p className="text-sm text-muted-foreground">Encrypt data that can only be unlocked after a specific date</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="cyber" size="sm" onClick={() => setShowGuideModal(true)}>
            <BookOpen className="mr-2 h-4 w-4" /> Time Capsule Guide
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="mr-2 h-4 w-4 text-cyber-400" /> New Capsule
          </Button>
        </div>
      </div>

      {capsules.length > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <Clock className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
              <div className="text-xl font-bold">{capsules.length}</div>
              <p className="text-xs text-muted-foreground">Total Capsules</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <Lock className="h-6 w-6 text-warning mx-auto mb-1" />
              <div className="text-xl font-bold">{locked}</div>
              <p className="text-xs text-muted-foreground">Locked</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <Unlock className="h-6 w-6 text-success mx-auto mb-1" />
              <div className="text-xl font-bold">{unlockable}</div>
              <p className="text-xs text-muted-foreground">Ready to Open</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <CheckCircle className="h-6 w-6 text-cyber-400 mx-auto mb-1" />
              <div className="text-xl font-bold">{capsules.filter(c => c.isOpened).length}</div>
              <p className="text-xs text-muted-foreground">Opened</p>
            </CardContent>
          </Card>
        </div>
      )}

      {showCreateForm && (
        <Card className="glass-card border-cyber-500/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Create Time Capsule</CardTitle>
              <Button variant="ghost" size="icon" onClick={handleCloseForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>Seal a message that can only be unlocked after a future date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Title</label>
              <Input
                placeholder="Message to your future self..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Secret Data</label>
              <textarea
                className="w-full min-h-[100px] rounded-lg border border-input bg-background p-3 text-sm resize-y"
                placeholder="Enter the message, files, or data to encrypt..."
                value={secretData}
                onChange={(e) => setSecretData(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-cyber-400" />
                Encryption Passphrase <span className="text-xs text-muted-foreground font-normal">(optional — enables zero-knowledge encryption)</span>
              </label>
              <Input
                type="password"
                placeholder="A passphrase only you know..."
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
              {passphrase.trim() && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Shield className="h-3 w-3 text-cyber-400" />
                  Your data will be encrypted in the browser before sending. The server cannot read it without your passphrase.
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Unlock Date & Time</label>
              <Input
                type="datetime-local"
                value={unlockDate}
                onChange={(e) => setUnlockDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              {unlockDate && (
                <p className="text-xs text-muted-foreground mt-1">
                  <Timer className="h-3 w-3 inline mr-1" />
                  {formatTimeRemaining(new Date(unlockDate).toISOString())}
                </p>
              )}
            </div>
            <Button variant="cyber" className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              {creating ? "Sealing..." : "Seal Time Capsule"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Sealed Capsules ({capsules.length})</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchCapsules}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {capsules.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No time capsules yet"
                  description="Create your first time capsule to encrypt a message for the future."
                  action={{ label: "Create Capsule", onClick: () => setShowCreateForm(true) }}
                />
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {capsules.map((c) => {
                    const canUnlock = new Date(c.unlockDate).getTime() <= now
                    const progress = getProgress(c.createdAt, c.unlockDate)
                    return (
                      <div
                        key={c.id}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                          c.isOpened ? "bg-muted/20" : "bg-muted/30 hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            c.isOpened ? "bg-success/10" : canUnlock ? "bg-cyber-500/10" : "bg-muted"
                          }`}>
                            {c.isOpened ? (
                              <CheckCircle className="h-4 w-4 text-success" />
                            ) : canUnlock ? (
                              <Unlock className="h-4 w-4 text-cyber-400" />
                            ) : (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">{c.title}</p>
                              {c.isOpened && <Badge variant="success" className="text-[10px] h-5">Opened</Badge>}
                              {canUnlock && !c.isOpened && <Badge variant="cyber" className="text-[10px] h-5">Ready</Badge>}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(c.unlockDate).toLocaleDateString()}</span>
                              {c.isOpened && c.openedAt && (
                                <><span className="text-muted-foreground/50">·</span><span>Opened {new Date(c.openedAt).toLocaleDateString()}</span></>
                              )}
                              {!c.isOpened && (
                                <>
                                  <span className="text-muted-foreground/50">·</span>
                                  <span>{canUnlock ? "Unlock available" : formatTimeRemaining(c.unlockDate)}</span>
                                </>
                              )}
                            </div>
                            {!c.isOpened && (
                              <Progress value={progress} className="h-1 mt-1.5 max-w-[200px]" />
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          <Button
                            variant={canUnlock && !c.isOpened ? "cyber" : "outline"}
                            size="sm"
                            className="h-8"
                            disabled={!canUnlock || c.isOpened || opening === c.id}
                            onClick={() => handleOpen(c.id)}
                          >
                            {opening === c.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : c.isOpened ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <Unlock className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Hourglass className="h-5 w-5 text-cyber-400" />
                <CardTitle>Opened Capsule</CardTitle>
              </div>
              <CardDescription>View the contents of an unlocked capsule</CardDescription>
            </CardHeader>
            <CardContent>
              {openedCapsule ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-success" />
                    <span className="font-semibold">{openedCapsule.title}</span>
                    <Badge variant="success" className="text-[10px]">Opened</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Unlocked {new Date(openedCapsule.unlockDate).toLocaleDateString()}
                  </div>

                  {decryptedData ? (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-xs text-muted-foreground mb-1 font-medium">Secret Data:</p>
                      <p className="text-sm font-mono break-all bg-background p-2 rounded select-all">
                        {decryptedData}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        This capsule is encrypted with a passphrase. Enter it to decrypt:
                      </p>
                      <Input
                        type="password"
                        placeholder="Enter your passphrase..."
                        value={openPassphrase}
                        onChange={(e) => setOpenPassphrase(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") tryDecrypt() }}
                      />
                      <Button
                        variant="cyber"
                        className="w-full"
                        onClick={tryDecrypt}
                        disabled={decrypting || !openPassphrase.trim()}
                      >
                        {decrypting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
                        {decrypting ? "Decrypting..." : "Decrypt"}
                      </Button>
                    </div>
                  )}

                  <Button variant="outline" className="w-full" onClick={() => { setOpenedCapsule(null); setDecryptedData(null) }}>
                    Close
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                  <p className="text-sm text-muted-foreground">Open a capsule to view its contents here.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle>About</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Time capsules use AES-256-GCM encryption to protect your data until the designated unlock date.</p>
              <p className="text-xs flex items-start gap-1">
                <Shield className="h-3 w-3 text-cyber-400 shrink-0 mt-0.5" />
                With a passphrase, your data is encrypted in the browser before being sent &mdash; the server never sees the plaintext (zero-knowledge). Without a passphrase, the server encrypts the data at rest using AES-256-GCM. Access is strictly controlled by time-based authorization and user authentication.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={() => setConfirmClose(false)}
        onConfirm={forceCloseForm}
        title="Discard unsaved changes?"
        description="You have unsaved data in the create form. Are you sure you want to close it?"
        confirmLabel="Discard"
        variant="destructive"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Time Capsule"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? Its contents will be permanently lost.`}
        confirmLabel="Delete Capsule"
        variant="destructive"
        loading={deleting}
      />

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-xl border border-cyber-500/30 bg-card p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyber-500/10 text-cyber-400">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Time Capsule Integration Guide</h2>
                  <p className="text-xs text-muted-foreground">Time-locked cryptographic data vault & zero-knowledge security</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowGuideModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <p className="font-semibold text-xs text-cyber-400 mb-1">⏳ What is a Time Capsule?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A Time Capsule seals sensitive data or credentials so they <strong>cannot be decrypted or accessed until a specific future date and time</strong>. It combines client-side zero-knowledge AES-256-GCM encryption with server-enforced time authorization.
                </p>
              </div>

              <div className="space-y-3 pl-2">
                <div className="space-y-1">
                  <p className="font-semibold text-xs flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyber-500/20 text-[10px] font-bold text-cyber-400">1</span>
                    Creating & Sealing a Capsule
                  </p>
                  <p className="text-xs text-muted-foreground pl-7">
                    Click <strong>New Capsule</strong>. Enter a title, your secret payload, an optional client-side passphrase, and a target <strong>Unlock Date</strong> in the future.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-xs flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyber-500/20 text-[10px] font-bold text-cyber-400">2</span>
                    Time-Lock Protection
                  </p>
                  <p className="text-xs text-muted-foreground pl-7">
                    The capsule displays a live countdown timer. Until the unlock date is reached, the backend blocks decryption requests and data remains cryptographically locked.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-xs flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyber-500/20 text-[10px] font-bold text-cyber-400">3</span>
                    Unlocking & Decrypting
                  </p>
                  <p className="text-xs text-muted-foreground pl-7">
                    Once the target date arrives, click <strong>Open Capsule</strong>. If you configured a client-side passphrase, enter it to decrypt the plaintext locally in your browser.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button variant="cyber" size="sm" onClick={() => setShowGuideModal(false)}>Got It</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
