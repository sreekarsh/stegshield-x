"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, Loader2, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { api } from "@/lib/api"
import toast from "react-hot-toast"

export default function MFAPage() {
  const router = useRouter()
  const [step, setStep] = useState<"setup" | "verify">("setup")
  const [secret, setSecret] = useState("")
  const [qrCode, setQrCode] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)

  const setupMFA = async () => {
    setLoading(true)
    try {
      const data = await api.post<{ secret: string; otpauth_url: string }>("/auth/mfa/setup", {})
      setSecret(data.secret)
      
      // Generate QR code client-side using qrcode library to protect secret privacy
      const QRCode = await import("qrcode")
      const dataUrl = await QRCode.toDataURL(data.otpauth_url, { width: 200, margin: 2 })
      setQrCode(dataUrl)
      setStep("verify")
    } catch {
      toast.error("Failed to setup MFA")
    } finally {
      setLoading(false)
    }
  }

  const verifyMFA = async () => {
    if (!token) { toast.error("Enter the code from your authenticator app"); return }
    setLoading(true)
    try {
      const result = await api.post<{ verified: boolean }>("/auth/mfa/verify", { token })
      if (!result.verified) { toast.error("Invalid code. Try again."); return }
      toast.success("MFA enabled successfully")
      router.push("/settings")
    } catch {
      toast.error("Invalid code. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyber-500/5 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="h-12 w-12 text-cyber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Multi-Factor Authentication</h1>
          <p className="text-muted-foreground">Add an extra layer of security to your account</p>
        </div>

        {step === "setup" ? (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Setup MFA</CardTitle>
              <CardDescription>Use an authenticator app like Google Authenticator or Authy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <Smartphone className="h-16 w-16 text-cyber-400" />
              </div>
              <Button variant="cyber" className="w-full" onClick={setupMFA} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Begin Setup
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Verify MFA</CardTitle>
              <CardDescription>Scan the QR code in your authenticator app or enter the secret manually</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <div className="w-48 h-48 bg-muted rounded-xl flex items-center justify-center">
                  {qrCode ? (
                    <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
                  ) : (
                    <Shield className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
              </div>
              {secret && (
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Secret key:</p>
                  <p className="text-sm font-mono text-cyber-400">{secret}</p>
                </div>
              )}
              <Input placeholder="Enter 6-digit code" value={token} onChange={(e) => setToken(e.target.value)} maxLength={6} className="text-center text-lg tracking-widest" />
              <Button variant="cyber" className="w-full" onClick={verifyMFA} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify & Enable
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
