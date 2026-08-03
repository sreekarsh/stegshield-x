"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Shield, Loader2, Smartphone } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/store/useAuthStore"
import toast from "react-hot-toast"

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser, mfaRequired, mfaToken, clearMfa, mfaLogin } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState("")
  const [mfaLoading, setMfaLoading] = useState(false)

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
    const accessToken = searchParams.get("token")
    const mfaRequiredParam = searchParams.get("mfaRequired")
    const mfaTokenParam = searchParams.get("mfaToken")
    const errorParam = searchParams.get("error")
    const hashError = typeof window !== "undefined" ? new URLSearchParams(window.location.hash.slice(1)).get("error") : null
    const finalError = errorParam || hashError

    if (finalError) {
      console.error("[AuthCallback] Error from OAuth:", finalError)
      setError(finalError)
      return
    }

    if (mfaRequiredParam === "true" && mfaTokenParam) {
      useAuthStore.setState({ mfaRequired: true, mfaToken: mfaTokenParam })
      return
    }

    const initAuth = async () => {
      if (accessToken) {
        console.log("[AuthCallback] Token found, setting auth state")
        useAuthStore.setState({ accessToken, isAuthenticated: true })
        if (typeof window !== "undefined") {
          localStorage.setItem("stegshield_access_token", accessToken)
        }
        try {
          const res = await fetch(`${API}/users/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          console.log("[AuthCallback] /users/me status:", res.status)
          if (res.ok) {
            const user = await res.json()
            console.log("[AuthCallback] User fetched:", user.email)
            setUser(user)
            if (typeof window !== "undefined") {
              localStorage.setItem("stegshield_user", JSON.stringify(user))
            }
          } else {
            const errText = await res.text()
            console.error("[AuthCallback] /users/me failed:", res.status, errText)
          }
        } catch (err) {
          console.error("[AuthCallback] /users/me network error:", err)
        }
        console.log("[AuthCallback] Redirecting to /home")
        router.push("/home")
        return
      }

      console.log("[AuthCallback] No token in URL, trying cookie refresh")
      try {
        const res = await fetch(`${API}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          credentials: "include",
        })
        console.log("[AuthCallback] /auth/refresh status:", res.status)
        if (res.ok) {
          const data = await res.json()
          console.log("[AuthCallback] Refresh response:", data.accessToken ? "has token" : "no token")
          if (data.accessToken) {
            useAuthStore.setState({ accessToken: data.accessToken, isAuthenticated: true })
            if (data.user) setUser(data.user)
            if (typeof window !== "undefined") {
              localStorage.setItem("stegshield_access_token", data.accessToken)
              if (data.user) localStorage.setItem("stegshield_user", JSON.stringify(data.user))
            }
            router.push("/home")
            return
          }
        } else {
          const errText = await res.text()
          console.error("[AuthCallback] /auth/refresh failed:", res.status, errText)
        }
      } catch (err) {
        console.error("[AuthCallback] /auth/refresh network error:", err)
      }

      console.error("[AuthCallback] All auth methods failed, showing error")
      setError("Missing authentication token")
    }

    initAuth()
  }, [router, setUser, searchParams])

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaToken || !mfaCode.trim()) {
      toast.error("Enter the 6-digit code from your authenticator app")
      return
    }
    setMfaLoading(true)
    try {
      await mfaLogin(mfaToken, mfaCode.trim())
      toast.success("Welcome!")
      router.push("/home")
    } catch {
      toast.error("Invalid MFA code")
    } finally {
      setMfaLoading(false)
    }
  }

  if (error) {
    let displayMessage = "An error occurred during sign in."
    if (error === "access_denied") {
      displayMessage = "You denied the authorization request."
    } else if (error.toLowerCase().includes("redirect_uri")) {
      displayMessage = "OAuth redirect URL mismatch. Please contact support or try again later."
    } else if (error.toLowerCase().includes("invalid_client")) {
      displayMessage = "OAuth client configuration error. Please try again later."
    } else if (error.toLowerCase().includes("network") || error.toLowerCase().includes("fetch")) {
      displayMessage = "Network error. Please check your connection and try again."
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyber-500/5 p-4">
        <div className="text-center">
          <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Authentication Failed</h1>
          <p className="text-muted-foreground mb-4">{displayMessage}</p>
          <p className="text-xs text-muted-foreground mb-4 font-mono bg-muted/50 p-2 rounded">
            {error}
          </p>
          <Link href="/login" className="text-cyber-400 hover:underline font-medium">
            Try again
          </Link>
        </div>
      </div>
    )
  }

  if (mfaRequired && mfaToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyber-500/5 p-4">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
        <div className="w-full max-w-md relative animate-fade-in">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 mb-6">
              <Shield className="h-8 w-8 text-cyber-500" />
              <span className="text-xl font-bold bg-gradient-to-r from-cyber-500 to-cyan-400 bg-clip-text text-transparent">
                StegShield X
              </span>
            </Link>
            <h1 className="text-2xl font-bold mb-2">Two-Factor Authentication</h1>
            <p className="text-muted-foreground">Enter the 6-digit code from your authenticator app to complete sign in</p>
          </div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Verify Identity</CardTitle>
              <CardDescription>Open your authenticator app and enter the code</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                <div className="flex justify-center">
                  <Smartphone className="h-12 w-12 text-cyber-400 mb-2" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">MFA Code</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center text-2xl tracking-widest font-mono"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" variant="cyber" disabled={mfaLoading || mfaCode.length !== 6}>
                  {mfaLoading ? "Verifying..." : "Verify"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => { clearMfa(); router.push("/login") }}>
                  Cancel
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyber-500/5 p-4">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-cyber-500 mx-auto mb-4" />
        <h1 className="text-xl font-semibold">Signing you in...</h1>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyber-500/5 p-4">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-cyber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold">Signing you in...</h1>
        </div>
      </div>
    }>
      <CallbackInner />
    </Suspense>
  )
}
