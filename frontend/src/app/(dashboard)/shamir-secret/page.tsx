"use client"

import { useState, useCallback, useMemo } from "react"
import {
  Puzzle, Download, RefreshCw, Copy, Check, Lock,
  AlertCircle, Shield, Info,
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

  const shareCount = recoverInput.split("\n").filter(Boolean).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shamir Secret Sharing"
        description="Split encryption keys into shares for secure distributed recovery"
      />

      <Tabs defaultValue="split" className="space-y-6">
        <TabsList>
          <TabsTrigger value="split">Split Secret</TabsTrigger>
          <TabsTrigger value="recover">Recover Secret</TabsTrigger>
        </TabsList>

        <TabsContent value="split">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader><CardTitle>Secret to Split</CardTitle></CardHeader>
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
                    <label className="text-sm font-medium mb-1.5 block">Total Shares</label>
                    <Input
                      type="number" min={2} max={100}
                      value={parts}
                      onChange={(e) => setParts(Math.min(100, Math.max(2, Number(e.target.value) || 2)))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Threshold</label>
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
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={downloadShares}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Download All
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
              <CardHeader><CardTitle>Recovered Secret</CardTitle></CardHeader>
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
    </div>
  )
}


