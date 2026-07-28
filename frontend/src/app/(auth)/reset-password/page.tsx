"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Shield, KeyRound, Loader2, ArrowLeft, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import toast from "react-hot-toast"

function ResetForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""
  const email = searchParams.get("email") || ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !email) { toast.error("Invalid reset link"); return }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return }
    if (password !== confirm) { toast.error("Passwords do not match"); return }
    setLoading(true)
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      })
      if (res.ok) {
        setDone(true)
        toast.success("Password reset successfully")
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.message || "Reset failed")
      }
    } catch {
      toast.error("Network error — check your connection")
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
          <p className="text-muted-foreground">Choose a new password for your account</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            {!token || !email ? (
              <div className="text-center py-4">
                <p className="text-destructive mb-4">Invalid or missing reset link.</p>
                <Link href="/forgot-password" className="text-cyber-400 hover:underline text-sm font-medium">
                  Request a new reset link
                </Link>
              </div>
            ) : done ? (
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">Password reset successful</h2>
                <p className="text-sm text-muted-foreground mb-4">You can now log in with your new password.</p>
                <Link href="/login" className="text-cyber-400 hover:underline text-sm font-medium">Go to login</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" className="mt-1" value={email} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">New password</label>
                  <Input type="password" className="mt-1" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                </div>
                <div>
                  <label className="text-sm font-medium">Confirm password</label>
                  <Input type="password" className="mt-1" placeholder="Repeat password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
                </div>
                <Button variant="cyber" className="w-full" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Reset Password
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
