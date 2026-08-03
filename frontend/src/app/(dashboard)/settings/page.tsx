"use client"

import { useEffect, useState, useRef } from "react"
import {
  User, Bell, Shield, Loader2, Check, Key, Smartphone, Mail,
  MailOpen, Globe, Github, Linkedin, Twitter, MapPin, Phone, Briefcase,
  Building2, Quote, Download, Trash2, Link2, Clock, Palette,
  Eye, ToggleLeft, ToggleRight, Camera, Plus, X
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { api } from "@/lib/api"
import { useUIStore } from "@/store/useUIStore"
import { useAuthStore } from "@/store/useAuthStore"
import { getAvatarUrl } from "@/lib/utils"
import toast from "react-hot-toast"

interface UserProfile {
  id: string
  email: string
  name: string
  role: string
  isMFAEnabled: boolean
  isVerified: boolean
  phone?: string
  location?: string
  jobTitle?: string
  department?: string
  bio?: string
  avatar?: string
  socialLinks?: { github?: string; linkedin?: string; twitter?: string; website?: string }
  connectedAccounts?: { provider: string; email: string; connected: boolean }[]
  createdAt?: string
  lastLogin?: string | null
  lastLoginDevice?: string | null
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notifLoading, setNotifLoading] = useState(true)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [location, setLocation] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [department, setDepartment] = useState("")
  const [bio, setBio] = useState("")
  const [socialGithub, setSocialGithub] = useState("")
  const [socialLinkedin, setSocialLinkedin] = useState("")
  const [socialTwitter, setSocialTwitter] = useState("")
  const [socialWebsite, setSocialWebsite] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [notifEmail, setNotifEmail] = useState(true)
  const [notifPush, setNotifPush] = useState(true)
  const [notifInApp, setNotifInApp] = useState(true)
  const [quietHours, setQuietHours] = useState(false)
  const [quietHoursFrom, setQuietHoursFrom] = useState("22:00")
  const [quietHoursTo, setQuietHoursTo] = useState("07:00")

  const [profileVisible, setProfileVisible] = useState(true)
  const [activityVisible, setActivityVisible] = useState(true)
  const [searchIndexing, setSearchIndexing] = useState(false)
  const [shareUsageData, setShareUsageData] = useState(true)

  const [emailSignature, setEmailSignature] = useState("")
  const [savingSettings, setSavingSettings] = useState(false)

  // Security Modals & Interactive Logic
  const [showSessionsModal, setShowSessionsModal] = useState(false)
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null)

  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [loginHistory, setLoginHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [showSmsModal, setShowSmsModal] = useState(false)
  const [smsPhone, setSmsPhone] = useState("")
  const [enablingSms, setEnablingSms] = useState(false)

  const [showDisableMfaModal, setShowDisableMfaModal] = useState(false)
  const [disableMfaPassword, setDisableMfaPassword] = useState("")
  const [disablingMfa, setDisablingMfa] = useState(false)

  const fetchSessions = async () => {
    setLoadingSessions(true)
    setShowSessionsModal(true)
    try {
      const data = await api.get<any[]>("/auth/sessions")
      setSessions(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Failed to fetch active sessions")
    } finally {
      setLoadingSessions(false)
    }
  }

  const revokeSession = async (id: string) => {
    setRevokingSessionId(id)
    try {
      await api.delete(`/auth/sessions/${id}`)
      if (id === "all") {
        setSessions(prev => prev.filter(s => s.isCurrent))
        toast.success("All other sessions revoked")
      } else {
        setSessions(prev => prev.filter(s => s.id !== id))
        toast.success("Session revoked")
      }
    } catch {
      toast.error("Failed to revoke session")
    } finally {
      setRevokingSessionId(null)
    }
  }

  const fetchLoginHistory = async () => {
    setLoadingHistory(true)
    setShowHistoryModal(true)
    try {
      const data = await api.get<any>("/audit?limit=30")
      const items = data?.items || data || []
      const filtered = (Array.isArray(items) ? items : []).filter((i: any) => 
        String(i.action || "").includes("AUTH_") || 
        String(i.action || "").includes("LOGIN") ||
        String(i.entity || "").includes("user")
      )
      setLoginHistory(filtered.length > 0 ? filtered : (Array.isArray(items) ? items.slice(0, 10) : []))
    } catch {
      toast.error("Failed to fetch login history")
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleEnableSms = async () => {
    if (!smsPhone || smsPhone.length < 7) {
      toast.error("Please enter a valid phone number")
      return
    }
    setEnablingSms(true)
    try {
      await api.patch("/users/me", { phone: smsPhone })
      toast.success("SMS 2FA enabled! Verification code sent to " + smsPhone)
      setPhone(smsPhone)
      setShowSmsModal(false)
    } catch {
      toast.error("Failed to enable SMS authentication")
    } finally {
      setEnablingSms(false)
    }
  }

  const handleDisableMfa = async () => {
    if (!disableMfaPassword.trim()) {
      toast.error("Enter your password to confirm")
      return
    }
    setDisablingMfa(true)
    try {
      await api.post("/auth/mfa/disable", { password: disableMfaPassword })
      setProfile(prev => prev ? { ...prev, isMFAEnabled: false } : prev)
      toast.success("MFA disabled successfully")
      setShowDisableMfaModal(false)
      setDisableMfaPassword("")
    } catch {
      toast.error("Failed to disable MFA. Check your password.")
    } finally {
      setDisablingMfa(false)
    }
  }

  const fetchNotifs = () => {
    api.get<any>("/notifications?limit=50")
      .then(r => setNotifications(r.items || []))
      .catch(() => {})
      .finally(() => setNotifLoading(false))
  }

  useEffect(() => {
    api.get<UserProfile & { settings?: any }>("/users/me")
      .then(u => {
        setProfile(u)
        setName(u.name)
        setEmail(u.email)
        setPhone(u.phone || "")
        setLocation(u.location || "")
        setJobTitle(u.jobTitle || "")
        setDepartment(u.department || "")
        setBio(u.bio || "")
        setSocialGithub(u.socialLinks?.github || "")
        setSocialLinkedin(u.socialLinks?.linkedin || "")
        setSocialTwitter(u.socialLinks?.twitter || "")
        setSocialWebsite(u.socialLinks?.website || "")
        const s = u.settings || {}
        setNotifEmail(s.notifications?.email ?? true)
        setNotifPush(s.notifications?.push ?? true)
        setNotifInApp(s.notifications?.inApp ?? true)
        setQuietHours(s.notifications?.quietHours ?? false)
        setQuietHoursFrom(s.notifications?.quietHoursFrom ?? "22:00")
        setQuietHoursTo(s.notifications?.quietHoursTo ?? "07:00")
        setProfileVisible(s.privacy?.profileVisibility ?? true)
        setActivityVisible(s.privacy?.activityStatus ?? true)
        setSearchIndexing(s.privacy?.searchIndexing ?? false)
        setShareUsageData(s.privacy?.shareUsageData ?? true)
        setEmailSignature(s.emailSignature || "")
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    fetchNotifs()
  }, [])

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch {
      toast.error("Failed to mark notification as read")
    }
  }

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all")
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      toast.success("All marked as read")
    } catch {
      toast.error("Failed to mark notifications as read")
    }
  }

  const [emailChangePassword, setEmailChangePassword] = useState("")
  const [showEmailPasswordPrompt, setShowEmailPasswordPrompt] = useState(false)

  const saveProfile = async () => {
    const emailChanged = email !== profile?.email
    if (emailChanged && !emailChangePassword) {
      setShowEmailPasswordPrompt(true)
      return
    }
    setSaving(true)
    try {
      const body: any = {
        name, email, phone, location, jobTitle, department, bio,
        socialLinks: {
          github: socialGithub,
          linkedin: socialLinkedin,
          twitter: socialTwitter,
          website: socialWebsite,
        },
      }
      if (emailChanged) body.currentPassword = emailChangePassword
      const updated = await api.patch<UserProfile>("/users/me", body)
      setProfile(prev => prev ? { ...prev, ...updated } : prev)
      setEmailChangePassword(""); setShowEmailPasswordPrompt(false)
      toast.success(emailChanged ? "Profile updated — please verify your new email" : "Profile updated")
    } catch (e: any) {
      if (e?.status === 401) {
        toast.error("Session expired. Please log in again.")
        return
      }
      const msg = e?.data?.message || e?.message || "Failed to update"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const passwordStrength = (pw: string): { score: number; label: string; color: string } => {
    let s = 0
    if (pw.length >= 8) s++
    if (pw.length >= 12) s++
    if (/[A-Z]/.test(pw)) s++
    if (/[0-9]/.test(pw)) s++
    if (/[^A-Za-z0-9]/.test(pw)) s++
    const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong"]
    const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"]
    return { score: s, label: labels[Math.min(s, 4)], color: colors[Math.min(s, 4)] }
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) { toast.error("Fill in all password fields"); return }
    if (newPassword.length < 8) { toast.error("New password must be at least 8 characters"); return }
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match"); return }
    if (newPassword === currentPassword) { toast.error("New password must differ from current password"); return }
    setShowPasswordConfirm(true)
  }

  const doChangePassword = async () => {
    setChangingPassword(true); setShowPasswordConfirm(false)
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword })
      toast.success("Password updated — please log in again")
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("")
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to change password")
    } finally {
      setChangingPassword(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image must be under 20MB")
      return
    }
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const updated = await api.upload<UserProfile>("/users/avatar", formData)
      setProfile(prev => prev ? { ...prev, avatar: updated.avatar } : prev)
      const currentUser = useAuthStore.getState().user
      if (currentUser) {
        useAuthStore.getState().setUser({ ...currentUser, avatar: updated.avatar })
      }
      toast.success("Photo updated")
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to upload photo")
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleConnectAccount = async (provider: string) => {
    try {
      const res = await api.post<{ url: string }>(`/auth/connect/${provider}`)
      window.location.href = res.url
    } catch {
      toast.error(`Failed to connect ${provider}`)
    }
  }

  const handleDisconnectAccount = async (provider: string) => {
    try {
      await api.post(`/auth/disconnect/${provider}`)
      setProfile(prev => prev ? {
        ...prev,
        connectedAccounts: (prev.connectedAccounts || []).map(a =>
          a.provider === provider ? { ...a, connected: false } : a
        )
      } : prev)
      toast.success(`${provider} disconnected`)
    } catch {
      toast.error(`Failed to disconnect ${provider}`)
    }
  }

  const handleExportData = async () => {
    try {
      const data = await api.post<any>("/users/export")
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `stegshield-export-${new Date().toISOString().slice(0, 10)}.json`; a.click()
      URL.revokeObjectURL(url)
      toast.success("Data exported")
    } catch {
      toast.error("Failed to export data")
    }
  }

  const handleDeleteAccount = async () => {
    setDeletingAccount(true)
    try {
      await api.delete("/users/me")
      toast.success("Account deleted")
      setTimeout(() => { window.location.href = "/login" }, 2000)
    } catch {
      toast.error("Failed to delete account")
    } finally {
      setDeletingAccount(false); setShowDeleteConfirm(false)
    }
  }

  const saveSettings = async (settings: Record<string, any>) => {
    setSavingSettings(true)
    try {
      await api.patch("/users/me/settings", settings)
    } catch { /* ignore */ }
    setSavingSettings(false)
  }

  const toggleNotifEmail = () => {
    const next = !notifEmail; setNotifEmail(next)
    saveSettings({ notifications: { email: next, push: notifPush, inApp: notifInApp, quietHours, quietHoursFrom, quietHoursTo } })
  }
  const toggleNotifPush = () => {
    const next = !notifPush; setNotifPush(next)
    saveSettings({ notifications: { email: notifEmail, push: next, inApp: notifInApp, quietHours, quietHoursFrom, quietHoursTo } })
  }
  const toggleNotifInApp = () => {
    const next = !notifInApp; setNotifInApp(next)
    saveSettings({ notifications: { email: notifEmail, push: notifPush, inApp: next, quietHours, quietHoursFrom, quietHoursTo } })
  }
  const toggleQuietHours = () => {
    const next = !quietHours; setQuietHours(next)
    saveSettings({ notifications: { email: notifEmail, push: notifPush, inApp: notifInApp, quietHours: next, quietHoursFrom, quietHoursTo } })
  }

  const currentTheme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const { setTheme: setNextTheme } = useTheme()

  const allThemes = [
    { label: "Light", value: "light" as const, bg: "bg-white border" },
    { label: "Dark", value: "dark" as const, bg: "bg-gray-900" },
    { label: "Cyberpunk", value: "cyberpunk" as const, bg: "bg-purple-900" },
    { label: "Midnight", value: "midnight" as const, bg: "bg-blue-950" },
    { label: "Forest", value: "forest" as const, bg: "bg-green-950" },
    { label: "Sunset", value: "sunset" as const, bg: "bg-orange-950" },
  ]

  const handleThemeChange = (theme: "light" | "dark" | "cyberpunk" | "midnight" | "forest" | "sunset") => {
    setTheme(theme)
    setNextTheme(theme)
    toast.success(`Theme set to ${theme}`)
  }

  const connectedAccounts = profile?.connectedAccounts || [
    { provider: "Google", email: "sreekarsh44@gmail.com", connected: true },
    { provider: "GitHub", email: "", connected: false },
    { provider: "Microsoft", email: "", connected: false },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="Manage your account, security, and preferences" />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-cyber-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account, security, and preferences" />

      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="account"><User className="mr-2 h-4 w-4" /> Account</TabsTrigger>
          <TabsTrigger value="security"><Shield className="mr-2 h-4 w-4" /> Security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="mr-2 h-4 w-4" /> Appearance</TabsTrigger>
          <TabsTrigger value="connected"><Link2 className="mr-2 h-4 w-4" /> Connected</TabsTrigger>
          <TabsTrigger value="privacy"><Eye className="mr-2 h-4 w-4" /> Privacy</TabsTrigger>
        </TabsList>

        {/* ============ ACCOUNT ============ */}
        <TabsContent value="account">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal details and contact information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Full Name</label>
                      <Input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Email Address</label>
                      <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block"><Phone className="inline h-3.5 w-3.5 mr-1" /> Phone Number</label>
                      <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block"><MapPin className="inline h-3.5 w-3.5 mr-1" /> Location</label>
                      <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="San Francisco, CA" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block"><Briefcase className="inline h-3.5 w-3.5 mr-1" /> Job Title</label>
                      <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Security Engineer" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block"><Building2 className="inline h-3.5 w-3.5 mr-1" /> Department</label>
                      <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Engineering" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block"><Quote className="inline h-3.5 w-3.5 mr-1" /> Bio</label>
                    <textarea
                      className="flex min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-y"
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="Tell us a little about yourself..."
                    />
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-3">Social Links</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block"><Github className="inline h-3 w-3 mr-1" /> GitHub</label>
                        <Input value={socialGithub} onChange={e => setSocialGithub(e.target.value)} placeholder="https://github.com/username" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block"><Linkedin className="inline h-3 w-3 mr-1" /> LinkedIn</label>
                        <Input value={socialLinkedin} onChange={e => setSocialLinkedin(e.target.value)} placeholder="https://linkedin.com/in/username" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block"><Twitter className="inline h-3 w-3 mr-1" /> Twitter</label>
                        <Input value={socialTwitter} onChange={e => setSocialTwitter(e.target.value)} placeholder="https://twitter.com/username" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block"><Globe className="inline h-3 w-3 mr-1" /> Website</label>
                        <Input value={socialWebsite} onChange={e => setSocialWebsite(e.target.value)} placeholder="https://yoursite.com" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <Badge variant="cyber">{profile?.role || "User"}</Badge>
                    <Button variant="cyber" onClick={saveProfile} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Profile Photo</CardTitle>
                  <CardDescription>Upload your photo</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <Avatar className="h-28 w-28 ring-4 ring-cyber-500/20">
                    <AvatarImage src={getAvatarUrl(profile?.avatar)} />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-cyber-500 to-purple-600 text-white">
                      {profile?.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                    {uploadingAvatar ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    {uploadingAvatar ? "Uploading..." : "Upload Photo"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">JPG, PNG, GIF or WebP. Max 20MB.</p>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Account Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Member since</span><span>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : "—"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Last login</span><span>{profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "—"}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">2FA</span><Badge variant={profile?.isMFAEnabled ? "success" : "outline"} className="text-[10px]">{profile?.isMFAEnabled ? "Enabled" : "Not set"}</Badge></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Email verified</span><Badge variant={profile?.isVerified ? "success" : "outline"} className="text-[10px]">{profile?.isVerified ? "Verified" : "Unverified"}</Badge></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Connected apps</span><span>{connectedAccounts.filter(a => a.connected).length}</span></div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ============ SECURITY ============ */}
        <TabsContent value="security">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>Update your account password</CardDescription>
              </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Current Password</label>
                    <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">New Password</label>
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    {newPassword.length > 0 && (() => {
                      const { score, label, color } = passwordStrength(newPassword)
                      return (
                        <div className="mt-2 space-y-1">
                          <div className="flex gap-1">{[0,1,2,3,4].map(i => (<div key={i} className={`h-1 flex-1 rounded-full ${i < score ? color : 'bg-muted'}`} />))}</div>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      )
                    })()}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Confirm New Password</label>
                    <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                      <p className="text-[10px] text-destructive mt-1">Passwords do not match</p>
                    )}
                    {confirmPassword.length > 0 && newPassword === confirmPassword && (
                      <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1"><Check className="h-3 w-3" /> Passwords match</p>
                    )}
                  </div>
                  <Button variant="cyber" className="w-full" onClick={handleChangePassword} disabled={changingPassword}>
                    {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
                    Update Password
                  </Button>
                </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Multi-Factor Authentication</CardTitle>
                <CardDescription>Add extra security to your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Authenticator App</p>
                    <p className="text-xs text-muted-foreground">TOTP-based 2FA</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={profile?.isMFAEnabled ? "success" : "outline"}>{profile?.isMFAEnabled ? "Enabled" : "Not Enabled"}</Badge>
                    {profile?.isMFAEnabled ? (
                      <Button variant="destructive" size="sm" onClick={() => setShowDisableMfaModal(true)}>Disable</Button>
                    ) : (
                      <Link href="/mfa">
                        <Button variant="outline" size="sm"><Smartphone className="mr-1 h-3 w-3" /> Setup</Button>
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">SMS Authentication</p>
                    <p className="text-xs text-muted-foreground">Receive codes via text message</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setSmsPhone(phone || ""); setShowSmsModal(true) }}>Enable</Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Active Sessions</p>
                    <p className="text-xs text-muted-foreground">Manage logged-in devices</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchSessions}>
                    View
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Login History</p>
                    <p className="text-xs text-muted-foreground">Review recent sign-ins</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchLoginHistory}>
                    <Clock className="mr-1 h-3 w-3" /> Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ NOTIFICATIONS ============ */}
        <TabsContent value="notifications">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose how you receive notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive updates via email</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={toggleNotifEmail}>
                    {notifEmail ? <ToggleRight className="h-6 w-6 text-cyber-500" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Push Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive push notifications on your devices</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={toggleNotifPush}>
                    {notifPush ? <ToggleRight className="h-6 w-6 text-cyber-500" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">In-App Notifications</p>
                    <p className="text-xs text-muted-foreground">Show notifications within the app</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={toggleNotifInApp}>
                    {notifInApp ? <ToggleRight className="h-6 w-6 text-cyber-500" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Quiet Hours</p>
                    <p className="text-xs text-muted-foreground">Mute notifications during set hours</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={toggleQuietHours}>
                    {quietHours ? <ToggleRight className="h-6 w-6 text-cyber-500" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </Button>
                </div>
                {quietHours && (
                  <div className="grid grid-cols-2 gap-3 pl-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">From</label>
                      <Input type="time" value={quietHoursFrom} onChange={e => { setQuietHoursFrom(e.target.value); saveSettings({ notifications: { email: notifEmail, push: notifPush, inApp: notifInApp, quietHours, quietHoursFrom: e.target.value, quietHoursTo } }) }} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">To</label>
                      <Input type="time" value={quietHoursTo} onChange={e => { setQuietHoursTo(e.target.value); saveSettings({ notifications: { email: notifEmail, push: notifPush, inApp: notifInApp, quietHours, quietHoursFrom, quietHoursTo: e.target.value } }) }} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Notifications</CardTitle>
                  <Button variant="outline" size="sm" onClick={markAllRead} disabled={notifications.every(n => n.isRead)}>
                    <MailOpen className="mr-1 h-3 w-3" /> Mark All Read
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {notifLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : notifications.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No notifications yet</p>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {notifications.map((n: any) => (
                      <div key={n.id} className={`flex items-start justify-between p-3 rounded-lg transition-colors ${n.isRead ? "bg-muted/20" : "bg-muted/40 border-l-2 border-cyber-500"}`}>
                        <div className="flex items-start gap-3 min-w-0">
                          {n.isRead ? <MailOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" /> : <Mail className="h-4 w-4 text-cyber-400 mt-0.5 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{n.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                        {!n.isRead && (
                          <Button variant="ghost" size="icon" className="shrink-0 ml-2" onClick={() => markRead(n.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ APPEARANCE ============ */}
        <TabsContent value="appearance">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Choose your preferred color theme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {allThemes.map((t) => {
                  const active = currentTheme === t.value
                  return (
                    <div
                      key={t.value}
                      className={`p-4 rounded-lg border text-center cursor-pointer transition-all ${
                        active ? "border-cyber-500 ring-2 ring-cyber-500/30" : "border-border hover:border-cyber-500/50"
                      }`}
                      onClick={() => handleThemeChange(t.value)}
                    >
                      <div className={`h-20 rounded-lg mb-2 ${t.bg} relative flex items-center justify-center`}>
                        {active && <Check className="h-6 w-6 text-cyber-400" />}
                      </div>
                      <p className="text-sm font-medium">{t.label}</p>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ CONNECTED ACCOUNTS ============ */}
        <TabsContent value="connected">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Connected Accounts</CardTitle>
                <CardDescription>Link your external accounts for seamless integration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {connectedAccounts.map((acct) => (
                  <div key={acct.provider} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        {acct.provider === "Google" ? (
                          <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        ) : acct.provider === "GitHub" ? (
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                        ) : (
                          <svg className="h-5 w-5" viewBox="0 0 23 23" fill="currentColor"><path d="M0 0h11v11H0V0zm12 0h11v11H12V0zM0 12h11v11H0V12zm12 0h11v11H12V12z"/></svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{acct.provider}</p>
                        <p className="text-xs text-muted-foreground">
                          {acct.connected ? acct.email : "Not connected"}
                        </p>
                      </div>
                    </div>
                    <div>
                      {acct.connected ? (
                        <Button variant="outline" size="sm" onClick={() => handleDisconnectAccount(acct.provider)}>
                          <X className="mr-1 h-3 w-3" /> Disconnect
                        </Button>
                      ) : (
                        <Button variant="cyber" size="sm" onClick={() => handleConnectAccount(acct.provider)}>
                          <Plus className="mr-1 h-3 w-3" /> Connect
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Email Configuration</CardTitle>
                <CardDescription>Manage your email preferences and signatures</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Primary Email</p>
                    <p className="text-xs text-muted-foreground">{profile?.email || "Not set"}</p>
                  </div>
                  <Badge variant="success">Primary</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Email Forwarding</p>
                    <p className="text-xs text-muted-foreground">Forward emails to another address</p>
                  </div>
                    <Button variant="outline" size="sm" onClick={() => toast.success("Email forwarding coming soon")}>Configure</Button>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email Signature</label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all resize-y"
                    placeholder="-- John Doe | Security Engineer"
                    value={emailSignature}
                    onChange={e => setEmailSignature(e.target.value)}
                  />
                </div>
                <Button variant="cyber" size="sm" onClick={() => saveSettings({ emailSignature })} disabled={savingSettings}>
                  {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Signature
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ PRIVACY ============ */}
        <TabsContent value="privacy">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>Control your data and privacy preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Profile Visibility</p>
                    <p className="text-xs text-muted-foreground">Make your profile visible to other users</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { const next = !profileVisible; setProfileVisible(next); saveSettings({ privacy: { profileVisibility: next, activityStatus: activityVisible, searchIndexing, shareUsageData } }) }}>
                    {profileVisible ? <ToggleRight className="h-6 w-6 text-cyber-500" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Activity Status</p>
                    <p className="text-xs text-muted-foreground">Show when you are active</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { const next = !activityVisible; setActivityVisible(next); saveSettings({ privacy: { profileVisibility: profileVisible, activityStatus: next, searchIndexing, shareUsageData } }) }}>
                    {activityVisible ? <ToggleRight className="h-6 w-6 text-cyber-500" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Search Indexing</p>
                    <p className="text-xs text-muted-foreground">Allow search engines to index your profile</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { const next = !searchIndexing; setSearchIndexing(next); saveSettings({ privacy: { profileVisibility: profileVisible, activityStatus: activityVisible, searchIndexing: next, shareUsageData } }) }}>
                    {searchIndexing ? <ToggleRight className="h-6 w-6 text-cyber-500" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">Share Usage Data</p>
                    <p className="text-xs text-muted-foreground">Help us improve by sharing anonymized usage data</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { const next = !shareUsageData; setShareUsageData(next); saveSettings({ privacy: { profileVisibility: profileVisible, activityStatus: activityVisible, searchIndexing, shareUsageData: next } }) }}>
                    {shareUsageData ? <ToggleRight className="h-6 w-6 text-cyber-500" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Data Management</CardTitle>
                <CardDescription>Export or delete your account data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/30">
                  <div className="flex items-start gap-3">
                    <Download className="h-5 w-5 text-cyber-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Export All Data</p>
                      <p className="text-xs text-muted-foreground mt-1">Download a complete archive of your account data including profile, messages, and files.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={handleExportData}>
                        <Download className="mr-2 h-4 w-4" /> Request Export
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-3">
                    <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-destructive">Delete Account</p>
                      <p className="text-xs text-muted-foreground mt-1">Permanently delete your account and all associated data. This action cannot be undone.</p>
                      <Button variant="destructive" size="sm" className="mt-3" onClick={() => setShowDeleteConfirm(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Account
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={showPasswordConfirm}
        onOpenChange={setShowPasswordConfirm}
        onConfirm={doChangePassword}
        title="Change Password?"
        description="You will be logged out and need to sign in with your new password."
        confirmLabel="Change Password"
        variant="default"
        loading={changingPassword}
      />

      <ConfirmDialog
        open={showEmailPasswordPrompt}
        onOpenChange={(o) => { setShowEmailPasswordPrompt(o); if (!o) setEmailChangePassword("") }}
        onConfirm={saveProfile}
        title="Confirm Current Password"
        description="Enter your current password to change your email address."
        confirmLabel="Confirm"
        variant="default"
        loading={saving}
      >
        <div className="w-full mb-4">
          <Input type="password" value={emailChangePassword} onChange={e => setEmailChangePassword(e.target.value)} placeholder="Current password" autoFocus />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteAccount}
        title="Delete Account?"
        description="This will permanently delete all your data. This action cannot be undone."
        confirmLabel="Delete My Account"
        variant="destructive"
        loading={deletingAccount}
      />

      <ConfirmDialog
        open={showDisableMfaModal}
        onOpenChange={setShowDisableMfaModal}
        onConfirm={handleDisableMfa}
        title="Disable Two-Factor Authentication?"
        description="This will remove MFA from your account. Enter your password to confirm."
        confirmLabel="Disable MFA"
        variant="destructive"
        loading={disablingMfa}
      >
        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">Current Password</label>
          <Input
            type="password"
            placeholder="Enter your password"
            value={disableMfaPassword}
            onChange={(e) => setDisableMfaPassword(e.target.value)}
            autoFocus
          />
        </div>
      </ConfirmDialog>

      {/* Active Sessions Modal */}
      <Dialog open={showSessionsModal} onOpenChange={setShowSessionsModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-cyber-400" />
              Active Sessions
            </DialogTitle>
            <DialogDescription>
              Manage devices currently logged into your StegShield X account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {loadingSessions ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyber-500" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No active sessions found.</p>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {sessions.map((s: any) => (
                  <div key={s.id || s.ip} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{s.device || s.browser || "Unknown Device"}</span>
                        {s.isCurrent && <Badge variant="success" className="text-[10px]">Current Session</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">IP: {s.ip || "Localhost"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Last active: {s.lastActive ? new Date(s.lastActive).toLocaleString() : "Recently"}
                      </p>
                    </div>

                    {!s.isCurrent && (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={revokingSessionId === s.id}
                        onClick={() => revokeSession(s.id)}
                      >
                        {revokingSessionId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Revoke"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {sessions.filter(s => !s.isCurrent).length > 0 && (
              <Button
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10"
                disabled={revokingSessionId === "all"}
                onClick={() => revokeSession("all")}
              >
                Revoke All Other Sessions
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Login History Modal */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-cyber-400" />
              Login & Security Audit History
            </DialogTitle>
            <DialogDescription>
              Review recent authentication events, sign-in attempts, and security logs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyber-500" />
              </div>
            ) : loginHistory.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No recent login events recorded.</p>
            ) : (
              <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                {loginHistory.map((log: any, idx: number) => (
                  <div key={log.id || idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border text-sm">
                    <div>
                      <p className="font-medium text-foreground">{log.action?.replace(/_/g, " ") || "Security Event"}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {log.details?.ip ? `IP: ${log.details.ip}` : "IP: Local/Verified"} {log.details?.provider ? `• Provider: ${log.details.provider}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="text-[10px]">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Recently"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SMS Authentication Modal */}
      <Dialog open={showSmsModal} onOpenChange={setShowSmsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-cyber-400" />
              Enable SMS 2FA
            </DialogTitle>
            <DialogDescription>
              Enter your mobile phone number to receive security verification codes via text message.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Mobile Phone Number</label>
              <Input
                type="tel"
                value={smsPhone}
                onChange={e => setSmsPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
              />
            </div>

            <Button
              variant="cyber"
              className="w-full"
              disabled={enablingSms}
              onClick={handleEnableSms}
            >
              {enablingSms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enable SMS Security
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
