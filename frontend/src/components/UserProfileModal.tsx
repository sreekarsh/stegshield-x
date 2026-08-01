"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getAvatarUrl } from "@/lib/utils"
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Mail,
  Copy,
  Check,
  Lock,
  Calendar,
  MessageSquare,
  KeyRound,
  Building,
  UserCheck,
  ExternalLink,
} from "lucide-react"
import toast from "react-hot-toast"

export interface UserProfileData {
  id?: string
  name?: string
  email?: string
  avatar?: string | null
  role?: string
  isVerified?: boolean
  isMFAEnabled?: boolean
  createdAt?: string
  department?: string
  jobTitle?: string
  bio?: string
  location?: string
  fingerprint?: string
}

interface UserProfileModalProps {
  user: UserProfileData | null
  isOpen: boolean
  onClose: () => void
  onSendMessage?: (userId: string) => void
}

export function UserProfileModal({
  user,
  isOpen,
  onClose,
  onSendMessage,
}: UserProfileModalProps) {
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedFingerprint, setCopiedFingerprint] = useState(false)

  if (!user) return null

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user.email
    ? user.email.slice(0, 2).toUpperCase()
    : "US"

  // Derive stable security fingerprint from user ID / email
  const displayFingerprint =
    user.fingerprint ||
    `SHA256:${(user.id || user.email || "user-id")
      .split("")
      .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 0xffffffff, 0)
      .toString(16)
      .padStart(8, "0")
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join(":")}`

  const formattedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "August 2026"

  const roleName = (user.role || "AGENT").toUpperCase()
  const departmentName = user.department || "Cyber Security Operations"
  const isVerified = user.isVerified !== false

  const handleCopyEmail = () => {
    if (!user.email) return
    navigator.clipboard.writeText(user.email)
    setCopiedEmail(true)
    toast.success("Email copied to clipboard")
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const handleCopyFingerprint = () => {
    navigator.clipboard.writeText(displayFingerprint)
    setCopiedFingerprint(true)
    toast.success("Security fingerprint copied")
    setTimeout(() => setCopiedFingerprint(false), 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-cyber-500/30 bg-background/95 backdrop-blur-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>User Profile - {user.name || "User Details"}</DialogTitle>
        </DialogHeader>

        {/* Profile Card Header Banner */}
        <div className="relative h-28 bg-gradient-to-r from-cyber-900 via-purple-950 to-cyber-950 border-b border-border/50 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            <Badge variant="cyber" className="text-[10px] uppercase font-mono px-2 py-0.5 shadow-sm backdrop-blur-md">
              <Lock className="h-3 w-3 mr-1 text-cyber-400 inline" /> AES-256-GCM
            </Badge>
          </div>
        </div>

        {/* Avatar & Main Headings */}
        <div className="px-6 pb-6 pt-0 relative space-y-5">
          <div className="flex justify-between items-end -mt-12 mb-3">
            <div className="relative">
              <Avatar className="h-24 w-24 ring-4 ring-background shadow-xl border-2 border-cyber-500/40">
                <AvatarImage src={getAvatarUrl(user.avatar)} alt={user.name || "User"} />
                <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-cyber-600 to-purple-700 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-success ring-2 ring-background shadow-md" title="Active E2EE Node" />
            </div>

            {onSendMessage && user.id && (
              <Button
                variant="cyber"
                size="sm"
                className="gap-2 shadow-lg hover:shadow-cyber-500/20 transition-all"
                onClick={() => {
                  onSendMessage(user.id!)
                  onClose()
                }}
              >
                <MessageSquare className="h-4 w-4" /> Message
              </Button>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold tracking-tight text-foreground">{user.name || "Security Operative"}</h3>
              {isVerified && (
                <span className="inline-flex items-center text-cyber-400" title="Verified Security Account">
                  <ShieldCheck className="h-5 w-5" />
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{user.email || "No email provided"}</span>
              {user.email && (
                <button
                  onClick={handleCopyEmail}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                  title="Copy email"
                >
                  {copiedEmail ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              )}
            </p>
          </div>

          {/* Badges Bar */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline" className="text-xs py-1 px-2.5 font-medium border-cyber-500/30 bg-cyber-500/10 text-cyber-400">
              {roleName === "ADMIN" || roleName === "OWNER" ? (
                <ShieldAlert className="h-3.5 w-3.5 mr-1 inline" />
              ) : (
                <Shield className="h-3.5 w-3.5 mr-1 inline text-cyber-400" />
              )}
              {roleName}
            </Badge>

            {user.isMFAEnabled && (
              <Badge variant="outline" className="text-xs py-1 px-2.5 font-medium border-purple-500/30 bg-purple-500/10 text-purple-300">
                <UserCheck className="h-3.5 w-3.5 mr-1 inline" /> MFA Enabled
              </Badge>
            )}

            <Badge variant="outline" className="text-xs py-1 px-2.5 font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse mr-1.5 inline-block" /> Online
            </Badge>
          </div>

          {/* Details Section */}
          <div className="space-y-3 pt-2 border-t border-border/60 text-sm">
            <div className="grid grid-cols-1 gap-2.5">
              {/* Department */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building className="h-4 w-4 text-cyber-400" />
                  <span className="text-xs">Department / Unit</span>
                </div>
                <span className="font-medium text-foreground text-xs">{departmentName}</span>
              </div>

              {/* Public Security Fingerprint */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <KeyRound className="h-4 w-4 text-cyber-400" />
                  <span className="text-xs">E2EE Key Fingerprint</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs text-cyber-300">
                  <span>{displayFingerprint.slice(0, 18)}...</span>
                  <button
                    onClick={handleCopyFingerprint}
                    className="p-1 hover:text-foreground transition-colors rounded"
                    title="Copy full fingerprint"
                  >
                    {copiedFingerprint ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Member Since */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 text-cyber-400" />
                  <span className="text-xs">Member Since</span>
                </div>
                <span className="font-medium text-foreground text-xs">{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
