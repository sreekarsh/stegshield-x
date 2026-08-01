"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Users, Activity, Database, AlertTriangle, Shield, Server, Cpu,
  Mail, Search, RefreshCw, UserX, Clock, Globe, X, Bell, Settings,
  BarChart3, LogIn, MessageSquare, FileText, Key, CheckCircle2,
  Wifi, WifiOff, HardDrive, LayoutDashboard, UserCheck, Send,
  ExternalLink, Fingerprint, Eye,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/layout/empty-state"
import { DashboardSkeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useDebounce } from "@/hooks/useDebounce"
import { api, ApiError } from "@/lib/api"
import { useAuthStore } from "@/store/useAuthStore"
import toast from "react-hot-toast"
import type { Role } from "@/types"

interface AdminStats {
  users: number; verifiedUsers: number; evidence: number; messages: number
  keys: number; storageUsed: string; storageBytes: number; systemHealth: string
  uptime: string; activeSessions: number; organizations: number
  forensicsReports: number
}

interface MonitData {
  cpu: number; cpuCores: number; memory: number; memoryUsed: string
  memoryTotal: string; storage: number; storageUsed: string; storageTotal: string
  activeConnections: number; uptime: string; dbHealthy: boolean
  aiHealthy: boolean; platform: string; hostname: string
}

interface AnalyticsData {
  period: string; newUsers: number; newMessages: number; newEvidence: number
  newSessions: number; topActions: { action: string; count: number }[]
  activityTimeline: { time: string; user: string; action: string; resource: string }[]
}

interface AuditLogEntry {
  id: string; userId: string; userName: string; action: string
  resource: string; resourceId?: string; ip: string; userAgent: string
  metadata?: Record<string, unknown>; createdAt: string
}

interface SessionEntry {
  id: string; userId: string; device: string; browser: string; ip: string
  location?: string; isCurrent: boolean; lastActive: string; createdAt: string
  user: { id: string; email: string; name: string }
}

const roleColors: Record<string, string> = {
  admin: "text-purple-400 bg-purple-500/10",
  owner: "text-amber-400 bg-amber-500/10",
  editor: "text-blue-400 bg-blue-500/10",
  viewer: "text-muted-foreground bg-muted/50",
  investigator: "text-cyan-400 bg-cyan-500/10",
}

export default function AdminPanelPage() {
  const currentUser = useAuthStore((s) => s.user)
  const userRole = (currentUser?.role || "investigator").toLowerCase()
  const isMasterHead = currentUser?.email?.toLowerCase() === "sreekarsh44@gmail.com" || userRole === "owner"
  const isAdminOrOwner = userRole === "admin" || userRole === "owner" || isMasterHead

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [monitoring, setMonitoring] = useState<MonitData | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [sessionsTotal, setSessionsTotal] = useState(0)
  const [users, setUsers] = useState<any[]>([])
  const [userTotal, setUserTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userSearch, setUserSearch] = useState("")
  const [userPage, setUserPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null)
  const [auditSearch, setAuditSearch] = useState("")
  const [auditAction, setAuditAction] = useState("")
  const [auditPage, setAuditPage] = useState(1)
  const [sessionPage, setSessionPage] = useState(1)
  const [analyticsPeriod, setAnalyticsPeriod] = useState("7d")
  const [alertTitle, setAlertTitle] = useState("")
  const [alertMessage, setAlertMessage] = useState("")
  const [alertType, setAlertType] = useState("info")
  const [sendingAlert, setSendingAlert] = useState(false)
  const [systemConfig, setSystemConfig] = useState<any>(null)
  const [upgradeRequestedRole, setUpgradeRequestedRole] = useState("ADMIN")
  const [upgradeReason, setUpgradeReason] = useState("")
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false)
  const pageSize = 10

  const debouncedUserSearch = useDebounce(userSearch, 300)
  const debouncedAuditSearch = useDebounce(auditSearch, 300)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, m, a, c] = await Promise.all([
        api.get<AdminStats>("/admin/stats"),
        api.get<MonitData>("/admin/monitoring"),
        api.get<AnalyticsData>(`/admin/analytics?period=${analyticsPeriod}`),
        api.get<any>("/admin/system-config").catch(() => null),
      ])
      setStats(s); setMonitoring(m); setAnalytics(a); setSystemConfig(c)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load admin data")
    } finally {
      setLoading(false)
    }
  }, [analyticsPeriod])

  const fetchUsers = useCallback(async (page: number, search: string) => {
    try {
      const data = await api.get<{ users: any[]; total: number }>(
        `/admin/users?page=${page}&limit=${pageSize}${search ? `&search=${encodeURIComponent(search)}` : ""}`
      )
      setUsers(data.users)
      setUserTotal(data.total)
    } catch (err) {
      console.error("Failed to fetch users:", err)
    }
  }, [])

  const fetchAuditLogs = useCallback(async (page: number, search: string, action: string) => {
    try {
      let url = `/admin/audit-logs?page=${page}&limit=${pageSize}`
      if (search) url += `&search=${encodeURIComponent(search)}`
      if (action) url += `&action=${encodeURIComponent(action)}`
      const data = await api.get<{ logs: AuditLogEntry[]; total: number }>(url)
      setAuditLogs(data.logs)
      setAuditTotal(data.total)
    } catch (err) {
      console.error("Failed to fetch audit logs:", err)
    }
  }, [])

  const fetchSessions = useCallback(async (page: number) => {
    try {
      const data = await api.get<{ sessions: SessionEntry[]; total: number }>(
        `/admin/sessions?page=${page}&limit=${pageSize}`
      )
      setSessions(data.sessions)
      setSessionsTotal(data.total)
    } catch (err) {
      console.error("Failed to fetch sessions:", err)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchUsers(userPage, debouncedUserSearch) }, [userPage, debouncedUserSearch, fetchUsers])
  useEffect(() => { fetchAuditLogs(auditPage, debouncedAuditSearch, auditAction) }, [auditPage, debouncedAuditSearch, auditAction, fetchAuditLogs])
  useEffect(() => { fetchSessions(sessionPage) }, [sessionPage, fetchSessions])

  const handleRoleChange = async (userId: string, role: Role) => {
    setRoleUpdating(userId)
    try {
      await api.patch(`/admin/users/${userId}`, { role })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
      toast.success("Role updated")
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Failed to update role") }
    finally { setRoleUpdating(null) }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`)
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
      setUserTotal(prev => prev - 1)
      toast.success("User deleted")
      setDeleteTarget(null)
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Failed to delete user") }
    finally { setDeleting(false) }
  }

  const handleVerifyUser = async (userId: string) => {
    try {
      await api.patch(`/admin/users/${userId}`, { isVerified: true })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isVerified: true } : u))
      toast.success("User verified")
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Failed to verify user") }
  }

  const handleSendAlert = async () => {
    if (!alertTitle.trim() || !alertMessage.trim()) {
      toast.error("Title and message are required")
      return
    }
    setSendingAlert(true)
    try {
      await api.post("/admin/notifications/broadcast", {
        title: alertTitle, message: alertMessage, type: alertType,
      })
      toast.success("Alert broadcast to all users")
      setAlertTitle(""); setAlertMessage("")
    } catch (err) { toast.error(err instanceof ApiError ? err.message : "Failed to send alert") }
    finally { setSendingAlert(false) }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await api.delete(`/admin/sessions/${sessionId}`)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      setSessionsTotal(prev => prev - 1)
      toast.success("Session revoked")
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to revoke session")
    }
  }

  const handleRequestUpgrade = async () => {
    if (!upgradeReason.trim()) {
      toast.error("Please provide a reason for your upgrade request")
      return
    }
    setSubmittingUpgrade(true)
    try {
      await api.post("/admin/notifications/broadcast", {
        title: `Permission Upgrade Request: ${currentUser?.name || currentUser?.email}`,
        message: `User ${currentUser?.email} (${currentUser?.role}) requested role upgrade to ${upgradeRequestedRole}. Reason: ${upgradeReason}`,
        type: "warning",
      })
      toast.success("Upgrade request submitted to Lead Commander Sree Karsh!")
      setUpgradeReason("")
    } catch {
      toast.error("Failed to submit request")
    } finally {
      setSubmittingUpgrade(false)
    }
  }

  const userTotalPages = Math.ceil(userTotal / pageSize)
  const auditTotalPages = Math.ceil(auditTotal / pageSize)
  const sessionsTotalPages = Math.ceil(sessionsTotal / pageSize)

  const adminStats = [
    { label: "Total Users", value: String(stats?.users || 0), sub: `${stats?.verifiedUsers || 0} verified`, icon: Users, color: "text-cyber-400" },
    { label: "Active Sessions", value: String(monitoring?.activeConnections || 0), sub: `${stats?.organizations || 0} orgs`, icon: LogIn, color: "text-success" },
    { label: "Storage Used", value: stats?.storageUsed || "--", sub: `${stats?.evidence || 0} evidence files`, icon: HardDrive, color: "text-info" },
    { label: "Forensics Reports", value: String(stats?.forensicsReports || 0), sub: `${stats?.messages || 0} messages`, icon: FileText, color: "text-warning" },
  ]

  if (loading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Admin Panel" description="System administration, monitoring, and management" />
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
            <p className="text-lg font-semibold mb-2">Failed to load admin data</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="cyber" onClick={fetchData}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        description="System administration, monitoring, and management"
        action={{ label: "Refresh", icon: RefreshCw, onClick: fetchData }}
      />

      {isMasterHead ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-600/15 to-cyan-500/15 border border-amber-500/30 flex items-center justify-between shadow-[0_0_20px_rgba(245,158,11,0.15)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg border border-amber-400/40 shrink-0">
              👑
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-200 flex items-center gap-2">
                Master Control Room — Lead Commander Sree Karsh
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">OWNER SUPER-ADMIN</Badge>
              </h2>
              <p className="text-xs text-muted-foreground">Full system authority: User role promotion, live session revocation, security policy enforcement, and infrastructure governance.</p>
            </div>
          </div>
        </div>
      ) : userRole === "admin" ? (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-600/15 via-indigo-600/15 to-cyan-500/15 border border-purple-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-lg border border-purple-400/40 shrink-0">
              ⚡
            </div>
            <div>
              <h2 className="text-base font-bold text-purple-200 flex items-center gap-2">
                System Administrator Command Center
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]">ADMINISTRATOR</Badge>
              </h2>
              <p className="text-xs text-muted-foreground">User account controls, infrastructure monitoring, security audit trails, and system alert broadcasts.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-600/15 via-indigo-600/15 to-purple-600/15 border border-cyan-500/30 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-300 font-bold text-xl border border-cyan-400/40 shrink-0">
                🛡️
              </div>
              <div>
                <h2 className="text-lg font-bold text-cyan-200 flex items-center gap-2">
                  Security Operative Workspace
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] uppercase">{currentUser?.role || "INVESTIGATOR"}</Badge>
                </h2>
                <p className="text-xs text-muted-foreground">Authenticated operative identity & forensic tools status console.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Operative Credentials & Status</CardTitle>
                <CardDescription>Verified identity details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between p-2.5 rounded-xl bg-muted/20">
                  <span className="text-muted-foreground">Operative Name</span>
                  <span className="font-semibold text-cyan-200">{currentUser?.name || "Operative"}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-muted/20">
                  <span className="text-muted-foreground">Email Address</span>
                  <span className="font-mono text-xs">{currentUser?.email}</span>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-muted/20">
                  <span className="text-muted-foreground">Current Assigned Role</span>
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px]">{currentUser?.role || "INVESTIGATOR"}</Badge>
                </div>
                <div className="flex justify-between p-2.5 rounded-xl bg-muted/20">
                  <span className="text-muted-foreground">Account Verification</span>
                  <Badge variant={currentUser?.isVerified ? "success" : "outline"} className="text-[10px]">
                    {currentUser?.isVerified ? "Verified Active" : "Pending Verification"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Request Permission Upgrade</CardTitle>
                <CardDescription>Submit an upgrade request to Lead Commander Sree Karsh</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold mb-1.5 block text-muted-foreground">Requested Role</label>
                  <select
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
                    value={upgradeRequestedRole}
                    onChange={(e) => setUpgradeRequestedRole(e.target.value)}
                  >
                    <option value="ADMIN">ADMIN (System Administration)</option>
                    <option value="EDITOR">EDITOR (Content & Evidence Management)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1.5 block text-muted-foreground">Reason / Justification</label>
                  <Input
                    placeholder="Describe why higher security clearances are required..."
                    value={upgradeReason}
                    onChange={(e) => setUpgradeReason(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <Button
                  variant="cyber"
                  className="w-full"
                  disabled={submittingUpgrade}
                  onClick={handleRequestUpgrade}
                >
                  <Send className="h-3.5 w-3.5 mr-2" /> Submit Upgrade Request
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs"><LayoutDashboard className="h-3.5 w-3.5 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="users" className="text-xs"><Users className="h-3.5 w-3.5 mr-1" />Users ({stats?.users || 0})</TabsTrigger>
          <TabsTrigger value="monitoring" className="text-xs"><Activity className="h-3.5 w-3.5 mr-1" />Monitoring</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs"><BarChart3 className="h-3.5 w-3.5 mr-1" />Analytics</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs"><Eye className="h-3.5 w-3.5 mr-1" />Audit Logs</TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs"><Globe className="h-3.5 w-3.5 mr-1" />Sessions</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs"><Bell className="h-3.5 w-3.5 mr-1" />Alerts</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs"><Settings className="h-3.5 w-3.5 mr-1" />Settings</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {adminStats.map((s) => (
              <Card key={s.label} className="glass-card group hover:border-cyber-500/30 transition-all duration-300">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 rounded-lg bg-muted group-hover:bg-cyber-500/10 transition-colors">
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <Badge variant="outline" className="text-[10px]">{s.sub}</Badge>
                  </div>
                  <div className="text-2xl font-bold tracking-tight">{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="glass-card lg:col-span-2">
              <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Database", healthy: monitoring?.dbHealthy, icon: Database },
                    { label: "AI Service", healthy: monitoring?.aiHealthy, icon: Cpu },
                    { label: "Server", healthy: true, icon: Server },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col items-center p-4 rounded-xl bg-muted/30">
                      <div className={`p-2 rounded-full mb-2 ${item.healthy ? "bg-success/10" : "bg-destructive/10"}`}>
                        {item.healthy
                          ? <Wifi className="h-5 w-5 text-success" />
                          : <WifiOff className="h-5 w-5 text-destructive" />
                        }
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                      <Badge variant={item.healthy ? "success" : "destructive"} className="mt-1 text-[10px]">
                        {item.healthy ? "Online" : "Offline"}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">System Health</span>
                    <Badge variant={stats?.systemHealth === "healthy" ? "success" : stats?.systemHealth === "degraded" ? "warning" : "destructive"}>
                      {stats?.systemHealth || "--"}
                    </Badge>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Uptime
                    </span>
                    <span className="font-mono text-xs">{stats?.uptime || "--"}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">Encryption Keys</span>
                    <span className="font-mono text-xs">{stats?.keys || 0}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/20">
                    <span className="text-muted-foreground">Forensics Reports</span>
                    <span className="font-mono text-xs">{stats?.forensicsReports || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle>Resource Usage</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5 text-muted-foreground" />CPU</span>
                    <span className="font-mono text-xs font-medium">{monitoring?.cpu || 0}%</span>
                  </div>
                  <Progress value={monitoring?.cpu || 0} className="h-2" indicatorClassName={monitoring && monitoring.cpu > 80 ? "bg-destructive" : monitoring && monitoring.cpu > 50 ? "bg-warning" : ""} />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-1.5"><Database className="h-3.5 w-3.5 text-muted-foreground" />Memory</span>
                    <span className="font-mono text-xs font-medium">{monitoring?.memory || 0}%</span>
                  </div>
                  <Progress value={monitoring?.memory || 0} className="h-2" indicatorClassName={monitoring && monitoring.memory > 80 ? "bg-destructive" : monitoring && monitoring.memory > 50 ? "bg-warning" : ""} />
                  <p className="text-[10px] text-muted-foreground mt-1">{monitoring?.memoryUsed} / {monitoring?.memoryTotal}</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5 text-muted-foreground" />Storage</span>
                    <span className="font-mono text-xs font-medium">{monitoring?.storage || 0}%</span>
                  </div>
                  <Progress value={monitoring?.storage || 0} className="h-2" />
                  <p className="text-[10px] text-muted-foreground mt-1">{monitoring?.storageUsed} / {monitoring?.storageTotal}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {analytics && analytics.activityTimeline.length > 0 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest actions across the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {analytics.activityTimeline.slice(0, 15).map((entry, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 text-sm">
                        <div className="h-2 w-2 rounded-full bg-cyber-400 shrink-0" />
                        <span className="text-muted-foreground text-xs shrink-0 font-mono">
                          {new Date(entry.time).toLocaleTimeString()}
                        </span>
                        <span className="font-medium text-xs">{entry.user}</span>
                        <span className="text-muted-foreground text-xs">{entry.action}</span>
                        <span className="text-muted-foreground text-xs truncate">{entry.resource}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* USERS TAB */}
        <TabsContent value="users">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search users by name or email..."
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setUserPage(1) }}
                  />
                  {userSearch && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => { setUserSearch(""); setUserPage(1) }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {userTotal} user{userTotal !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="success" className="text-xs">
                    {stats?.verifiedUsers || 0} verified
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {users.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={userSearch ? "No users match your search" : "No users found"}
                  description={userSearch ? "Try a different search term." : "No users have been created yet."}
                />
              ) : (
                <div className="space-y-1">
                  {users.map((u) => {
                    const isUserMaster = u.email.toLowerCase() === "sreekarsh44@gmail.com"
                    return (
                      <div key={u.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            isUserMaster ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-gradient-to-br from-cyber-500/30 to-purple-600/30 text-cyber-400"
                          }`}>
                            {isUserMaster ? "👑" : (u.name ? u.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) : u.email[0].toUpperCase())}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate flex items-center gap-2">
                              {u.name || u.email.split("@")[0]}
                              {isUserMaster && (
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px]">👑 Master Head</Badge>
                              )}
                              {u._count && (
                                <span className="text-[10px] text-muted-foreground">
                                  {u._count.sessions} sessions · {u._count.evidence} evidence · {u._count.auditLogs} audits
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <Mail className="h-3 w-3 shrink-0" />{u.email}
                              <span className="mx-1">·</span>
                              <span className="text-[10px]">{new Date(u.createdAt).toLocaleDateString()}</span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${roleColors[u.role.toLowerCase()] || ""}`}>
                            {u.role}
                          </span>
                          <select
                            className="h-7 rounded-md border border-input bg-background px-1.5 text-[10px]"
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                            disabled={roleUpdating === u.id || isUserMaster}
                          >
                            <option value="VIEWER">Viewer</option>
                            <option value="EDITOR">Editor</option>
                            <option value="INVESTIGATOR">Investigator</option>
                            <option value="ADMIN">Admin</option>
                            <option value="OWNER">Owner</option>
                          </select>
                          {!u.isVerified && (
                            <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => handleVerifyUser(u.id)}>
                              <Mail className="h-3 w-3 mr-1" /> Verify
                            </Button>
                          )}
                          <div className="flex items-center gap-1">
                            {u.isMFAEnabled && <Fingerprint className="h-3 w-3 text-cyan-400" />}
                            <Shield className={`h-3.5 w-3.5 ${u.isVerified ? "text-success" : "text-muted-foreground/50"}`} />
                          </div>
                          {!isUserMaster && (
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive"
                              onClick={() => setDeleteTarget(u)}
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {userTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground">Page {userPage} of {userTotalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={userPage >= userTotalPages} onClick={() => setUserPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MONITORING TAB */}
        <TabsContent value="monitoring">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="glass-card lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>System Metrics</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono">{monitoring?.hostname}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "CPU Usage", value: `${monitoring?.cpu || 0}%`, detail: `${monitoring?.cpuCores || 0} cores`, color: monitoring && monitoring.cpu > 80 ? "text-destructive" : monitoring && monitoring.cpu > 50 ? "text-warning" : "text-success" },
                    { label: "Memory Usage", value: `${monitoring?.memory || 0}%`, detail: `${monitoring?.memoryUsed} / ${monitoring?.memoryTotal}`, color: monitoring && monitoring.memory > 80 ? "text-destructive" : monitoring && monitoring.memory > 50 ? "text-warning" : "text-success" },
                    { label: "Storage", value: `${monitoring?.storage || 0}%`, detail: `${monitoring?.storageUsed} / ${monitoring?.storageTotal}`, color: "text-info" },
                  ].map((m) => (
                    <div key={m.label} className="p-4 rounded-xl bg-muted/30">
                      <div className={`text-2xl font-bold font-mono ${m.color}`}>{m.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{m.detail}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>CPU</span><span className="font-mono text-xs">{monitoring?.cpu || 0}%</span></div>
                    <Progress value={monitoring?.cpu || 0} className="h-2.5" indicatorClassName={monitoring && monitoring.cpu > 80 ? "bg-destructive" : monitoring && monitoring.cpu > 50 ? "bg-warning" : "bg-success"} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Memory</span><span className="font-mono text-xs">{monitoring?.memory || 0}%</span></div>
                    <Progress value={monitoring?.memory || 0} className="h-2.5" indicatorClassName={monitoring && monitoring.memory > 80 ? "bg-destructive" : monitoring && monitoring.memory > 50 ? "bg-warning" : "bg-success"} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Storage</span><span className="font-mono text-xs">{monitoring?.storage || 0}%</span></div>
                    <Progress value={monitoring?.storage || 0} className="h-2.5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Active Connections</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold font-mono">{monitoring?.activeConnections || 0}</span>
                    <span className="text-xs text-muted-foreground mb-1">sessions</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Platform</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">OS</span><span className="font-mono text-xs">{monitoring?.platform || "--"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Host</span><span className="font-mono text-xs">{monitoring?.hostname || "--"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Uptime</span><span className="font-mono text-xs">{monitoring?.uptime || "--"}</span></div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Service Status</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                    <span>Database</span>
                    <Badge variant={monitoring?.dbHealthy ? "success" : "destructive"} className="text-[10px]">{monitoring?.dbHealthy ? "Connected" : "Down"}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/30">
                    <span>AI Service</span>
                    <Badge variant={monitoring?.aiHealthy ? "success" : "destructive"} className="text-[10px]">{monitoring?.aiHealthy ? "Online" : "Offline"}</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Period:</span>
              {["24h", "7d", "30d", "90d"].map((p) => (
                <Button
                  key={p} variant={analyticsPeriod === p ? "cyber" : "outline"} size="sm"
                  className="text-xs h-8" onClick={() => setAnalyticsPeriod(p)}
                >
                  {p}
                </Button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "New Users", value: analytics?.newUsers || 0, icon: UserCheck, color: "text-cyber-400" },
                { label: "New Messages", value: analytics?.newMessages || 0, icon: MessageSquare, color: "text-success" },
                { label: "New Evidence", value: analytics?.newEvidence || 0, icon: FileText, color: "text-info" },
                { label: "New Sessions", value: analytics?.newSessions || 0, icon: LogIn, color: "text-warning" },
              ].map((m) => (
                <Card key={m.label} className="glass-card">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-lg bg-muted"><m.icon className={`h-4 w-4 ${m.color}`} /></div>
                    </div>
                    <div className="text-2xl font-bold">{m.value}</div>
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {analytics && analytics.topActions.length > 0 && (
              <Card className="glass-card">
                <CardHeader><CardTitle>Top Actions</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.topActions.map((a, i) => {
                      const maxCount = analytics.topActions[0].count
                      const pct = Math.round((a.count / maxCount) * 100)
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-28 truncate text-right">{a.action}</span>
                          <div className="flex-1 h-5 rounded-md bg-muted/50 overflow-hidden">
                            <div
                              className="h-full rounded-md bg-gradient-to-r from-cyber-500 to-purple-600 transition-all duration-500"
                              style={{ width: `${Math.max(pct, 5)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-medium w-10">{a.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {analytics && analytics.activityTimeline.length > 0 && (
              <Card className="glass-card">
                <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-1">
                      {analytics.activityTimeline.map((entry, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 text-sm">
                          <div className="flex flex-col items-center">
                            <div className="h-2 w-2 rounded-full bg-cyber-400" />
                            {i < analytics.activityTimeline.length - 1 && <div className="w-px h-4 bg-border" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono w-16 shrink-0">
                            {new Date(entry.time).toLocaleTimeString()}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono">{entry.action}</Badge>
                          <span className="text-xs font-medium">{entry.user}</span>
                          <span className="text-xs text-muted-foreground truncate">{entry.resource}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* AUDIT LOGS TAB */}
        <TabsContent value="audit">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search audit logs..."
                    value={auditSearch}
                    onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1) }}
                  />
                </div>
                <Input
                  className="max-w-[160px]"
                  placeholder="Filter by action..."
                  value={auditAction}
                  onChange={(e) => { setAuditAction(e.target.value); setAuditPage(1) }}
                />
                <span className="text-xs text-muted-foreground flex items-center shrink-0">{auditTotal} entries</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {auditLogs.length === 0 ? (
                <EmptyState icon={Eye} title="No audit logs found" description="Audit logs will appear here as users interact with the system." />
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 text-xs">
                        <div className="h-2 w-2 rounded-full bg-cyber-400/60 mt-1.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{log.userName}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">{log.action}</Badge>
                            <span className="text-muted-foreground">{log.resource}{log.resourceId ? ` #${log.resourceId.slice(0, 8)}` : ""}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <span>{new Date(log.createdAt).toLocaleString()}</span>
                            <span>·</span>
                            <span>{log.ip}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              {auditTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground">Page {auditPage} of {auditTotalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={auditPage >= auditTotalPages} onClick={() => setAuditPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SESSIONS TAB */}
        <TabsContent value="sessions">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Active Sessions</CardTitle>
                <Badge variant="outline">{sessionsTotal} session{sessionsTotal !== 1 ? "s" : ""}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {sessions.length === 0 ? (
                <EmptyState icon={Globe} title="No sessions found" description="Sessions will appear here as users log in." />
              ) : (
                <div className="space-y-1">
                  {sessions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          s.isCurrent ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                        }`}>
                          {s.user.name ? s.user.name[0].toUpperCase() : s.user.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.user.name || s.user.email}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Globe className="h-3 w-3" />{s.ip} · {s.device} · {s.browser}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {s.isCurrent && <Badge variant="success" className="text-[9px]">Current</Badge>}
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(s.lastActive).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sessionsTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground">Page {sessionPage} of {sessionsTotalPages}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={sessionPage <= 1} onClick={() => setSessionPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={sessionPage >= sessionsTotalPages} onClick={() => setSessionPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ALERTS TAB */}
        <TabsContent value="alerts">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Broadcast Notification</CardTitle>
                <CardDescription>Send an alert to all users on the platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Alert Type</label>
                  <div className="flex gap-2">
                    {[
                      { value: "info", label: "Info", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
                      { value: "warning", label: "Warning", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
                      { value: "success", label: "Success", color: "bg-green-500/10 text-green-400 border-green-500/30" },
                      { value: "error", label: "Error", color: "bg-red-500/10 text-red-400 border-red-500/30" },
                    ].map((t) => (
                      <button
                        key={t.value}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          alertType === t.value ? t.color + " ring-2 ring-offset-1 ring-offset-background" : "border-border text-muted-foreground hover:border-muted-foreground"
                        }`}
                        onClick={() => setAlertType(t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Title</label>
                  <Input
                    placeholder="e.g., Scheduled Maintenance"
                    value={alertTitle}
                    onChange={(e) => setAlertTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Message</label>
                  <textarea
                    className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all min-h-[100px] resize-y"
                    placeholder="Write your notification message..."
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                  />
                </div>
                <Button
                  variant="cyber" className="w-full"
                  onClick={handleSendAlert}
                  disabled={sendingAlert || !alertTitle.trim() || !alertMessage.trim()}
                >
                  {sendingAlert ? (
                    <>Sending...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Broadcast to All Users ({stats?.users || 0})</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Admin Contact</CardTitle>
                <CardDescription>System administrator email configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Admin Email</span>
                    <span className="text-sm font-medium font-mono">{systemConfig?.adminEmail || "sreekarsh44@gmail.com"}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">App URL</span>
                    <span className="text-sm font-mono text-xs">{systemConfig?.appUrl || "http://localhost:3000"}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">AI Service</span>
                     <span className="text-sm font-mono text-xs">{systemConfig?.aiServiceUrl || "http://localhost:8000"}</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-cyber-500/5 border border-cyber-500/10">
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    SMTP Connected
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Email notifications are routed through Gmail SMTP with the admin account. 
                    System alerts and broadcasts will be sent to all registered users.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>Global platform settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/30 space-y-3">
                  {[
                    { label: "Registration", value: systemConfig?.registrationEnabled !== false, type: "Enabled" },
                    { label: "MFA Required", value: systemConfig?.mfaRequired === true, type: "Disabled" },
                    { label: "OAuth Login", value: systemConfig?.allowOAuth !== false, type: "Enabled" },
                    { label: "Maintenance Mode", value: systemConfig?.maintenanceMode === true, type: "Inactive" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm">{item.label}</span>
                      <Badge variant={item.value ? "success" : item.type === "Disabled" ? "secondary" : "destructive"}>
                        {item.value ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Max Upload</span>
                    <span className="font-mono text-xs">{systemConfig?.maxUploadSize || "10MB"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Session Timeout</span>
                    <span className="font-mono text-xs">{systemConfig?.sessionTimeout || "7d"}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configuration changes are currently read-only in this view. Use the backend environment variables for permanent changes.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Quick Info</CardTitle>
                <CardDescription>Environment overview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Node.js", value: "NestJS 10" },
                    { label: "Frontend", value: "Next.js 16" },
                    { label: "Database", value: "PostgreSQL 16" },
                    { label: "Cache", value: "Redis + BullMQ" },
                    { label: "AI Engine", value: "FastAPI + GPT-4o" },
                    { label: "Auth", value: "JWT + OAuth + MFA" },
                  ].map((item) => (
                    <div key={item.label} className="p-3 rounded-lg bg-muted/30">
                      <div className="text-[10px] text-muted-foreground">{item.label}</div>
                      <div className="text-sm font-medium mt-0.5">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-r from-cyber-500/10 to-purple-600/10 border border-cyber-500/20 mt-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4 text-cyber-400" />
                    StegShield X v1.0.0
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI-Powered Zero-Trust Secure Communication &amp; Digital Evidence Platform
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDeleteUser}
        title="Delete User"
        description={`Are you sure you want to delete ${deleteTarget?.name || deleteTarget?.email}? This will permanently remove all associated data.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </div>
  )
}
