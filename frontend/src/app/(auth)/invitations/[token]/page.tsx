"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, Shield, Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api"
import { useAuthStore } from "@/store/useAuthStore"
import toast from "react-hot-toast"

type Status = "loading" | "not_found" | "accepted" | "declined" | "error" | "unauthenticated" | "prompt"

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const [status, setStatus] = useState<Status>("loading")
  const [orgName, setOrgName] = useState("")

  useEffect(() => {
    const tokenVal = useAuthStore.getState().accessToken
    if (!tokenVal) {
      setStatus("unauthenticated")
      return
    }
    setStatus("loading")
    api.get<{ organization: { name: string }; email: string; role: string }>(`/team/invitations/info/${token}`)
      .then((data) => {
        setOrgName(data.organization?.name || "the team")
        setStatus("prompt")
      })
      .catch(() => setStatus("not_found"))
  }, [token])

  const handleAccept = async () => {
    try {
      await api.post(`/team/invitations/${token}/accept`)
      setStatus("accepted")
      toast.success("Invitation accepted!")
    } catch (e: any) {
      toast.error(e?.message || "Failed to accept")
      setStatus("error")
    }
  }

  const handleDecline = async () => {
    try {
      await api.post(`/team/invitations/${token}/decline`)
      setStatus("declined")
      toast.success("Invitation declined")
    } catch (e: any) {
      toast.error(e?.message || "Failed to decline")
      setStatus("error")
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Loader2 className="h-8 w-8 animate-spin text-cyber-400" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="glass-card max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <Mail className="h-12 w-12 text-cyber-400 mx-auto" />
            <h2 className="text-xl font-semibold">Team Invitation</h2>
            <p className="text-sm text-muted-foreground">
              {orgName ? `You've been invited to join ${orgName}.` : "You've been invited to join a team."}
            </p>
            <Button variant="cyber" className="w-full" onClick={() => router.push(`/login?redirect=/invitations/${token}`)}>
              Log in to respond
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="glass-card max-w-md w-full border-success/20">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
            <h2 className="text-xl font-semibold">Invitation Accepted</h2>
            <p className="text-sm text-muted-foreground">You're now a member of the team.</p>
            <Button variant="cyber" className="w-full" onClick={() => router.push("/team-workspace")}>
              Go to Team Workspace
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="glass-card max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Invitation Declined</h2>
            <p className="text-sm text-muted-foreground">You've declined the invitation.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="glass-card max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Invitation Not Found</h2>
            <p className="text-sm text-muted-foreground">This invitation link is invalid or expired.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="glass-card max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-cyber-400" /> Team Invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {orgName ? `You've been invited to join ${orgName}.` : "You've been invited to join a team."}
          </p>
          <div className="flex gap-3">
            <Button variant="cyber" className="flex-1" onClick={handleAccept}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Accept
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDecline}>
              <XCircle className="mr-2 h-4 w-4" /> Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
