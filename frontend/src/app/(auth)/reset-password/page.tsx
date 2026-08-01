"use client"

import { Suspense, useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Shield, KeyRound, Loader2, ArrowLeft, CheckCircle, Eye, EyeOff, Check, X, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import toast from "react-hot-toast"
import { api } from "@/lib/api"

function calculateStrength(pwd: string) {
  if (!pwd) return { score: 0, label: "Empty", color: "bg-muted", percent: 0 }
  let score = 0
  if (pwd.length >= 8) score += 1
  if (pwd.length >= 12) score += 1
  if (/[A-Z]/.test(pwd)) score += 1
  if (/[0-9]/.test(pwd)) score += 1
  if (/[^A-Za-z0-9]/.test(pwd)) score += 1

  const map = [
    { label: "Very Weak", color: "bg-red-500", percent: 20 },
    { label: "Weak", color: "bg-orange-500", percent: 40 },
    { label: "Fair", color: "bg-yellow-500", percent: 60 },
    { label: "Strong", color: "bg-emerald-500", percent: 80 },
    { label: "Very Strong", color: "bg-cyan-400", percent: 100 },
  ]
  const idx = Math.min(score, 4)
  return map[idx]
}

function ResetForm() {
  const searchParams = useSearchParams()
  const urlToken = searchParams.get("token") || ""
  const urlEmail = searchParams.get("email") || ""

  const [emailInput, setEmailInput] = useState(urlEmail)
  const [tokenInput, setTokenInput] = useState(urlToken)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (urlEmail && !emailInput) setEmailInput(urlEmail)
    if (urlToken && !tokenInput) setTokenInput(urlToken)
  }, [urlEmail, urlToken, emailInput, tokenInput])

  const strength = useMemo(() => calculateStrength(password), [password])

  const criteria = useMemo(() => ({
    minLen: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
    match: password.length > 0 && password === confirm,
  }), [password, confirm])

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
      toast.success("Password reset successfully!")
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
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-cyber-500" />
            <span className="text-2xl font-extrabold bg-gradient-to-r from-cyber-500 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              StegShield X
            </span>
          </Link>
          <h1 className="text-2xl font-bold mb-1">Set New Password</h1>
          <p className="text-sm text-muted-foreground">Secure your account with an Argon2-derived password</p>
        </div>

        <Card className="glass-card border-violet-500/20 shadow-2xl backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Lock className="h-5 w-5 text-cyan-400" /> Account Security Reset
            </CardTitle>
            <CardDescription className="text-xs">
              Enter your reset token code and choose a new password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {done ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                  <CheckCircle className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Password Reset Successfully</h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Your password has been updated and old reset sessions have been invalidated.
                  </p>
                </div>
                <Link href="/login" className="block pt-2">
                  <Button variant="cyber" className="w-full h-11 text-sm font-semibold">
                    Sign In with New Password
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Address</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    className="h-10 bg-background/50 border-border/60"
                  />
                </div>

                {/* Token / Code Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reset Security Token</label>
                    <span className="text-[10px] text-violet-400 font-mono">1-Hour Validity</span>
                  </div>
                  <Input
                    type="text"
                    placeholder="Paste reset token from email"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    required
                    className="h-10 font-mono text-xs bg-background/50 border-border/60"
                  />
                </div>

                {/* New Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-10 pr-10 bg-background/50 border-border/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password Strength Bar */}
                  {password && (
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Strength:</span>
                        <span className="font-semibold text-foreground">{strength.label}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: `${strength.percent}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Confirm New Password</label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      minLength={8}
                      className="h-10 pr-10 bg-background/50 border-border/60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Security Requirements Checklist */}
                <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-500/20 space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider mb-1">Security Criteria:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className={`flex items-center gap-1.5 ${criteria.minLen ? "text-emerald-400 font-medium" : ""}`}>
                      {criteria.minLen ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span>8+ Characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${criteria.hasUpper ? "text-emerald-400 font-medium" : ""}`}>
                      {criteria.hasUpper ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span>1 Uppercase Letter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${criteria.hasNumber ? "text-emerald-400 font-medium" : ""}`}>
                      {criteria.hasNumber ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span>1 Number</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${criteria.match ? "text-emerald-400 font-medium" : ""}`}>
                      {criteria.match ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <X className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span>Passwords Match</span>
                    </div>
                  </div>
                </div>

                <Button variant="cyber" className="w-full h-11 text-sm font-semibold" type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Update & Save Password
                </Button>

                <div className="text-center pt-1">
                  <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" /> Return to Sign In
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ResetForm />
    </Suspense>
  )
}
