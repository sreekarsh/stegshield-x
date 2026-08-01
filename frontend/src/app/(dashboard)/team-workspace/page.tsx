"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  Users, Loader2, Mail, Trash2, Shield, ShieldCheck, ShieldAlert,
  UserPlus, MoreHorizontal, Check, X, LogOut, Building2, AlertTriangle,
  RefreshCw, Search, Copy, Activity, FileText, FolderGit2, Link2, Send,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { api, ApiError } from "@/lib/api"
import { UserProfileModal, type UserProfileData } from "@/components/UserProfileModal"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

interface Member {
  id: string
  role: string
  user?: {
    id: string
    name: string | null
    email: string
    role: string
    createdAt: string
  } | null
}

interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  myRole: string
  createdAt: string
}

interface Invitation {
  id: string
  email: string
  role: string
  token: string
  status: string
  createdAt: string
  organization?: { id: string; name: string }
}

interface TeamStats {
  totalMembers: number
  ownerCount?: number
  adminCount: number
  editorCount: number
  investigatorCount?: number
  viewerCount: number
  evidenceCount: number
  casesCount: number
  pendingInvitesCount: number
  myRole: string
  plan: string
}

interface ActivityLog {
  id: string
  userName: string
  action: string
  resource: string
  createdAt: string
  ip: string
}

const ROLE_ICONS: Record<string, typeof Shield> = {
  OWNER: ShieldAlert,
  ADMIN: ShieldAlert,
  EDITOR: ShieldCheck,
  INVESTIGATOR: Search,
  VIEWER: Shield,
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: "text-purple-400",
  ADMIN: "text-cyber-400",
  EDITOR: "text-emerald-400",
  INVESTIGATOR: "text-amber-400",
  VIEWER: "text-slate-400",
}

export default function TeamWorkspacePage() {
  const router = useRouter()
  const [org, setOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([])
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [activity, setActivity] = useState<ActivityLog[]>([])

  const [profileUser, setProfileUser] = useState<UserProfileData | null>(null)
  const [showProfileModal, setShowProfileModal] = useState(false)

  const openProfile = (userObj: UserProfileData) => {
    setProfileUser(userObj)
    setShowProfileModal(true)
  }

  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("VIEWER")
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [changingRole, setChangingRole] = useState<string | null>(null)
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [activeTab, setActiveTab] = useState("members")

  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("ALL")
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [orgData, membersData, invitesData, statsData, activityData, sentData] = await Promise.all([
        api.get<Organization>("/team/organization").catch(() => null),
        api.get<Member[]>("/team/members").catch(() => [] as Member[]),
        api.get<Invitation[]>("/team/invitations").catch(() => []),
        api.get<TeamStats>("/team/stats").catch(() => null),
        api.get<ActivityLog[]>("/team/activity").catch(() => []),
        api.get<Invitation[]>("/team/invitations/sent").catch(() => []),
      ])
      setOrg(orgData)
      setMembers(membersData)
      setInvitations(invitesData)
      setStats(statsData)
      setActivity(activityData)
      setSentInvitations(sentData)
    } catch {
      setFetchError("Failed to load team data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleInvite = async () => {
    if (!inviteEmail) { toast.error("Enter an email address"); return }
    if (!inviteEmail.includes("@")) { toast.error("Enter a valid email"); return }
    setInviting(true)
    try {
      const result = await api.post<{ invited: boolean; email: string; status: string }>("/team/invite", { email: inviteEmail, role: inviteRole })
      toast.success(result.status === "pending" ? "Invitation created — sent via email and available in Sent Invites" : "Member added to team")
      setInviteEmail("")
      fetchData()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to invite")
    } finally {
      setInviting(false)
    }
  }

  const removeMember = async (id: string) => {
    setRemovingId(id)
    try {
      await api.delete(`/team/members/${id}`)
      setMembers(prev => prev.filter(m => m.id !== id))
      toast.success("Member removed")
      fetchData()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove member")
    } finally {
      setRemovingId(null)
    }
  }

  const changeRole = async (id: string, role: string) => {
    setChangingRole(id)
    try {
      await api.patch(`/team/members/${id}/role`, { role })
      setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m))
      toast.success(`Role changed to ${role}`)
      fetchData()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update role")
    } finally {
      setChangingRole(null)
    }
  }

  const acceptInvite = async (token: string) => {
    setAcceptingToken(token)
    try {
      await api.post(`/team/invitations/${token}/accept`)
      setInvitations(prev => prev.filter(i => i.token !== token))
      toast.success("Invitation accepted — you're now a member")
      fetchData()
      setActiveTab("members")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to accept invitation")
    } finally {
      setAcceptingToken(null)
    }
  }

  const declineInvite = async (token: string) => {
    setAcceptingToken(token)
    try {
      await api.post(`/team/invitations/${token}/decline`)
      setInvitations(prev => prev.filter(i => i.token !== token))
      toast.success("Invitation declined")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to decline invitation")
    } finally {
      setAcceptingToken(null)
    }
  }

  const revokeSentInvite = async (id: string) => {
    setRevokingId(id)
    try {
      await api.delete(`/team/invitations/sent/${id}`)
      setSentInvitations(prev => prev.filter(i => i.id !== id))
      toast.success("Invitation revoked")
      fetchData()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to revoke invitation")
    } finally {
      setRevokingId(null)
    }
  }

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/invitations/${token}`
    try {
      await navigator.clipboard.writeText(link)
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
      toast.success("Invite link copied to clipboard!")
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const leaveOrg = async () => {
    if (!confirm("Are you sure you want to leave this team? This action cannot be undone.")) return
    setLeaving(true)
    try {
      await api.post("/team/leave")
      toast.success("Left the team")
      setOrg(null)
      setMembers([])
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to leave")
    } finally {
      setLeaving(false)
    }
  }

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const name = m.user?.name?.toLowerCase() || ""
      const email = m.user?.email.toLowerCase() || ""
      const q = searchQuery.toLowerCase()
      const matchesSearch = !q || name.includes(q) || email.includes(q)
      const matchesRole = roleFilter === "ALL" || m.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [members, searchQuery, roleFilter])

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    return email[0].toUpperCase()
  }

  const displayName = (name: string | null, email: string) => name || email.split("@")[0]

  const formatDate = (d: string) => {
    const date = new Date(d)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 3600000) return "Just now"
    if (diff < 86400000) return "Today"
    return date.toLocaleDateString()
  }

  const isAdmin = org?.myRole === "ADMIN"

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={org ? org.name : "Team Workspace"}
        description="Zero-trust collaboration, shared forensic assets, and role-based access control"
      />

      {fetchError && (
        <Card className="glass-card border-destructive/50">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive flex-1">{fetchError}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {stats && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <Users className="h-6 w-6 text-cyber-400 mx-auto mb-1" />
              <div className="text-2xl font-bold">{stats.totalMembers}</div>
              <p className="text-xs text-muted-foreground">Team Members</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <ShieldAlert className="h-6 w-6 text-cyber-400 mx-auto mb-1" />
              <div className="text-xs font-bold flex flex-wrap items-center justify-center gap-1.5 leading-snug">
                <span className="text-purple-400">{stats.ownerCount || 0} Owner</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-cyber-400">{stats.adminCount} Admin</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-emerald-400">{stats.editorCount} Edit</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono mt-1">
                {stats.investigatorCount || 0} Invest. &middot; {stats.viewerCount} View
              </p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <FileText className="h-6 w-6 text-info mx-auto mb-1" />
              <div className="text-2xl font-bold">{stats.evidenceCount}</div>
              <p className="text-xs text-muted-foreground">Team Evidence Files</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <FolderGit2 className="h-6 w-6 text-warning mx-auto mb-1" />
              <div className="text-2xl font-bold">{stats.casesCount}</div>
              <p className="text-xs text-muted-foreground">Active Cases</p>
            </CardContent>
          </Card>
          <Card className="glass-card col-span-2 sm:col-span-4 lg:col-span-1">
            <CardContent className="p-4 text-center">
              <Building2 className="h-6 w-6 text-cyber-400 mx-auto mb-1" />
              <Badge variant="cyber" className="text-[10px] uppercase font-bold">{stats.plan} PLAN</Badge>
              <p className="text-xs text-muted-foreground mt-1">Role: <strong className="text-foreground">{stats.myRole}</strong></p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="mr-2 h-4 w-4" />
            Members ({members.length})
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="invite">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="sent">
              <Send className="mr-2 h-4 w-4" />
              Sent Invites ({sentInvitations.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="pending">
            <Mail className="mr-2 h-4 w-4" />
            Received Invitations
            {invitations.length > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[9px] px-1 py-0">{invitations.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="mr-2 h-4 w-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  {org && <p className="text-xs text-muted-foreground mt-0.5">{org.name} &middot; Organization Slug: <span className="font-mono text-foreground">{org.slug}</span></p>}
                </div>
                <div className="flex items-center gap-2">
                  {org && !isAdmin && (
                    <Button variant="outline" size="sm" onClick={leaveOrg} disabled={leaving}>
                      {leaving ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <LogOut className="mr-1.5 h-3 w-3" />}
                      Leave Team
                    </Button>
                  )}
                  {isAdmin && (
                    <Button variant="cyber" size="sm" onClick={() => setActiveTab("invite")}>
                      <UserPlus className="mr-2 h-3.5 w-3.5" /> Invite Member
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 pr-4 h-9"
                    placeholder="Search member by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {["ALL", "OWNER", "ADMIN", "EDITOR", "INVESTIGATOR", "VIEWER"].map((role) => (
                    <Button
                      key={role}
                      variant={roleFilter === role ? "cyber" : "outline"}
                      size="sm"
                      className="h-8 text-[11px] px-2.5"
                      onClick={() => setRoleFilter(role)}
                    >
                      {role}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyber-400" /></div>
              ) : filteredMembers.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>{searchQuery || roleFilter !== "ALL" ? "No members match filter parameters" : "No team members found."}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((m) => {
                    const RoleIcon = ROLE_ICONS[m.role] || Shield
                    const roleColor = ROLE_COLORS[m.role] || "text-muted-foreground"
                    return (
                      <div key={m.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 group hover:bg-muted/50 transition-colors">
                        <Avatar
                          className="h-10 w-10 ring-2 ring-cyber-500/10 shrink-0 cursor-pointer hover:ring-cyber-500/60 transition-all"
                          onClick={() => openProfile({
                            id: m.user?.id || m.id,
                            name: m.user?.name || undefined,
                            email: m.user?.email || undefined,
                            role: m.role,
                            createdAt: m.user?.createdAt,
                          })}
                          title="Touch to view user details"
                        >
                          <AvatarFallback className="bg-cyber-500/20 text-cyber-400 text-xs font-semibold">
                            {getInitials(m.user?.name ?? null, m.user?.email ?? "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => openProfile({
                            id: m.user?.id || m.id,
                            name: m.user?.name || undefined,
                            email: m.user?.email || undefined,
                            role: m.role,
                            createdAt: m.user?.createdAt,
                          })}
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate hover:text-cyber-400 transition-colors">
                              {displayName(m.user?.name ?? null, m.user?.email ?? "unknown")}
                            </p>
                            {m.role === "ADMIN" && (
                              <Badge variant="cyber" className="text-[9px] px-1.5 py-0">Admin</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{m.user?.email ?? "unknown"}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground mr-2">
                          <span>Joined {formatDate(m.user?.createdAt ?? new Date().toISOString())}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isAdmin && m.role !== "ADMIN" && (
                            <div className="relative group/role">
                              <button
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border border-border hover:border-cyber-500/50 transition-colors"
                              >
                                <RoleIcon className={`h-3 w-3 ${roleColor}`} />
                                {m.role}
                                <MoreHorizontal className="h-3 w-3 text-muted-foreground ml-1" />
                              </button>
                              <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[150px] z-10 hidden group-hover/role:block">
                                {["VIEWER", "INVESTIGATOR", "EDITOR", "ADMIN", "OWNER"].map((r) => (
                                  <button
                                    key={r}
                                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2 ${m.role === r ? "text-cyber-400 font-medium" : "text-muted-foreground"}`}
                                    onClick={() => changeRole(m.id, r)}
                                  >
                                    <Shield className="h-3 w-3" />
                                    {r}
                                    {m.role === r && <Check className="h-3 w-3 ml-auto text-cyber-400" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {!isAdmin && (
                            <Badge variant="outline" className="text-[10px]">
                              <RoleIcon className={`h-3 w-3 mr-1 ${roleColor}`} />
                              {m.role}
                            </Badge>
                          )}
                          {m.role === "ADMIN" && isAdmin && (
                            <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3 text-cyber-400" /> Admin
                            </Badge>
                          )}
                          {isAdmin && m.role !== "ADMIN" && (
                            <button
                              onClick={() => removeMember(m.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all ml-1"
                              title="Remove member"
                            >
                              {removingId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <div className="max-w-lg mx-auto">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-cyber-400" />
                  Invite Team Member
                </CardTitle>
                <CardDescription>
                  Send an email invitation or generate a 7-day secure token link for your colleague.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email Address</label>
                  <Input
                    placeholder="colleague@company.com"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1.5">Role Permission</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { value: "VIEWER", icon: Shield, desc: "Read-only access" },
                      { value: "INVESTIGATOR", icon: Search, desc: "Forensics & Audit" },
                      { value: "EDITOR", icon: ShieldCheck, desc: "Can edit files" },
                      { value: "ADMIN", icon: ShieldAlert, desc: "Full control" },
                      { value: "OWNER", icon: ShieldAlert, desc: "Team Owner" },
                    ].map(({ value, icon: Icon, desc }) => (
                      <button
                        key={value}
                        type="button"
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          inviteRole === value
                            ? "border-cyber-500 bg-cyber-500/10"
                            : "border-border bg-muted/30 hover:border-cyber-500/30"
                        }`}
                        onClick={() => setInviteRole(value)}
                      >
                        <Icon className={`h-4 w-4 mb-1 ${inviteRole === value ? "text-cyber-400" : "text-muted-foreground"}`} />
                        <p className="text-xs font-medium">{value}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <Button variant="cyber" className="w-full" onClick={handleInvite} disabled={inviting}>
                  {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Send Invitation
                </Button>
                <div className="p-3 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground flex items-start gap-2">
                  <Link2 className="h-4 w-4 text-cyber-400 shrink-0 mt-0.5" />
                  <span>
                    If SMTP email is configured, an invitation email is sent automatically. You can also view and copy direct invitation links from the <strong>Sent Invites</strong> tab.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="sent">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Sent Pending Invitations</CardTitle>
                <CardDescription>Active invitation links generated for pending team members</CardDescription>
              </CardHeader>
              <CardContent>
                {sentInvitations.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Send className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No active sent invitations</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sentInvitations.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{inv.email}</p>
                            <Badge variant="outline" className="text-[10px]">{inv.role}</Badge>
                            <Badge variant="warning" className="text-[10px]">Pending</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Created {formatDate(inv.createdAt)} &middot; Valid for 7 days
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyInviteLink(inv.token)}
                          >
                            {copiedToken === inv.token ? <Check className="mr-1.5 h-3.5 w-3.5 text-success" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                            {copiedToken === inv.token ? "Copied" : "Copy Link"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => revokeSentInvite(inv.id)}
                            disabled={revokingId === inv.id}
                          >
                            {revokingId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="pending">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Received Invitations</CardTitle>
              <CardDescription>Invitations received for your email account</CardDescription>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No pending invitations received for your email</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                      <div className="p-2 rounded-lg bg-cyber-500/10">
                        <Building2 className="h-5 w-5 text-cyber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{inv.organization?.name || "Organization"}</p>
                        <p className="text-xs text-muted-foreground">
                          Role: <Badge variant="outline" className="text-[10px] px-1">{inv.role}</Badge>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="cyber"
                          size="sm"
                          onClick={() => acceptInvite(inv.token)}
                          disabled={acceptingToken === inv.token}
                        >
                          {acceptingToken === inv.token ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => declineInvite(inv.token)}
                          disabled={acceptingToken === inv.token}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Team Activity & Audit Feed</CardTitle>
              <CardDescription>Real-time security audit log of team actions</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Activity className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No recent activity logs recorded for team members</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activity.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors text-xs font-mono">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant="outline" className="text-[10px] shrink-0">{log.action}</Badge>
                        <span className="truncate text-foreground font-sans font-medium">{log.userName}</span>
                        <span className="text-muted-foreground font-sans text-xs shrink-0">({log.resource})</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                        <span>{log.ip}</span>
                        <span>{formatDate(log.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <UserProfileModal
        user={profileUser}
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onSendMessage={(userId) => router.push(`/secure-messaging?contactId=${userId}`)}
      />
    </div>
  )
}
