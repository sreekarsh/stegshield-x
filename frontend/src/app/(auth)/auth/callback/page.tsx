"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Shield, Loader2 } from "lucide-react"
import Link from "next/link"
import { useAuthStore } from "@/store/useAuthStore"

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
    const accessToken = searchParams.get("token")
    const errorParam = searchParams.get("error")
    const hashError = typeof window !== "undefined" ? new URLSearchParams(window.location.hash.slice(1)).get("error") : null
    const finalError = errorParam || hashError

    if (finalError) {
      setError(finalError)
      return
    }

    const initAuth = async () => {
      if (accessToken) {
        useAuthStore.setState({ accessToken, isAuthenticated: true })
        try {
          const res = await fetch(`${API}/users/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          if (res.ok) {
            const user = await res.json()
            setUser(user)
          }
        } catch {}
        router.push("/home")
        return
      }

      try {
        const res = await fetch(`${API}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          credentials: "include",
        })
        if (res.ok) {
          const data = await res.json()
          if (data.accessToken) {
            useAuthStore.setState({ accessToken: data.accessToken, isAuthenticated: true })
            if (data.user) setUser(data.user)
            router.push("/home")
            return
          }
        }
      } catch {}

      setError("Missing authentication token")
    }

    initAuth()
  }, [router, setUser, searchParams])

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
