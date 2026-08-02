"use client"

import { useState } from "react"
import Link from "next/link"
import { Shield, Mail, Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import toast from "react-hot-toast"
import { api } from "@/lib/api"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { toast.error("Enter your email address"); return }
    setLoading(true)
    try {
      await api.post<{ message: string }>("/auth/forgot-password", { email })
      setSent(true)
      toast.success("Password reset request submitted")
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Request failed — try again later")
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
          <h1 className="text-2xl font-bold mb-2">Forgot Password</h1>
          <p className="text-muted-foreground">Enter your email and an admin will send you a reset token</p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            {sent ? (
                <div className="text-center py-4 space-y-4">
                  <Mail className="h-12 w-12 text-cyber-400 mx-auto mb-2" />
                  <h2 className="text-lg font-semibold">Admin Notified</h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    An admin has been notified for <strong className="text-foreground">{email}</strong>. You will receive the reset token via email shortly.
                  </p>

                <div className="pt-2 space-y-3">
                  <Link href={`/reset-password?email=${encodeURIComponent(email)}`} className="block">
                    <Button variant="cyber" className="w-full h-11 text-sm font-semibold">
                      Enter Reset Token & Set New Password
                    </Button>
                  </Link>

                  <div className="text-center">
                    <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                      <ArrowLeft className="h-3 w-3" /> Back to Sign In
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Email address</label>
                  <Input type="email" className="mt-1" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button variant="cyber" className="w-full" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Notify Admin for Reset
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
