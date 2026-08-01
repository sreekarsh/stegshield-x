"use client"

import { useState, useCallback, useMemo } from "react"
import {
  Puzzle, Download, RefreshCw, Copy, Check, Lock,
  AlertCircle, Shield, Info, BookOpen, X, Key,
  Sparkles, CheckCircle2, XCircle, Zap, ArrowRight, RotateCcw, Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { api, ApiError } from "@/lib/api"
import toast from "react-hot-toast"

export default function ShamirSecretPage() {
  const [activeTab, setActiveTab] = useState("split")
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [secret, setSecret] = useState("")
  const [parts, setParts] = useState(5)
  const [threshold, setThreshold] = useState(3)
  const [shares, setShares] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [recoverInput, setRecoverInput] = useState("")
  const [recoverThreshold, setRecoverThreshold] = useState(3)
  const [recovered, setRecovered] = useState("")
  const [recovering, setRecovering] = useState(false)
  const [recoverError, setRecoverError] = useState<string | null>(null)

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [recoverCopied, setRecoverCopied] = useState(false)

  const validConfig = useMemo(() => {
    if (parts < 2) return "Parts must be at least 2"
    if (threshold < 2) return "Threshold must be at least 2"
    if (threshold > parts) return "Threshold cannot exceed total parts"
    return null
  }, [parts, threshold])

  const handleSplit = useCallback(async () => {
    if (!secret.trim()) { toast.error("Enter a secret to split"); return }
    if (validConfig) { toast.error(validConfig); return }
    setLoading(true)
    setError(null)
    try {
      const result = await api.post<{ shares: string[]; threshold: number; parts: number }>(
        "/shamir/split", { secret, parts, threshold }
      )
      setShares(result.shares)
      toast.success(`Generated ${result.shares.length} shares with ${result.threshold}-of-${result.parts} scheme`)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Split failed"
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [secret, parts, threshold, validConfig])

  const handleRecover = useCallback(async () => {
    const lines = recoverInput.trim().split("\n").filter(Boolean)
    if (lines.length < recoverThreshold) { toast.error(`Need at least ${recoverThreshold} shares`); return }
    setRecovering(true)
    setRecoverError(null)
    try {
      const result = await api.post<{ recovered: boolean; secret: string }>(
        "/shamir/recover", { shares: lines, threshold: recoverThreshold }
      )
      setRecovered(result.secret)
      toast.success("Secret recovered successfully")
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Recovery failed"
      setRecoverError(msg)
      toast.error(msg)
    } finally {
      setRecovering(false)
    }
  }, [recoverInput, recoverThreshold])

  const downloadShares = () => {
    const blob = new Blob([shares.join("\n")], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `shamir-shares-${threshold}-of-${shares.length}.txt`; a.click()
    URL.revokeObjectURL(url)
    toast.success("Shares downloaded")
  }

  const copyShare = async (share: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(share)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  const copyRecovered = async () => {
    try {
      await navigator.clipboard.writeText(recovered)
      setRecoverCopied(true)
      setTimeout(() => setRecoverCopied(false), 2000)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }

  const resetAll = useCallback(() => {
    setSecret("")
    setParts(5)
    setThreshold(3)
    setShares([])
    setError(null)
    setRecoverInput("")
    setRecoverThreshold(3)
    setRecovered("")
    setRecoverError(null)
    setActiveTab("split")
    toast.success("Reset to clean state")
  }, [])

  const runInteractiveDemo = async () => {
    const demoSecret = "StegShield-Master-Vault-Key-2026!#CryptographicSecret"
    setSecret(demoSecret)
    setParts(5)
    setThreshold(3)
    setLoading(true)
    setError(null)
    try {
      const result = await api.post<{ shares: string[]; threshold: number; parts: number }>(
        "/shamir/split", { secret: demoSecret, parts: 5, threshold: 3 }
      )
      setShares(result.shares)
      toast.success("Generated 5 shares with 3-of-5 threshold scheme!")
    } catch {
      toast.error("Demo split failed")
    } finally {
      setLoading(false)
    }
  }

  const copySharesToRecover = (count = 3) => {
    if (shares.length < count) return
    const selected = shares.slice(0, count).join("\n")
    setRecoverInput(selected)
    setRecoverThreshold(threshold)
    setActiveTab("recover")
    toast.success(`Copied ${count} shares to Recover tab! Click "Recover Secret" to decode.`)
  }

  const shareCount = recoverInput.split("\n").filter(Boolean).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shamir Secret Sharing</h1>
          <p className="text-sm text-muted-foreground">Split encryption keys into shares for secure distributed recovery</p>
        </div>
        <div className="flex items-center gap-2">
          {(shares.length > 0 || secret || recoverInput || recovered) && (
            <Button variant="outline" size="sm" className="text-muted-foreground hover:text-red-400" onClick={resetAll}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reset / Clear All
            </Button>
          )}
          <Button variant="cyber" size="sm" onClick={() => setShowGuideModal(true)}>
            <BookOpen className="mr-2 h-4 w-4" /> Shamir Guide
          </Button>
        </div>
      </div>

      {/* Threshold Concept Explanation Banner */}
      <div className="p-4 rounded-xl glass-card border border-cyber-500/30 bg-cyber-500/5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyber-400 shrink-0" />
            <h3 className="text-sm font-bold text-cyber-300">Understanding Threshold (k-of-n) Cryptography</h3>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={runInteractiveDemo}>
            <Zap className="h-3.5 w-3.5 mr-1.5 text-amber-400" /> Run Quick Test Demo
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Threshold (k)</strong> is the <em>minimum number of key shares required</em> to reconstruct your original secret. 
          For example, with <strong>5 Total Shares</strong> and a <strong>Threshold of 3</strong>:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Any <strong>3 or more shares</strong> coming together &rarr; <strong>Restores Secret 100%</strong></span>
          </div>
          <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>Fewer than <strong>3 shares</strong> (e.g. 2 shares) &rarr; <strong>Mathematically Zero Info</strong></span>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="split">1. Split Secret</TabsTrigger>
          <TabsTrigger value="recover">2. Recover Secret</TabsTrigger>
        </TabsList>

        <TabsContent value="split">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Secret to Split</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-cyber-400" onClick={runInteractiveDemo}>
                  <Zap className="h-3.5 w-3.5 mr-1 text-amber-400" /> Demo Sample
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Secret Key / Data</label>
                  <textarea
                    className="w-full min-h-[100px] rounded-lg border border-input bg-background p-3 text-sm font-mono resize-y"
                    placeholder="Paste your secret key, password, or data to split..."
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Total Shares (n)</label>
                    <Input
                      type="number" min={2} max={100}
                      value={parts}
                      onChange={(e) => setParts(Math.min(100, Math.max(2, Number(e.target.value) || 2)))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Threshold (k)</label>
                    <Input
                      type="number" min={2}
                      value={threshold}
                      onChange={(e) => setThreshold(Math.min(parts, Math.max(2, Number(e.target.value) || 2)))}
                    />
                  </div>
                </div>
                {validConfig && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                    <AlertCircle className="h-3 w-3 shrink-0" /> {validConfig}
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                    <AlertCircle className="h-3 w-3 shrink-0" /> {error}
                  </div>
                )}
                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleSplit}
                  disabled={loading || !!validConfig || !secret.trim()}
                >
                  {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Puzzle className="mr-2 h-4 w-4" />}
                  {loading ? "Generating Shares..." : "Generate Shares"}
                </Button>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3" />
                  {threshold}-of-{parts} threshold scheme — any {threshold} shares can recover the secret
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated Shares</CardTitle>
                  {shares.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={downloadShares}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Download All
                      </Button>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-red-400" onClick={resetAll}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
                      </Button>
                    </div>
                  )}
                </div>
                <CardDescription>
                  {shares.length > 0
                    ? `${shares.length} shares · ${threshold}-of-${shares.length} recovery scheme`
                    : "Shares will appear here after generation"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {shares.length > 0 ? (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                    {shares.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-xs font-mono group"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Badge variant="outline" className="shrink-0 text-[10px] h-5 min-w-[2rem] justify-center">
                            #{i + 1}
                          </Badge>
                          <span className="truncate text-muted-foreground">{s}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 ml-2"
                          onClick={() => copyShare(s, i)}
                          title="Copy share"
                        >
                          {copiedIdx === i ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-border">
                      <Button
                        variant="cyber"
                        className="w-full text-xs"
                        onClick={() => copySharesToRecover(threshold)}
                      >
                        <ArrowRight className="h-4 w-4 mr-1.5" /> Transfer {threshold} Shares to Recover Tab &rarr;
                      </Button>
                      <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                        Automatically copies {threshold} required shares to the Recover tab to verify secret reconstruction
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Puzzle className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">Enter a secret, configure shares, and generate to see them here.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recover">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader><CardTitle>Recover Secret</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Paste Shares (one per line)</label>
                  <textarea
                    className="w-full min-h-[140px] rounded-lg border border-input bg-background p-3 text-sm font-mono resize-y"
                    placeholder={`Paste your shares here, one per line...\n\nExample:\nShare-1-abc123...\nShare-2-def456...\nShare-3-ghi789...`}
                    value={recoverInput}
                    onChange={(e) => setRecoverInput(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Threshold</label>
                    <Input
                      type="number" min={2}
                      value={recoverThreshold}
                      onChange={(e) => setRecoverThreshold(Math.max(2, Number(e.target.value) || 2))}
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">{shareCount}</span> share{shareCount !== 1 ? "s" : ""} entered
                      {shareCount >= recoverThreshold && shareCount > 0 && (
                        <Badge variant="success" className="ml-2 text-[10px]">Ready</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {recoverError && (
                  <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-lg">
                    <AlertCircle className="h-3 w-3 shrink-0" /> {recoverError}
                  </div>
                )}
                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleRecover}
                  disabled={recovering || shareCount < recoverThreshold}
                >
                  {recovering ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Puzzle className="mr-2 h-4 w-4" />
                  )}
                  {recovering ? "Recovering..." : "Recover Secret"}
                </Button>
                {shareCount > 0 && shareCount < recoverThreshold && (
                  <p className="text-xs text-muted-foreground text-center">
                    Need {recoverThreshold - shareCount} more share{recoverThreshold - shareCount !== 1 ? "s" : ""}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Recovered Secret</CardTitle>
                {recovered && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-400" onClick={resetAll}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear / Reset
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {recovered ? (
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                      <div className="flex items-center gap-2 text-sm text-success mb-2">
                        <Shield className="h-4 w-4" />
                        <span className="font-medium">Secret recovered successfully!</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {shareCount} shares used with threshold {recoverThreshold}
                      </p>
                      <div className="bg-background p-3 rounded border border-border">
                        <p className="text-sm font-mono break-all select-all">{recovered}</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full" onClick={copyRecovered}>
                      {recoverCopied ? <Check className="mr-2 h-4 w-4 text-success" /> : <Copy className="mr-2 h-4 w-4" />}
                      {recoverCopied ? "Copied" : "Copy to Clipboard"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Lock className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Paste your shares and set the threshold to recover the original secret.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-xl border border-cyber-500/30 bg-card p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyber-500/10 text-cyber-400">
                  <Puzzle className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Shamir Secret Sharing Guide</h2>
                  <p className="text-xs text-muted-foreground">Threshold cryptography for distributed key management</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowGuideModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <p className="font-semibold text-xs text-cyber-400 mb-1">🔐 What is Shamir Secret Sharing?</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Based on Adi Shamir&apos;s threshold scheme, a secret (password, master key, or private payload) is divided into <strong>n total shares</strong>. Reconstructing the secret requires any <strong>k threshold shares</strong>. Having fewer than <em>k</em> shares reveals zero information about the secret.
                </p>
              </div>

              <div className="space-y-3 pl-2">
                <div className="space-y-1">
                  <p className="font-semibold text-xs flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyber-500/20 text-[10px] font-bold text-cyber-400">1</span>
                    Splitting a Secret
                  </p>
                  <p className="text-xs text-muted-foreground pl-7">
                    Enter your secret text, set <strong>Total Shares</strong> (e.g. 5), and set the <strong>Threshold</strong> (e.g. 3). Click <strong>Generate Shares</strong>.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-xs flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyber-500/20 text-[10px] font-bold text-cyber-400">2</span>
                    Distributing Shares
                  </p>
                  <p className="text-xs text-muted-foreground pl-7">
                    Distribute the resulting shares (`share-1`, `share-2`, etc.) to separate trusted trustees, key custodians, or secure geographic locations.
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="font-semibold text-xs flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyber-500/20 text-[10px] font-bold text-cyber-400">3</span>
                    Recovering the Secret
                  </p>
                  <p className="text-xs text-muted-foreground pl-7">
                    Switch to the <strong>Recover Secret</strong> tab, paste any <em>k</em> or more shares (one per line), specify the threshold value, and click <strong>Recover Secret</strong> to restore the original key.
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


