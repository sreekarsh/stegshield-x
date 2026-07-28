"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { ImageIcon, Upload, Download, Lock, Unlock, Key, CheckCircle2, AlertCircle, Loader2, RotateCcw, Eye, EyeOff, Copy, Check, FileCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import toast from "react-hot-toast"
import {
  generateAESKey,
  encryptImageFile,
  decryptImageFile,
  detectEncryptedAlgorithm,
  exportCryptoKey,
  importCryptoKey,
} from "@/lib/crypto"

type Algorithm = "AES-GCM"

const KEY_REGEX = /^[A-Za-z0-9+/]+=*$/

export default function ImageEncryptionPage() {
  const [encryptFile, setEncryptFile] = useState<File | null>(null)
  const [decryptFile, setDecryptFile] = useState<File | null>(null)
  const [encKeyStr, setEncKeyStr] = useState("")
  const [decKeyStr, setDecKeyStr] = useState("")
  const [showEncKey, setShowEncKey] = useState(false)
  const [showDecKey, setShowDecKey] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)

  const [encResult, setEncResult] = useState<{ blob: Blob; key: string } | null>(null)
  const [decResult, setDecResult] = useState<{ url: string; originalName?: string } | null>(null)
  const [encrypting, setEncrypting] = useState(false)
  const [decrypting, setDecrypting] = useState(false)
  const [error, setError] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const encryptInputRef = useRef<HTMLInputElement>(null)
  const decryptInputRef = useRef<HTMLInputElement>(null)

  const MAX_FILE_SIZE = 50 * 1024 * 1024

  const revokeUrl = (url: string | null) => { if (url) URL.revokeObjectURL(url) }

  const handleEncryptFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) { setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 50MB`); return }
    setEncryptFile(file)
    setError("")
    setEncResult(null)
  }, [])

  useEffect(() => {
    if (!encryptFile) { revokeUrl(previewUrl); setPreviewUrl(null); return }
    const url = URL.createObjectURL(encryptFile)
    setPreviewUrl(url)
    return () => revokeUrl(url)
  }, [encryptFile])

  const handleDecryptFile = useCallback((file: File) => {
    if (file.size > MAX_FILE_SIZE) { setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: 50MB`); return }
    if (file.size < 6) { setError("File is too small to be an encrypted image"); return }
    setDecryptFile(file)
    setError("")
    setDecResult(null)
  }, [])

  const isValidKey = (k: string) => {
    const trimmed = k.trim()
    return trimmed.length > 0 && KEY_REGEX.test(trimmed) && trimmed.length % 4 === 0
  }

  const refreshAll = useCallback(() => {
    setEncryptFile(null)
    setDecryptFile(null)
    setEncKeyStr("")
    setDecKeyStr("")
    setEncResult(null)
    setDecResult(null)
    setError("")
    toast.success("Fields reset")
  }, [])

  const handleEncrypt = async () => {
    if (!encryptFile) { setError("Select an image first"); return }
    const keyInput = encKeyStr.trim()
    if (keyInput && !isValidKey(keyInput)) { setError("Invalid key format — key must be valid base64"); return }
    setEncrypting(true)
    setError("")
    try {
      const algo = "AES-GCM" as const
      const key = keyInput
        ? await importCryptoKey(keyInput, algo)
        : await generateAESKey(algo)
      const { encryptedBlob } = await encryptImageFile(encryptFile, algo, key)
      const exportedKey = keyInput || await exportCryptoKey(key)
      setEncResult({ blob: encryptedBlob, key: exportedKey })
      toast.success("Image encrypted successfully!")
    } catch (e) {
      setError(`Encryption failed: ${(e as Error).message}`)
    } finally {
      setEncrypting(false)
    }
  }

  const handleDecrypt = async () => {
    if (!decryptFile) { setError("Select an encrypted image first"); return }
    const keyInput = decKeyStr.trim()
    if (!keyInput) { setError("Enter the encryption key"); return }
    if (!isValidKey(keyInput)) { setError("Invalid key format — key must be valid base64"); return }
    setDecrypting(true)
    setError("")
    try {
      const algo = await detectEncryptedAlgorithm(decryptFile)
      const key = await importCryptoKey(keyInput, algo)
      const { blob, originalName } = await decryptImageFile(decryptFile, key)
      const url = URL.createObjectURL(blob)
      setDecResult({ url, originalName })
      toast.success("Image decrypted successfully!")
    } catch (e) {
      const msg = (e as Error).message || (e as DOMException).name || "Unknown error"
      if (!(e as Error).message && (e as DOMException).name === "OperationError") {
        setError("Decryption failed: The key does not match this file. Make sure you pasted the exact key shown after encryption.")
      } else {
        setError(`Decryption failed: ${msg}`)
      }
    } finally {
      setDecrypting(false)
    }
  }

  const generateNewKey = async () => {
    try {
      const key = await generateAESKey("AES-GCM")
      const str = await exportCryptoKey(key)
      setEncKeyStr(str)
      toast.success("New AES-256 key generated!")
    } catch (e) {
      setError(`Key generation failed: ${(e as Error).message}`)
    }
  }

  const downloadEncrypted = () => {
    if (!encResult || !encryptFile) return
    const originalName = encryptFile.name.replace(/\.[^.]+$/, "") || "image"
    const url = URL.createObjectURL(encResult.blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${originalName}.encrypted`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    toast.success("Encrypted image downloaded")
  }

  const mimeToExt = (name?: string): string => {
    if (!name) return "png"
    const ext = name.split(".").pop()?.toLowerCase()
    const map: Record<string, string> = {
      png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", bmp: "bmp", webp: "webp",
    }
    return (ext && map[ext]) || "png"
  }

  const downloadDecrypted = () => {
    if (!decResult) return
    const a = document.createElement("a")
    a.href = decResult.url
    const originalName = decResult.originalName
    const baseName = originalName?.replace(/\.encrypted$/i, "") || decryptFile?.name?.replace(/\.encrypted$/i, "") || "decrypted"
    a.download = originalName || `${baseName}.${mimeToExt(originalName)}`
    a.click()
    toast.success("Decrypted image downloaded")
  }

  const copyKey = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(true)
      toast.success("Key copied to clipboard!")
      setTimeout(() => setCopiedKey(false), 2000)
    } catch {
      toast.error("Failed to copy key")
    }
  }

  const dropHandlers = (handler: (f: File) => void) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault() },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handler(f) },
  })

  const keyHandler = (cb: () => void) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cb() } }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Image Encryption"
        description="Encrypt and decrypt images with military-grade AES-256"
        action={{ label: "Reset All", icon: RotateCcw, onClick: refreshAll }}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button className="ml-auto text-destructive hover:text-destructive/80 font-bold" onClick={() => setError("")}>×</button>
        </div>
      )}

      <Tabs defaultValue="encrypt" className="space-y-6">
        <TabsList>
          <TabsTrigger value="encrypt">Encrypt Image</TabsTrigger>
          <TabsTrigger value="decrypt">Decrypt Image</TabsTrigger>
        </TabsList>

        <TabsContent value="encrypt">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>{encryptFile ? encryptFile.name : "Original Image"}</CardTitle>
              </CardHeader>
              <CardContent>
                {previewUrl ? (
                  <div className="relative space-y-3" {...dropHandlers(handleEncryptFile)}>
                    <div className="relative rounded-lg overflow-hidden bg-black/40 border border-border/40 max-h-64 flex items-center justify-center p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Preview" className="max-h-60 max-w-full object-contain rounded" />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{(encryptFile!.size / 1024).toFixed(1)} KB</span>
                      <Button variant="outline" size="sm" onClick={() => { setEncryptFile(null); setEncResult(null) }}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-16 text-center cursor-pointer hover:border-cyber-500/50 transition-colors"
                    role="button"
                    tabIndex={0}
                    onClick={() => encryptInputRef.current?.click()}
                    onKeyDown={keyHandler(() => encryptInputRef.current?.click())}
                    {...dropHandlers(handleEncryptFile)}
                  >
                    <input
                      ref={encryptInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/bmp,image/gif"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEncryptFile(f) }}
                    />
                    <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
                    <p className="text-sm font-medium mb-1">Drop image here or click to browse</p>
                    <p className="text-xs text-muted-foreground">PNG, JPEG, BMP, GIF (max 50MB)</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Encryption Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Algorithm</label>
                  <div>
                    <Badge variant="cyber" className="w-fit">AES-256-GCM</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Authenticated encryption with integrity verification</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Encryption Key</label>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Optional</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showEncKey ? "text" : "password"}
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-9 text-sm font-mono"
                        placeholder="Leave empty to auto-generate"
                        value={encKeyStr}
                        onChange={(e) => setEncKeyStr(e.target.value)}
                      />
                      <button
                        type="button"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowEncKey((v) => !v)}
                        tabIndex={-1}
                        aria-label={showEncKey ? "Hide key" : "Show key"}
                      >
                        {showEncKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button variant="outline" size="icon" onClick={generateNewKey} title="Generate random key">
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleEncrypt}
                  disabled={encrypting || !encryptFile}
                >
                  {encrypting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Encrypting...</>
                  ) : (
                    <><Lock className="mr-2 h-4 w-4" /> Encrypt Image</>
                  )}
                </Button>

                {encResult && (
                  <div className="space-y-3 rounded-lg border border-cyber-500/30 bg-cyber-500/5 p-3.5">
                    <div className="flex items-center gap-2 text-sm text-cyber-400 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      Encryption successful
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Key (save this to decrypt)</label>
                      <div className="flex gap-2">
                        <code className="flex-1 truncate rounded bg-muted px-2.5 py-1.5 text-xs font-mono border border-border/60">
                          {encResult.key}
                        </code>
                        <Button variant="outline" size="sm" onClick={() => copyKey(encResult.key)} className="gap-1 shrink-0">
                          {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedKey ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </div>
                    <Button variant="cyber" className="w-full" onClick={downloadEncrypted}>
                      <Download className="mr-2 h-4 w-4" /> Download Encrypted File
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="decrypt">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>{decryptFile ? decryptFile.name : "Encrypted Image"}</CardTitle>
              </CardHeader>
              <CardContent>
                {decrypting && !decResult ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-cyber-400" />
                    <p className="text-xs text-muted-foreground">Decrypting image payload...</p>
                  </div>
                ) : decResult ? (
                  <div className="space-y-3" {...dropHandlers(handleDecryptFile)}>
                    <div className="relative rounded-lg overflow-hidden bg-black/40 border border-border/40 max-h-64 flex items-center justify-center p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={decResult.url} alt="Decrypted" className="max-h-60 max-w-full object-contain rounded" />
                    </div>
                    {decResult.originalName && (
                      <p className="text-xs text-muted-foreground text-center truncate">Original Name: {decResult.originalName}</p>
                    )}
                    <Button variant="cyber" className="w-full" onClick={downloadDecrypted}>
                      <Download className="mr-2 h-4 w-4" /> Download Decrypted Image
                    </Button>
                  </div>
                ) : decryptFile ? (
                  <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-cyber-500/10 border border-cyber-500/20 flex items-center justify-center shrink-0">
                      <FileCheck className="h-5 w-5 text-cyber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{decryptFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Encrypted File &middot; {(decryptFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Badge variant="success" className="shrink-0 text-[10px]">Loaded</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setDecryptFile(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-16 text-center cursor-pointer hover:border-cyber-500/50 transition-colors"
                    role="button"
                    tabIndex={0}
                    onClick={() => decryptInputRef.current?.click()}
                    onKeyDown={keyHandler(() => decryptInputRef.current?.click())}
                    {...dropHandlers(handleDecryptFile)}
                  >
                    <input
                      ref={decryptInputRef}
                      type="file"
                      accept=".encrypted,.bin,application/octet-stream,application/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDecryptFile(f) }}
                    />
                    <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
                    <p className="text-sm font-medium mb-1">Drop encrypted image or click to browse</p>
                    <p className="text-xs text-muted-foreground">.encrypted files from this tool</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Decryption Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Decryption Key</label>
                  <div className="relative">
                    <input
                      type={showDecKey ? "text" : "password"}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-9 text-sm font-mono"
                      placeholder="Paste the encryption key"
                      value={decKeyStr}
                      onChange={(e) => setDecKeyStr(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowDecKey((v) => !v)}
                      tabIndex={-1}
                      aria-label={showDecKey ? "Hide key" : "Show key"}
                    >
                      {showDecKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleDecrypt}
                  disabled={decrypting || !decryptFile || !decKeyStr}
                >
                  {decrypting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Decrypting...</>
                  ) : (
                    <><Unlock className="mr-2 h-4 w-4" /> Decrypt Image</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

