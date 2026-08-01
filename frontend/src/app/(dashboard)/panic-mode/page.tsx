"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  AlertTriangle, LogOut, Shield, Key,
  RefreshCw, AlertOctagon, Fingerprint, Ban, Eye, Send, Lock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/page-header"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { api, ApiError } from "@/lib/api"
import { useAuthStore } from "@/store/useAuthStore"
import toast from "react-hot-toast"

interface ActionConfig {
  key: string
  label: string
  description: string
  icon: typeof LogOut
  dangerLevel: "critical" | "high" | "medium"
  confirmTitle: string
  confirmDescription: string
}

const actions: ActionConfig[] = [
  {
    key: "logout-all",
    label: "Logout All Devices",
    description: "Immediately terminate all active sessions across every device and redirect to login",
    icon: LogOut,
    dangerLevel: "high",
    confirmTitle: "Logout All Devices?",
    confirmDescription: "This will sign out every device currently logged into your account, including this one. You will be redirected to the login page.",
  },
  {
    key: "destroy-keys",
    label: "Destroy Encryption Keys",
    description: "Permanently delete all encryption keys — encrypted data will be inaccessible",
    icon: Key,
    dangerLevel: "critical",
    confirmTitle: "Destroy All Encryption Keys?",
    confirmDescription: "This is permanent and irreversible. All data encrypted with these keys will become inaccessible forever. Only proceed if you are certain.",
  },
  {
    key: "revoke-tokens",
    label: "Revoke All API Tokens",
    description: "Invalidate every API key and access token across all integrations",
    icon: Fingerprint,
    dangerLevel: "high",
    confirmTitle: "Revoke All API Tokens?",
    confirmDescription: "All API keys, OAuth tokens, and service integrations will stop working immediately. You will need to regenerate keys.",
  },
  {
    key: "clear-audit",
    label: "Clear Audit Logs",
    description: "Remove all locally stored audit logs and activity history",
    icon: Eye,
    dangerLevel: "medium",
    confirmTitle: "Clear Audit Logs?",
    confirmDescription: "All audit log entries associated with your account will be permanently deleted from the server.",
  },
]

const dangerColors: Record<string, "destructive" | "outline"> = {
  critical: "destructive",
  high: "destructive",
  medium: "outline",
}

export default function PanicModePage() {
  const router = useRouter()
  const mountedRef = useRef(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ActionConfig | null>(null)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [panicToken, setPanicToken] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<ActionConfig | null>(null)
  const [supportContact, setSupportContact] = useState("security@stegshield.com")
  const [showContactDialog, setShowContactDialog] = useState(false)
  const [contactMessage, setContactMessage] = useState("")
  const [contactError, setContactError] = useState("")
  const [contactSending, setContactSending] = useState(false)

  useEffect(() => {
    api.get<{ email: string }>("/panic/support-contact")
      .then((res) => { if (res?.email) setSupportContact(res.email) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const requestPassword = useCallback((action: ActionConfig) => {
    setPendingAction(action)
    setPassword("")
    setPasswordError("")
    setShowPasswordDialog(true)
  }, [])

  const handlePasswordSubmit = useCallback(async () => {
    if (!pendingAction || !password.trim()) {
      setPasswordError("Password is required")
      return
    }
    setPasswordLoading(true)
    setPasswordError("")
    try {
      const res = await api.post<{ panicToken: string }>("/panic/verify-password", { password })
      setPanicToken(res.panicToken)
      setShowPasswordDialog(false)
      setConfirmAction(pendingAction)
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Verification failed")
    } finally {
      if (mountedRef.current) setPasswordLoading(false)
    }
  }, [pendingAction, password])

  const execute = useCallback(async () => {
    if (!confirmAction || !panicToken) return
    setActionLoading(confirmAction.key)
    try {
      await api.post(`/panic/${confirmAction.key}`, undefined, {
        headers: { "X-Panic-Token": panicToken },
      })
      localStorage.setItem("panic_triggered_at", Date.now().toString())
      toast.success(`${confirmAction.label} completed successfully`)
      setConfirmAction(null)
      setPanicToken(null)
      if (confirmAction.key === "logout-all") {
        useAuthStore.setState({ accessToken: null, user: null, isAuthenticated: false })
        setTimeout(() => { if (mountedRef.current) router.push("/login") }, 1000)
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `${confirmAction.label} failed`)
      setPanicToken(null)
    } finally {
      if (mountedRef.current) setActionLoading(null)
    }
  }, [confirmAction, panicToken, router])

  const handlePasswordDialogClose = useCallback((open: boolean) => {
    if (!open && !passwordLoading) {
      setShowPasswordDialog(false)
      setPendingAction(null)
      setPassword("")
      setPasswordError("")
    }
  }, [passwordLoading])

  const handlePasswordKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !passwordLoading) handlePasswordSubmit()
  }, [handlePasswordSubmit, passwordLoading])

  const handleContactSend = useCallback(async () => {
    if (!contactMessage.trim()) {
      setContactError("Please describe the problem you are facing")
      return
    }
    setContactSending(true)
    setContactError("")
    try {
      await api.post("/panic/contact-security", { message: contactMessage.trim() })
      toast.success("Report sent to the security team")
      setShowContactDialog(false)
      setContactMessage("")
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : "Failed to send report. Please try again.")
    } finally {
      setContactSending(false)
    }
  }, [contactMessage])

  const handleContactDialogClose = useCallback((open: boolean) => {
    if (!open && !contactSending) {
      setShowContactDialog(false)
      setContactMessage("")
      setContactError("")
    }
  }, [contactSending])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panic Mode"
        description="Emergency security actions for critical situations"
      />

      <Card className="glass-card border-destructive/20 bg-destructive/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertOctagon className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-destructive">Irreversible Actions</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              These actions are permanent and cannot be undone. Use them only in genuine emergency situations where your account or data is at immediate risk.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Card className="glass-card border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-destructive">Emergency Actions</CardTitle>
              </div>
              <CardDescription>Click an action to review before execution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {actions.slice(0, 2).map((action) => (
                <Button
                  key={action.key}
                  variant={dangerColors[action.dangerLevel]}
                  className="w-full justify-start h-auto py-3 px-4"
                  disabled={actionLoading !== null}
                  onClick={() => requestPassword(action)}
                >
                  {actionLoading === action.key ? (
                    <RefreshCw className="mr-3 h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <action.icon className="mr-3 h-4 w-4 shrink-0" />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{action.description}</p>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-warning" />
                <CardTitle>Secondary Actions</CardTitle>
              </div>
              <CardDescription>Less destructive but still impactful</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {actions.slice(2).map((action) => (
                <Button
                  key={action.key}
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 border-warning/30 hover:border-warning/50"
                  disabled={actionLoading !== null}
                  onClick={() => requestPassword(action)}
                >
                  {actionLoading === action.key ? (
                    <RefreshCw className="mr-3 h-4 w-4 animate-spin shrink-0" />
                  ) : (
                    <action.icon className="mr-3 h-4 w-4 shrink-0 text-warning" />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-[10px] opacity-70 mt-0.5">{action.description}</p>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="glass-card bg-cyber-500/5 border-cyber-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-cyber-400" />
                What happens when you trigger panic?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <LogOut className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                <span><strong>Logout All Devices</strong> — Ends all active sessions and redirects you to the login page. You will need to sign in again on every device.</span>
              </div>
              <div className="flex items-start gap-3">
                <Key className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
                <span><strong>Destroy Encryption Keys</strong> — Marks all your encryption keys as inactive. Any data encrypted with these keys will become permanently inaccessible.</span>
              </div>
              <div className="flex items-start gap-3">
                <Fingerprint className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
                <span><strong>Revoke API Tokens</strong> — Invalidates all API keys and OAuth tokens immediately. Integrations will stop working until new keys are generated.</span>
              </div>
              <div className="flex items-start gap-3">
                <Eye className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <span><strong>Clear Audit Logs</strong> — Permanently deletes all audit log entries associated with your account from the server.</span>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common security responses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/settings")}>
                <Key className="mr-2 h-4 w-4" /> Change Password
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => router.push("/reports")}>
                <Shield className="mr-2 h-4 w-4" /> Generate Security Report
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowContactDialog(true)}>
                <Send className="mr-2 h-4 w-4" /> Contact Security Team
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={() => !actionLoading && setConfirmAction(null)}
        onConfirm={execute}
        title={confirmAction?.confirmTitle || ""}
        description={confirmAction?.confirmDescription || ""}
        confirmLabel={`Execute ${confirmAction?.label || ""}`}
        variant={confirmAction?.dangerLevel === "medium" ? "default" : "destructive"}
        loading={actionLoading !== null}
      />

      <ConfirmDialog
        open={showPasswordDialog}
        onOpenChange={handlePasswordDialogClose}
        onConfirm={handlePasswordSubmit}
        title="Verify Your Password"
        description="Enter your account password to authorize this panic action."
        confirmLabel="Verify"
        variant="destructive"
        loading={passwordLoading}
      >
        <div className="space-y-2 pt-2">
          <label htmlFor="panic-password" className="text-sm font-medium">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="panic-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError("") }}
              onKeyDown={handlePasswordKeyDown}
              placeholder="Enter your password"
              className="pl-10"
              autoFocus
            />
          </div>
          {passwordError && (
            <p className="text-xs text-destructive">{passwordError}</p>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={showContactDialog}
        onOpenChange={handleContactDialogClose}
        onConfirm={handleContactSend}
        title="Contact Security Team"
        description={`Describe the problem you are facing. Your report will be sent to ${supportContact}.`}
        confirmLabel="Send Report"
        variant="default"
        loading={contactSending}
      >
        <div className="space-y-2 pt-2 w-full">
          <textarea
            id="contact-message"
            value={contactMessage}
            onChange={(e) => { setContactMessage(e.target.value); setContactError("") }}
            placeholder="Describe the issue in detail — e.g. unauthorized access, suspicious activity, lost device, account compromise..."
            className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyber-400 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
            maxLength={5000}
            autoFocus
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{contactMessage.length}/5000</span>
            {contactError && <span className="text-destructive">{contactError}</span>}
          </div>
        </div>
      </ConfirmDialog>
    </div>
  )
}
