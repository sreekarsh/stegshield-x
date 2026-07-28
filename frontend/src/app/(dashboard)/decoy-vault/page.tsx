"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Ghost, Shield, Eye, EyeOff, Trash2, CheckCircle, XCircle,
  RefreshCw, AlertCircle, Info, AlertTriangle, Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/layout/page-header"
import { CardSkeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { api, ApiError } from "@/lib/api"
import toast from "react-hot-toast"

interface DecoyStatus {
  configured: boolean
  fakePassword: string | null
  realVaultId: string | null
  fakeVaultId: string | null
  createdAt: string | null
}

interface VerifyResponse {
  valid: boolean
  message: string
  realVaultId?: string
  fakeVaultId?: string | null
}

export default function DecoyVaultPage() {
  const [fakePw, setFakePw] = useState("")
  const [confirmFakePw, setConfirmFakePw] = useState("")
  const [realVaultId, setRealVaultId] = useState("")
  const [fakeVaultId, setFakeVaultId] = useState("")
  const [showFake, setShowFake] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [status, setStatus] = useState<DecoyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const [verifyPw, setVerifyPw] = useState("")
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null)
  const [verifying, setVerifying] = useState(false)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<DecoyStatus>("/decoy/status")
      setStatus(data)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStatus({ configured: false, fakePassword: null, realVaultId: null, fakeVaultId: null, createdAt: null })
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to load status")
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  const handleSetup = async () => {
    if (!fakePw) { toast.error("Enter a decoy password"); return }
    if (fakePw.length < 6) { toast.error("Password must be at least 6 characters"); return }
    if (fakePw !== confirmFakePw) { toast.error("Passwords do not match"); return }
    if (!realVaultId.trim()) { toast.error("Enter the real vault ID"); return }
    setSaving(true)
    try {
      await api.post("/decoy/setup", { fakePassword: fakePw, realVaultId: realVaultId.trim(), fakeVaultId: fakeVaultId.trim() || undefined })
      toast.success("Decoy vault configured successfully")
      setFakePw(""); setConfirmFakePw(""); setRealVaultId(""); setFakeVaultId("")
      fetchStatus()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Setup failed")
    } finally {
      setSaving(false)
    }
  }

  const handleVerify = async () => {
    if (!verifyPw) { toast.error("Enter a password to verify"); return }
    setVerifying(true)
    try {
      const result = await api.post<VerifyResponse>("/decoy/verify", { password: verifyPw })
      setVerifyResult(result)
      if (result.valid) toast.success(result.message)
      else toast.error(result.message)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Verification failed")
    } finally {
      setVerifying(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      await api.delete("/decoy")
      toast.success("Decoy vault removed")
        setStatus({ configured: false, fakePassword: null, realVaultId: null, fakeVaultId: null, createdAt: null })
      setVerifyPw(""); setVerifyResult(null)
      setShowRemoveConfirm(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Remove failed")
    } finally {
      setRemoving(false)
    }
  }

  const passwordsMatch = fakePw === confirmFakePw
  const passwordValid = fakePw.length >= 6

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Decoy Vault" description="Plausible deniability with fake passwords and hidden real vaults" />
        <div className="grid gap-6 lg:grid-cols-2">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Decoy Vault" description="Plausible deniability with fake passwords and hidden real vaults" />
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-10 w-10 text-destructive mb-4" />
            <p className="text-lg font-semibold mb-2">Failed to load status</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="cyber" onClick={fetchStatus}><RefreshCw className="mr-2 h-4 w-4" /> Retry</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Decoy Vault"
        description="Plausible deniability with fake passwords and hidden real vaults"
      />

      <Card className="glass-card border-cyber-500/20 bg-cyber-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Ghost className="h-5 w-5 text-cyber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">What is a Decoy Vault?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A decoy vault presents fake sensitive data when accessed with a decoy password, while your real encrypted data remains hidden behind your actual credentials. This provides plausible deniability under duress.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Decoy Setup</CardTitle>
                <CardDescription>
                  {status?.configured ? "Decoy vault is active and protecting your data" : "Configure your decoy vault protection"}
                </CardDescription>
              </div>
              {status?.configured && (
                <Badge variant="success" className="flex items-center gap-1 shrink-0">
                  <CheckCircle className="h-3 w-3" /> Active
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {status?.configured ? (
              <>
                  <div className="p-3 rounded-lg bg-success/10 border border-success/20">
                    <div className="flex items-center gap-2 text-sm text-success mb-1">
                      <Shield className="h-4 w-4" />
                      <span className="font-medium">Decoy vault is protecting your data</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Configured {status.createdAt ? new Date(status.createdAt).toLocaleDateString() : "recently"}
                      {status.realVaultId && <> · Hiding: <span className="font-mono">{status.realVaultId}</span></>}
                      {status.fakeVaultId && <> · Decoy: <span className="font-mono">{status.fakeVaultId}</span></>}
                    </p>
                  </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <label className="text-sm font-medium block">Verify Decoy Password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="password"
                        placeholder="Enter decoy password to test..."
                        value={verifyPw}
                        onChange={(e) => { setVerifyPw(e.target.value); setVerifyResult(null) }}
                        onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                      />
                    </div>
                    <Button variant="outline" onClick={handleVerify} disabled={verifying}>
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </Button>
                  </div>
                  {verifyResult && (
                    <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
                      verifyResult.valid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>
                      {verifyResult.valid ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                      <div>
                        <span>{verifyResult.message}</span>
                        {verifyResult.valid && verifyResult.fakeVaultId && (
                          <p className="text-xs mt-0.5 opacity-80">Decoy content: {verifyResult.fakeVaultId}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={fetchStatus}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => setShowRemoveConfirm(true)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Decoy Password</label>
                  <div className="relative">
                    <Input
                      type={showFake ? "text" : "password"}
                      placeholder="Fake password for decoy vault"
                      value={fakePw}
                      onChange={(e) => setFakePw(e.target.value)}
                      className={fakePw && !passwordValid ? "border-destructive" : ""}
                    />
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowFake(!showFake)}
                      tabIndex={-1}
                    >
                      {showFake ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fakePw && !passwordValid && (
                    <p className="text-xs text-destructive mt-1">Password must be at least 6 characters</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Confirm Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Confirm decoy password"
                      value={confirmFakePw}
                      onChange={(e) => setConfirmFakePw(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSetup()}
                      className={confirmFakePw && !passwordsMatch ? "border-destructive" : ""}
                    />
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmFakePw && !passwordsMatch && (
                    <p className="text-xs text-destructive mt-1">Passwords do not match</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Real Vault ID</label>
                  <Input
                    placeholder="ID of the real vault to protect"
                    value={realVaultId}
                    onChange={(e) => setRealVaultId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This is the vault that will remain hidden when the decoy password is used
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Decoy Vault ID <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    placeholder="ID of the decoy evidence to show instead"
                    value={fakeVaultId}
                    onChange={(e) => setFakeVaultId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    When the decoy password is used, only this evidence file will be visible. Leave empty to show nothing.
                  </p>
                </div>
                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleSetup}
                  disabled={saving || !passwordValid || !passwordsMatch || !realVaultId.trim()}
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                  {saving ? "Configuring..." : "Configure Decoy Vault"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-cyber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-cyber-400">1</span>
                </div>
                <div>
                  <p className="font-medium">Set Up Decoy Password</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Create a fake password that reveals plausible-looking but fake sensitive data</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-cyber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-cyber-400">2</span>
                </div>
                <div>
                  <p className="font-medium">Hide Your Real Vault</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Link your actual encrypted vault so it stays invisible behind the decoy layer. Optionally specify decoy evidence to serve as fake content.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-cyber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-cyber-400">3</span>
                </div>
                <div>
                  <p className="font-medium">Plausible Deniability</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Under duress, provide the decoy password. Attackers see fake data while your real secrets remain hidden</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-warning/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <CardTitle className="text-warning">Security Warning</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Choose decoy files carefully to maintain plausibility. Empty or obviously fake decoy vaults may raise suspicion.</p>
              <p>We recommend storing realistic-looking but harmless data as decoy content.</p>
              <div className="flex items-start gap-2 text-xs bg-warning/10 p-3 rounded-lg mt-2">
                <Info className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                <span>The decoy vault does not replace strong encryption. Always use robust passwords for your real vault.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={showRemoveConfirm}
        onOpenChange={() => !removing && setShowRemoveConfirm(false)}
        onConfirm={handleRemove}
        title="Remove Decoy Vault?"
        description="This will delete your decoy vault configuration. Your real vault will no longer be protected by a decoy layer. You can set up a new decoy later."
        confirmLabel="Remove Protection"
        variant="destructive"
        loading={removing}
      />
    </div>
  )
}
