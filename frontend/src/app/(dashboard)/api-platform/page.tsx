"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  Terminal, Key, BookOpen, Loader2, Trash2, Copy, Check,
  Globe, ChevronDown, Shield, Clock, Code, Play, RefreshCw,
  Eye, EyeOff, ToggleLeft, ToggleRight, Send,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/layout/empty-state"
import { CardSkeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { api, ApiError } from "@/lib/api"
import { useAuthStore } from "@/store/useAuthStore"
import toast from "react-hot-toast"
import type { ApiKey } from "@/types"

type Permission = "read" | "write" | "admin"

const permissionOptions: { value: Permission; label: string }[] = [
  { value: "read", label: "Read Only" },
  { value: "write", label: "Read & Write" },
  { value: "admin", label: "Full Access" },
]

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"

interface PlaygroundEndpoint {
  method: string
  path: string
  desc: string
  body?: string
}

const playgroundEndpoints: PlaygroundEndpoint[] = [
  { method: "GET", path: "/api/health", desc: "Health check" },
  { method: "POST", path: "/api/ai/analyze/password", desc: "Analyze password strength", body: '{"password":"Test123!"}' },
  { method: "POST", path: "/api/ai/analyze/entropy", desc: "Analyze file entropy", body: '{"data":"sample text for entropy analysis"}' },
  { method: "POST", path: "/api/encryption/keys", desc: "Create encryption key", body: '{"algorithm":"AES-GCM","keySize":256}' },
  { method: "GET", path: "/api/encryption/keys", desc: "List encryption keys" },
  { method: "GET", path: "/api/evidence", desc: "List evidence items" },
  { method: "GET", path: "/api/forensics/reports", desc: "List forensics reports" },
  { method: "GET", path: "/api/tamper/reports", desc: "List tamper reports" },
  { method: "GET", path: "/api/audit", desc: "Retrieve audit logs" },
  { method: "GET", path: "/api/team/organization", desc: "Get organization" },
  { method: "GET", path: "/api/team/members", desc: "List team members" },
  { method: "GET", path: "/api/time-capsule", desc: "List time capsules" },
  { method: "GET", path: "/api/trust", desc: "List trust scores" },
  { method: "POST", path: "/api/reports/generate", desc: "Generate security report", body: '{"name":"Test Report","type":"security","format":"pdf","data":{}}' },
  { method: "GET", path: "/api/watermark", desc: "List watermarks" },
  { method: "GET", path: "/api/sharing/links", desc: "List sharing links" },
  { method: "GET", path: "/api/api-keys", desc: "List API keys" },
  { method: "GET", path: "/api/notifications", desc: "List notifications" },
]

export default function ApiPlatformPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [keyName, setKeyName] = useState("")
  const [keyPermissions, setKeyPermissions] = useState<Permission>("read")
  const [keyExpiry, setKeyExpiry] = useState("30")
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showKey, setShowKey] = useState<string | null>(null)
  const [docLang, setDocLang] = useState("curl")
  const keyInputRef = useRef<HTMLInputElement>(null)

  const [pgEndpoint, setPgEndpoint] = useState(playgroundEndpoints[0].path)
  const [pgMethod, setPgMethod] = useState(playgroundEndpoints[0].method)
  const [pgBody, setPgBody] = useState(playgroundEndpoints[0].body || "")
  const [pgResponse, setPgResponse] = useState<string | null>(null)
  const [pgStatus, setPgStatus] = useState<number | null>(null)
  const [pgTiming, setPgTiming] = useState<number | null>(null)
  const [pgSending, setPgSending] = useState(false)

  const fetchKeys = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.get<{ keys: ApiKey[]; total: number }>("/api-keys")
      setKeys(data.keys)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load API keys")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  const generateKey = async () => {
    if (!keyName.trim()) { toast.error("Enter a key name"); return }
    setCreating(true)
    try {
      const perms = permissionOptions.find(p => p.value === keyPermissions)?.value
      const data = await api.post<ApiKey>("/api-keys", {
        name: keyName.trim(),
        permissions: [perms || "read"],
        expiresAt: keyExpiry === "never" ? undefined : new Date(Date.now() + parseInt(keyExpiry) * 86400000).toISOString(),
      })
      setKeys(prev => [data, ...prev])
      setKeyName("")
      setShowKey(data.key)
      toast.success("API key created — copy it now, it won't be shown again")
    } catch {
      toast.error("Failed to create key")
    } finally {
      setCreating(false)
    }
  }

  const deleteKey = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api-keys/${deleteTarget.id}`)
      setKeys(prev => prev.filter(k => k.id !== deleteTarget.id))
      toast.success("Key deleted")
      setDeleteTarget(null)
    } catch {
      toast.error("Failed to delete key")
    } finally {
      setDeleting(false)
    }
  }

  const toggleKeyActive = async (key: ApiKey) => {
    try {
      const action = key.isActive ? "revoke" : "reactivate"
      const updated = await api.patch<ApiKey>(`/api-keys/${key.id}/${action}`, {})
      setKeys(prev => prev.map(k => k.id === updated.id ? { ...k, isActive: updated.isActive } : k))
      toast.success(updated.isActive ? "Key reactivated" : "Key revoked")
    } catch {
      toast.error("Failed to update key")
    }
  }

  const copyKey = async (keyVal: string, id: string) => {
    try {
      await navigator.clipboard.writeText(keyVal)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Never"
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  }

  const handlePgEndpointChange = (path: string) => {
    setPgEndpoint(path)
    const ep = playgroundEndpoints.find(e => e.path === path)
    if (ep) {
      setPgMethod(ep.method)
      setPgBody(ep.body || "")
    }
  }

  const sendPlaygroundRequest = async () => {
    setPgSending(true)
    setPgResponse(null)
    setPgStatus(null)
    setPgTiming(null)
    const token = typeof window !== "undefined" ? useAuthStore.getState().accessToken : null
    const start = performance.now()
    try {
      const url = `${API_BASE}${pgEndpoint.replace(/^\/?api/, "")}`
      const res = await fetch(url, {
        method: pgMethod,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        ...(pgMethod !== "GET" && pgBody ? { body: pgBody } : {}),
      })
      const timing = Math.round(performance.now() - start)
      setPgTiming(timing)
      setPgStatus(res.status)
      const text = await res.text()
      try {
        setPgResponse(JSON.stringify(JSON.parse(text), null, 2))
      } catch {
        setPgResponse(text)
      }
    } catch (err: any) {
      setPgTiming(Math.round(performance.now() - start))
      setPgStatus(0)
      setPgResponse(`Network error: ${err.message}`)
    } finally {
      setPgSending(false)
    }
  }

  const codeExamples: Record<string, string> = {
    curl: `curl -X POST ${API_BASE.replace("/api", "")}/api/ai/analyze/password \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"password": "Test123!"}'`,
    python: `import requests

response = requests.post(
    "${API_BASE.replace("/api", "")}/api/ai/analyze/password",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"password": "Test123!"}
)
print(response.json())`,
    javascript: `const response = await fetch(
    "${API_BASE.replace("/api", "")}/api/ai/analyze/password",
    {
        method: "POST",
        headers: {
            Authorization: "Bearer YOUR_API_KEY",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: "Test123!" }),
    }
)
const result = await response.json()`,
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="API Platform" description="RESTful API with comprehensive endpoints and developer tools" />
        <div className="grid gap-6 lg:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Platform"
        description="RESTful API with comprehensive endpoints and developer tools"
        action={{ label: "New Key", icon: Key, onClick: () => keyInputRef.current?.focus() }}
      />

      <Tabs defaultValue="keys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
          <TabsTrigger value="playground">Playground</TabsTrigger>
        </TabsList>

        <TabsContent value="keys">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Your API Keys ({keys.length})</CardTitle>
                  {error && <span className="text-xs text-destructive">{error}</span>}
                </div>
              </CardHeader>
              <CardContent>
                {keys.length === 0 ? (
                  <EmptyState
                    icon={Key}
                    title="No API keys"
                    description="Create an API key below to get started."
                    action={{ label: "Create Key", onClick: () => keyInputRef.current?.focus() }}
                  />
                ) : (
                  <div className="space-y-2">
                    {keys.map((k) => (
                      <div key={k.id} className={`flex items-center justify-between p-3 rounded-lg transition-colors ${k.isActive === false ? "bg-destructive/5 opacity-60" : "bg-muted/30 hover:bg-muted/50"}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium">{k.name}</p>
                            <Badge variant={k.isActive === false ? "destructive" : "outline"} className="text-[10px]">
                              {k.permissions?.join(", ") || "read"}
                            </Badge>
                            {k.isActive === false && <Badge variant="destructive" className="text-[10px]">Revoked</Badge>}
                          </div>
                          <p className="text-xs font-mono text-muted-foreground truncate">{k.key}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Last used: {formatDate(k.lastUsed)} · Created: {new Date(k.createdAt).toLocaleDateString()}
                            {k.expiresAt && <> · Expires: {new Date(k.expiresAt).toLocaleDateString()}</>}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleKeyActive(k)} title={k.isActive ? "Revoke" : "Reactivate"}>
                            {k.isActive === false ? <ToggleRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ToggleLeft className="h-3.5 w-3.5 text-success" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyKey(k.key, k.id)} title="Copy key">
                            {copiedId === k.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(k)} title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle>Generate New Key</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Key Name</label>
                  <Input ref={keyInputRef} placeholder="e.g., Production, Dev, CI/CD" value={keyName} onChange={(e) => setKeyName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generateKey()} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Permissions</label>
                  <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={keyPermissions} onChange={(e) => setKeyPermissions(e.target.value as Permission)}>
                    {permissionOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Expires In</label>
                  <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={keyExpiry} onChange={(e) => setKeyExpiry(e.target.value)}>
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                    <option value="never">Never</option>
                  </select>
                </div>
                <Button variant="cyber" className="w-full" onClick={generateKey} disabled={creating}>
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                  Generate API Key
                </Button>
              </CardContent>
            </Card>
          </div>

          {showKey && (
            <Card className="glass-card border-cyber-500/50 mt-6">
              <CardHeader>
                <CardTitle className="text-cyber-400 flex items-center gap-2"><Key className="h-5 w-5" /> Key Created Successfully</CardTitle>
                <CardDescription>Copy this key now. For security, it won&apos;t be shown again.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input readOnly value={showKey} className="font-mono text-xs" />
                  <Button variant="cyber" size="sm" onClick={() => copyKey(showKey, "new")}>
                    {copiedId === "new" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowKey(null)}>Dismiss</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="docs">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>API Endpoints</CardTitle>
                    <Badge variant="cyber">v1</Badge>
                  </div>
                  <CardDescription>Base URL: <code className="text-cyber-400">{API_BASE}</code></CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                    {playgroundEndpoints.map((ep, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors text-sm">
                        <Badge variant={ep.method === "GET" ? "outline" : "secondary"} className={`font-mono text-[10px] w-14 justify-center shrink-0 ${ep.method === "GET" ? "text-success" : "text-cyber-400"}`}>
                          {ep.method}
                        </Badge>
                        <code className="text-xs font-mono text-foreground">{ep.path}</code>
                        <span className="text-xs text-muted-foreground hidden sm:inline ml-auto">{ep.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader><CardTitle>Authentication</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">All API requests require authentication via Bearer token:</p>
                  <div className="p-3 rounded bg-muted/30 font-mono text-xs break-all">Authorization: Bearer YOUR_API_KEY</div>
                  <p className="text-xs text-muted-foreground">Or use a JWT token obtained from <code className="text-cyber-400">/api/auth/login</code></p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3 text-cyber-400" />
                    Keys are managed from the API Keys tab
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader><CardTitle>Rate Limits</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between"><span>Default</span><span className="font-mono">60 req/min</span></div>
                  <div className="flex justify-between"><span>Auth (register)</span><span className="font-mono">5 req/min</span></div>
                  <div className="flex justify-between"><span>Auth (login)</span><span className="font-mono">10 req/min</span></div>
                  <div className="flex justify-between"><span>Key creation</span><span className="font-mono">5 req/min</span></div>
                  <p className="text-[10px] text-muted-foreground mt-2">Rate limits apply per IP or API key</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="glass-card mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Code Examples</CardTitle>
                <div className="flex gap-1">
                  {["curl", "python", "javascript"].map((lang) => (
                    <Button key={lang} variant={docLang === lang ? "cyber" : "outline"} size="sm" className="text-xs capitalize" onClick={() => setDocLang(lang)}>{lang}</Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-xs font-mono"><code>{codeExamples[docLang]}</code></pre>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => copyKey(codeExamples[docLang], "code")}>
                {copiedId === "code" ? <Check className="mr-2 h-3 w-3" /> : <Copy className="mr-2 h-3 w-3" />}
                Copy Example
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playground">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Request</CardTitle>
                <CardDescription>Test API endpoints directly from the browser</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="w-28 shrink-0">
                    <label className="text-sm font-medium mb-1.5 block">Method</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono" value={pgMethod} onChange={(e) => setPgMethod(e.target.value)}>
                      {["GET", "POST", "PUT", "PATCH", "DELETE"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-1.5 block">Endpoint</label>
                    <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono" value={pgEndpoint} onChange={(e) => handlePgEndpointChange(e.target.value)}>
                      {playgroundEndpoints.map((ep, i) => (
                        <option key={i} value={ep.path}>{ep.method} {ep.path}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {pgMethod !== "GET" && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Request Body (JSON)</label>
                    <textarea className="w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono" value={pgBody} onChange={(e) => setPgBody(e.target.value)} placeholder='{"key": "value"}' />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button variant="cyber" onClick={sendPlaygroundRequest} disabled={pgSending}>
                    {pgSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    {pgSending ? "Sending..." : "Send Request"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Response</CardTitle>
                  {pgStatus && (
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant={pgStatus < 300 ? "success" : pgStatus < 500 ? "warning" : "destructive"}>
                        {pgStatus}
                      </Badge>
                      {pgTiming !== null && <span className="text-muted-foreground font-mono">{pgTiming}ms</span>}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted/50 overflow-x-auto text-xs font-mono min-h-[200px] max-h-[400px] overflow-y-auto">
                  <code>{pgResponse || "Response will appear here after sending a request."}</code>
                </pre>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={!!deleteTarget} onOpenChange={() => !deleting && setDeleteTarget(null)} onConfirm={deleteKey}
        title="Delete API Key" description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete Key" variant="destructive" loading={deleting} />
    </div>
  )
}
