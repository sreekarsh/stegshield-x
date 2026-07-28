"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { FileText, Upload, Download, Lock, Unlock, Loader2, Key, CheckCircle2, AlertCircle, Shield, Eye, EyeOff, RotateCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { protectPdf, unlockPdf } from "@/lib/crypto"
import toast from "react-hot-toast"

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const MAX_FILE_SIZE = 50 * 1024 * 1024

function checkFileSize(file: File): boolean {
  if (file.size > MAX_FILE_SIZE) {
    toast.error(`File too large (max ${formatFileSize(MAX_FILE_SIZE)})`)
    return false
  }
  return true
}

export default function PdfProtectPage() {
  const [protectFile, setProtectFile] = useState<File | null>(null)
  const [unlockFile, setUnlockFile] = useState<File | null>(null)
  const [protectPassword, setProtectPassword] = useState("")
  const [unlockPassword, setUnlockPassword] = useState("")
  const [protectResult, setProtectResult] = useState<Blob | null>(null)
  const [unlockResult, setUnlockResult] = useState<Blob | null>(null)
  const [protecting, setProtecting] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [showProtectPw, setShowProtectPw] = useState(false)
  const [showUnlockPw, setShowUnlockPw] = useState(false)
  const [error, setError] = useState("")
  const [protectPreview, setProtectPreview] = useState<string | null>(null)
  const [unlockPreview, setUnlockPreview] = useState<string | null>(null)
  const protectInputRef = useRef<HTMLInputElement>(null)
  const unlockInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (protectFile && protectFile.type === "application/pdf") {
      const url = URL.createObjectURL(protectFile)
      setProtectPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [protectFile])

  useEffect(() => {
    if (unlockFile) {
      const url = URL.createObjectURL(unlockFile)
      setUnlockPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [unlockFile])

  const handleProtectFile = useCallback((file: File) => {
    if (!checkFileSize(file)) return
    setProtectFile(file)
    setError("")
    setProtectResult(null)
  }, [])

  const handleUnlockFile = useCallback((file: File) => {
    if (!checkFileSize(file)) return
    setUnlockFile(file)
    setError("")
    setUnlockResult(null)
  }, [])

  const refreshAll = useCallback(() => {
    setProtectFile(null)
    setUnlockFile(null)
    setProtectPassword("")
    setUnlockPassword("")
    setProtectResult(null)
    setUnlockResult(null)
    setError("")
  }, [])

  const handleProtect = async () => {
    if (!protectFile) { setError("Select a PDF file first"); return }
    if (!protectPassword || protectPassword.length < 4) { setError("Password must be at least 4 characters"); return }
    setProtecting(true)
    setError("")
    try {
      const protectedBlob = await protectPdf(protectFile, protectPassword)
      setProtectResult(protectedBlob)
      toast.success("PDF password protected successfully")
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes("already password-protected")) {
        setError("This PDF is already password-protected. Use the 'Unlock PDF' tab first.")
      } else {
        setError(`Protection failed: ${msg}`)
      }
    } finally {
      setProtecting(false)
    }
  }

  const handleUnlock = async () => {
    if (!unlockFile) { setError("Select a protected PDF file first"); return }
    if (!unlockPassword) { setError("Enter the password"); return }
    setUnlocking(true)
    setError("")
    try {
      const originalBlob = await unlockPdf(unlockFile, unlockPassword)
      setUnlockResult(originalBlob)
      toast.success("PDF unlocked successfully")
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes("encrypted") || msg.includes("password")) {
        setError("Incorrect password or this PDF is not encrypted")
      } else if (msg.includes("operation failed") || msg.includes("decrypt")) {
        setError("Incorrect password or corrupted file")
      } else {
        setError(`Unlock failed: ${msg}`)
      }
    } finally {
      setUnlocking(false)
    }
  }

  const downloadProtected = () => {
    if (!protectResult || !protectFile) return
    const originalName = protectFile.name.replace(/\.pdf$/i, "") || "document"
    const url = URL.createObjectURL(protectResult)
    const a = document.createElement("a")
    a.href = url
    a.download = `${originalName}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadUnlocked = () => {
    if (!unlockResult || !unlockFile) return
    const originalName = unlockFile.name.replace(/\.pdf$/i, "") || "document"
    const url = URL.createObjectURL(unlockResult)
    const a = document.createElement("a")
    a.href = url
    a.download = `${originalName}_unlocked.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  const passwordStrength = (pw: string) => {
    if (!pw) return { label: "", color: "", score: 0 }
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[a-z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 2) return { label: "Weak", color: "text-destructive", score }
    if (score <= 4) return { label: "Medium", color: "text-yellow-500", score }
    return { label: "Strong", color: "text-green-500", score }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="PDF Password Protect"
        description="Password-protect PDF files with native PDF encryption — stays as .pdf"
        action={{ label: "Refresh", icon: RotateCcw, onClick: refreshAll }}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto text-destructive hover:text-destructive/80" onClick={() => setError("")}>x</button>
        </div>
      )}

      <Tabs defaultValue="protect" className="space-y-6" onValueChange={() => setError("")}>
        <TabsList>
          <TabsTrigger value="protect">Protect PDF</TabsTrigger>
          <TabsTrigger value="unlock">Unlock PDF</TabsTrigger>
        </TabsList>

        <TabsContent value="protect">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Select PDF</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-16 text-center cursor-pointer hover:border-cyber-500/50 transition-colors"
                  onClick={() => protectInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type === "application/pdf") handleProtectFile(f); else toast.error("Only PDF files are supported") }}
                >
                  <input
                    ref={protectInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProtectFile(f) }}
                  />
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium mb-1">Drop PDF here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Only .pdf files are accepted</p>
                </div>
                {protectFile && (
                  <div className="mt-4 space-y-3">
                    <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                      <FileText className="h-5 w-5 text-red-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{protectFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(protectFile.size)}</p>
                      </div>
                      <Badge variant="success">Loaded</Badge>
                    </div>
                    {protectPreview && (
                      <div className="rounded-md overflow-hidden border border-border/50 bg-background max-h-48">
                        <iframe
                          src={protectPreview}
                          className="w-full h-48"
                          title="PDF Preview"
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Protection Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showProtectPw ? "text" : "password"}
                        className="font-mono pr-10"
                        placeholder="Enter a strong password"
                        value={protectPassword}
                        onChange={(e) => setProtectPassword(e.target.value)}
                      />
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowProtectPw(!showProtectPw)}
                      >
                        {showProtectPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button variant="outline" size="sm" onClick={refreshAll} title="Refresh all">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                  </div>
                  {protectPassword && (
                    <p className={`text-xs ${passwordStrength(protectPassword).color}`}>
                      Strength: {passwordStrength(protectPassword).label}
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-muted/30 p-3 text-xs space-y-1 text-muted-foreground">
                  <p className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-cyber-400" /> AES-256-GCM encryption</p>
                  <p className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-cyber-400" /> PBKDF2 key derivation (600K iterations)</p>
                  <p className="flex items-center gap-2"><Shield className="h-3.5 w-3.5 text-cyber-400" /> Native PDF encryption — opens in any PDF reader</p>
                </div>

                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleProtect}
                  disabled={protecting || !protectFile || !protectPassword}
                >
                  {protecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="mr-2 h-4 w-4" />
                  )}
                  {protecting ? "Protecting..." : "Protect PDF"}
                </Button>

                {protectResult && (
                  <div className="space-y-3 rounded-lg border border-cyber-500/30 bg-cyber-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm text-cyber-400">
                      <CheckCircle2 className="h-4 w-4" />
                      PDF password protected
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Protected with native PDF encryption — opens in Adobe Reader, Chrome, etc.
                      Recipients will be prompted for the password.
                    </p>
                    <Button variant="cyber" className="w-full" onClick={downloadProtected}>
                      <Download className="mr-2 h-4 w-4" /> Download Protected PDF
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="unlock">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Protected PDF</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-16 text-center cursor-pointer hover:border-cyber-500/50 transition-colors"
                  onClick={() => unlockInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type === "application/pdf") handleUnlockFile(f); else toast.error("Only PDF files are supported") }}
                >
                  <input
                    ref={unlockInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUnlockFile(f) }}
                  />
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium mb-1">Drop protected PDF here</p>
                  <p className="text-xs text-muted-foreground">Password-protected .pdf files</p>
                </div>
                {unlockFile && (
                  <div className="mt-4 space-y-3">
                    <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{unlockFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(unlockFile.size)}</p>
                      </div>
                      <Badge variant="outline">Protected</Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Unlock Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showUnlockPw ? "text" : "password"}
                        className="font-mono pr-10"
                        placeholder="Enter the password used to protect"
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                      />
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowUnlockPw(!showUnlockPw)}
                      >
                        {showUnlockPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button variant="outline" size="sm" onClick={refreshAll} title="Refresh all">
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </div>

                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleUnlock}
                  disabled={unlocking || !unlockFile || !unlockPassword}
                >
                  {unlocking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unlock className="mr-2 h-4 w-4" />
                  )}
                  {unlocking ? "Unlocking..." : "Unlock PDF"}
                </Button>

                {unlockResult && (
                  <div className="space-y-3 rounded-lg border border-cyber-500/30 bg-cyber-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm text-cyber-400">
                      <CheckCircle2 className="h-4 w-4" />
                      PDF unlocked successfully
                    </div>
                    <Button variant="cyber" className="w-full" onClick={downloadUnlocked}>
                      <Download className="mr-2 h-4 w-4" /> Download Original PDF
                    </Button>
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
