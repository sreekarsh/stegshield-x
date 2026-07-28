"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Shield, KeyRound, Loader2, ArrowLeft, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import toast from "react-hot-toast"
import { api } from "@/lib/api"

function ResetForm() {
  const searchParams = useSearchParams()
  const urlToken = searchParams.get("token") || ""
  const urlEmail = searchParams.get("email") || ""

  const [emailInput, setEmailInput] = useState(urlEmail)
  const [tokenInput, setTokenInput] = useState(urlToken)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetEmail = emailInput || urlEmail
    const targetToken = tokenInput || urlToken

    if (!targetEmail) { toast.error("Please enter your email address"); return }
    if (!targetToken) { toast.error("Please enter your reset token"); return }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return }
    if (password !== confirm) { toast.error("Passwords do not match"); return }

    setLoading(true)
    try {
      await api.post("/auth/reset-password", {
        email: targetEmail.trim(),
        token: targetToken.trim(),
        password,
      })
      setDone(true)
      toast.success("Password reset successfully")
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Reset failed — invalid or expired token")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyber-500/5 p-4">
      <div className="w-full max-w-md relative animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Shield className="h-8 w-8 text-cyber-500" />
            <span className="text-xl font-bold bg-gradient-to-r from-cyber-500 to-cyan-400 bg-clip-text text-transparent">StegShield X</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
          <p className="text-muted-foreground">Enter your reset token and new password</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            {done ? (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">Password reset successful</h2>
                <p className="text-sm text-muted-foreground mb-4">You can now log in with your new password.</p>
                <Link href="/login" className="text-cyber-400 hover:underline text-sm font-medium">Go to login</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email Address</label>
                  <Input
                    type="email"
                    className="mt-1"
                    placeholder="you@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Reset Token / Security Code</label>
                  <Input
                    type="text"
                    className="mt-1 font-mono text-xs"
                    placeholder="Paste or enter reset token received in email"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">New Password</label>
                  <Input
                    type="password"
                    className="mt-1"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Confirm New Password</label>
                  <Input
                    type="password"
                    className="mt-1"
                    placeholder="Repeat password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <Button variant="cyber" className="w-full" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Update Password
                </Button>
                <div className="text-center">
                  <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Back to login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <ResetForm />
    </Suspense>
  )
}
