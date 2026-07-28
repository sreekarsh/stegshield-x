"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { FileKey, Upload, Download, Lock, Unlock, Loader2, Key, CheckCircle2, AlertCircle, FileText, Image, File, RotateCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import {
  generateAESKey,
  encryptFile,
  decryptFile,
  detectEncryptedAlgorithm,
  exportCryptoKey,
  importCryptoKey,
} from "@/lib/crypto"
import toast from "react-hot-toast"

type Algorithm = "AES-GCM"

function FilePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState<string | null>(null)
  const [textPreview, setTextPreview] = useState<string | null>(null)
  const isImage = file.type.startsWith("image/")
  const isText = file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".csv")
  const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf")

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
    if (isText) {
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        setTextPreview(text.slice(0, 500))
      }
      reader.readAsText(file)
    }
  }, [file, isImage, isText])

  return (
    <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-3 mb-2">
        {isImage ? (
          <Image className="h-5 w-5 text-cyber-400" />
        ) : isPdf ? (
          <FileText className="h-5 w-5 text-red-400" />
        ) : isText ? (
          <FileText className="h-5 w-5 text-blue-400" />
        ) : (
          <File className="h-5 w-5 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {file.type || "Unknown type"} &middot; {formatFileSize(file.size)}
          </p>
        </div>
      </div>
      {isImage && preview && (
        <div className="relative rounded-md overflow-hidden bg-background max-h-48 flex items-center justify-center">
          <img src={preview} alt="Preview" className="max-w-full max-h-48 object-contain" />
        </div>
      )}
      {isPdf && (
        <div className="flex items-center gap-2 p-2 rounded bg-background border border-border/50">
          <FileText className="h-8 w-8 text-red-400 shrink-0" />
          <div>
            <p className="text-xs font-medium">PDF Document</p>
            <p className="text-xs text-muted-foreground">Password protection available in PDF Protect tool</p>
          </div>
        </div>
      )}
      {isText && textPreview && (
        <div className="rounded-md bg-background border border-border/50 p-2 max-h-32 overflow-y-auto">
          <pre className="text-xs font-mono whitespace-pre-wrap">{textPreview}{textPreview.length >= 500 ? "..." : ""}</pre>
        </div>
      )}
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

export default function FileEncryptionPage() {
  const [encFile, setEncFile] = useState<File | null>(null)
  const [decFile, setDecFile] = useState<File | null>(null)
  const [algorithm, setAlgorithm] = useState<Algorithm>("AES-GCM")
  const [encKeyStr, setEncKeyStr] = useState("")
  const [decKeyStr, setDecKeyStr] = useState("")
  const [encResult, setEncResult] = useState<{ blob: Blob; key: string } | null>(null)
  const [decResult, setDecResult] = useState<{ url: string; name?: string } | null>(null)
  const [encrypting, setEncrypting] = useState(false)
  const [decrypting, setDecrypting] = useState(false)
  const [error, setError] = useState("")
  const encryptInputRef = useRef<HTMLInputElement>(null)
  const decryptInputRef = useRef<HTMLInputElement>(null)

  const clearAll = useCallback(() => {
    setEncFile(null)
    setDecFile(null)
    setEncKeyStr("")
    setDecKeyStr("")
    setEncResult(null)
    if (decResult?.url) URL.revokeObjectURL(decResult.url)
    setDecResult(null)
    setError("")
    if (encryptInputRef.current) encryptInputRef.current.value = ""
    if (decryptInputRef.current) decryptInputRef.current.value = ""
  }, [decResult])

  const handleEncFile = useCallback((file: File) => {
    setEncFile(file)
    setError("")
    setEncResult(null)
  }, [])

  const handleDecFile = useCallback((file: File) => {
    setDecFile(file)
    setError("")
    setDecResult(null)
  }, [])

  const handleEncrypt = async () => {
    if (!encFile) { setError("Select a file first"); return }
    setEncrypting(true)
    setError("")
    try {
      const algo = algorithm
      const key = encKeyStr
        ? await importCryptoKey(encKeyStr, algo)
        : await generateAESKey(algo)
      const { encryptedBlob } = await encryptFile(encFile, algo, key)
      const exportedKey = encKeyStr || await exportCryptoKey(key)
      setEncResult({ blob: encryptedBlob, key: exportedKey })
      toast.success("File encrypted successfully")
    } catch (e) {
      setError(`Encryption failed: ${(e as Error).message}`)
    } finally {
      setEncrypting(false)
    }
  }

  const handleDecrypt = async () => {
    if (!decFile) { setError("Select an encrypted file first"); return }
    if (!decKeyStr) { setError("Enter the encryption key"); return }
    setDecrypting(true)
    setError("")
    try {
      const algo = await detectEncryptedAlgorithm(decFile)
      const key = await importCryptoKey(decKeyStr, algo)
      const { blob, originalName } = await decryptFile(decFile, key)
      const url = URL.createObjectURL(blob)
      setDecResult({ url, name: originalName })
      toast.success("File decrypted successfully")
    } catch (e) {
      const msg = (e as Error).message || (e as DOMException).name || "Unknown error"
      if ((e as DOMException).name === "OperationError") {
        setError("Decryption failed: The key does not match this file.")
      } else {
        setError(`Decryption failed: ${msg}`)
      }
    } finally {
      setDecrypting(false)
    }
  }

  const generateNewKey = async () => {
    try {
      const key = await generateAESKey(algorithm)
      const str = await exportCryptoKey(key)
      setEncKeyStr(str)
      toast.success("New key generated")
    } catch (e) {
      setError(`Key generation failed: ${(e as Error).message}`)
    }
  }

  const downloadEncrypted = () => {
    if (!encResult || !encFile) return
    const originalName = encFile.name.replace(/\.[^.]+$/, "") || "file"
    const url = URL.createObjectURL(encResult.blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${originalName}.encrypted`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadDecrypted = () => {
    if (!decResult || !decFile) return
    const a = document.createElement("a")
    a.href = decResult.url
    a.download = decResult.name || `decrypted_${decFile.name.replace(/\.encrypted$/, "")}`
    a.click()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="File Encryption"
        description="Encrypt and decrypt files with AES-256"
        action={{
          label: "New File",
          icon: RotateCcw,
          onClick: clearAll,
        }}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto text-destructive hover:text-destructive/80" onClick={() => setError("")}>x</button>
        </div>
      )}

      <Tabs defaultValue="encrypt" className="space-y-6">
        <TabsList>
          <TabsTrigger value="encrypt">Encrypt File</TabsTrigger>
          <TabsTrigger value="decrypt">Decrypt File</TabsTrigger>
        </TabsList>

        <TabsContent value="encrypt">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Original File</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-16 text-center cursor-pointer hover:border-cyber-500/50 transition-colors"
                  onClick={() => encryptInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleEncFile(f) }}
                >
                  <input
                    ref={encryptInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEncFile(f) }}
                  />
                  <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium mb-1">Drop file here or click to browse</p>
                  <p className="text-xs text-muted-foreground">Any file type supported</p>
                </div>
                {encFile && (
                  <>
                    <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                      <FileKey className="h-5 w-5 text-cyber-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{encFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(encFile.size)}</p>
                      </div>
                      <Badge variant="success">Loaded</Badge>
                    </div>
                    <FilePreview file={encFile} />
                  </>
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
                  <Badge variant="cyber">AES-256-GCM</Badge>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Encryption Key</label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      className="font-mono"
                      placeholder="Leave empty to auto-generate"
                      value={encKeyStr}
                      onChange={(e) => setEncKeyStr(e.target.value)}
                    />
                    <Button variant="outline" size="icon" onClick={generateNewKey} title="Generate new key">
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleEncrypt}
                  disabled={encrypting || !encFile}
                >
                  {encrypting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="mr-2 h-4 w-4" />
                  )}
                  {encrypting ? "Encrypting..." : "Encrypt & Download"}
                </Button>
                {encResult && (
                  <div className="space-y-3 rounded-lg border border-cyber-500/30 bg-cyber-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm text-cyber-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Encryption successful
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Key (save this to decrypt)</label>
                      <div className="flex gap-1">
                        <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono">{encResult.key}</code>
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(encResult.key); toast.success("Key copied") }}>
                          Copy
                        </Button>
                      </div>
                    </div>
                    <Button variant="cyber" className="w-full" onClick={downloadEncrypted}>
                      <Download className="mr-2 h-4 w-4" /> Download Encrypted
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={clearAll}>
                      <RotateCcw className="mr-1 h-3 w-3" /> Encrypt another file
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
                <CardTitle>Encrypted File</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-16 text-center cursor-pointer hover:border-cyber-500/50 transition-colors"
                  onClick={() => decryptInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleDecFile(f) }}
                >
                  <input
                    ref={decryptInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDecFile(f) }}
                  />
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm font-medium mb-1">Drop .encrypted file here</p>
                  <p className="text-xs text-muted-foreground">Files encrypted with this tool</p>
                </div>
                {decFile && (
                  <>
                    <div className="mt-4 p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                      <FileKey className="h-5 w-5 text-cyber-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{decFile.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(decFile.size)}</p>
                      </div>
                      <Badge variant="success">Loaded</Badge>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setDecFile(null); setDecResult(null); setDecKeyStr(""); if (decryptInputRef.current) decryptInputRef.current.value = "" }} title="Remove">
                        <span className="text-xs">x</span>
                      </Button>
                    </div>
                    <FilePreview file={decFile} />
                  </>
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
                  <Input
                    type="text"
                    className="font-mono"
                    placeholder="Paste the encryption key"
                    value={decKeyStr}
                    onChange={(e) => setDecKeyStr(e.target.value)}
                  />
                </div>
                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleDecrypt}
                  disabled={decrypting || !decFile || !decKeyStr}
                >
                  {decrypting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unlock className="mr-2 h-4 w-4" />
                  )}
                  {decrypting ? "Decrypting..." : "Decrypt File"}
                </Button>
                {decResult && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-cyber-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Decryption successful
                    </div>
                    <Button variant="cyber" className="w-full" onClick={downloadDecrypted}>
                      <Download className="mr-2 h-4 w-4" /> Download Decrypted
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={clearAll}>
                      <RotateCcw className="mr-1 h-3 w-3" /> Decrypt another file
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
