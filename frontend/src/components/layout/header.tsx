"use client"

import { memo, useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Bell, Search, Settings, LogOut, User, Terminal, Users, Flame, Check, ShieldAlert, Shield, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "./theme-toggle"
import { useUIStore } from "@/store/useUIStore"
import { useAuthStore } from "@/store/useAuthStore"
import { api } from "@/lib/api"
import Link from "next/link"
import toast from "react-hot-toast"

interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
}

export const Header = memo(function Header() {
  const router = useRouter()
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const { user, logout } = useAuthStore()

  const [unreadCount, setUnreadCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<NotificationItem[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "??"

  const fetchNotifications = useCallback(async () => {
    setLoadingNotifications(true)
    try {
      const data = await api.get<{ items?: NotificationItem[]; notifications?: NotificationItem[]; unreadCount?: number }>("/notifications?limit=5")
      const list = data?.items || data?.notifications || []
      setUnreadCount(data?.unreadCount || 0)
      setRecentNotifications(Array.isArray(list) ? list : [])
    } catch {
      setRecentNotifications([])
      setUnreadCount(0)
    } finally {
      setLoadingNotifications(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleMarkAllRead = async () => {
    try {
      await api.patch("/notifications/read-all")
      setUnreadCount(0)
      setRecentNotifications(prev => (prev || []).map(n => ({ ...n, isRead: true })))
      toast.success("Notifications marked as read")
    } catch {
      toast.error("Failed to mark notifications as read")
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      toast.success("Logged out successfully")
      router.push("/login")
    } catch {
      router.push("/login")
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border/50 bg-background/95 backdrop-blur px-6">
      <div
        className="flex flex-1 items-center gap-2 rounded-lg border border-input bg-background/50 px-3 py-2 cursor-pointer max-w-md hover:border-cyber-500/50 transition-colors"
        onClick={() => setCommandPaletteOpen(true)}
      >
        <Search className="h-4 w-4 text-cyber-400" />
        <span className="flex-1 text-sm text-muted-foreground">Search all 25+ modules, settings, files...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-xs text-muted-foreground font-mono">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        {/* Notifications Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Open notifications dropdown">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center text-[10px] bg-cyber-500 text-black font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-2">
            <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-border">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-cyber-400 hover:underline flex items-center gap-1"
                >
                  <Check className="h-3 w-3" /> Mark all read
                </button>
              )}
            </div>
            {(!recentNotifications || recentNotifications.length === 0) ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No notifications right now
              </div>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                {(recentNotifications || []).map((n) => (
                  <div
                    key={n.id}
                    className={`p-2 rounded-md text-xs transition-colors ${n.isRead ? "bg-transparent opacity-70" : "bg-muted/40 font-medium"}`}
                  >
                    <p className="font-semibold text-foreground">{n.title}</p>
                    <p className="text-muted-foreground truncate">{n.message}</p>
                    <span className="text-[10px] text-muted-foreground opacity-60 mt-0.5 block">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="w-full text-center text-xs justify-center font-medium text-cyber-400 cursor-pointer">
              <Link href="/notifications">View All Notifications</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Help Icon Link */}
        <Link href="/help">
          <Button variant="ghost" size="icon" aria-label="Open Help & Knowledge Center">
            <HelpCircle className="h-5 w-5" />
          </Button>
        </Link>

        {/* Settings Icon Link */}
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Open settings">
            <Settings className="h-5 w-5" />
          </Button>
        </Link>

        {/* User Profile Avatar & Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-cyber-500/20 hover:ring-cyber-500/50 transition-all">
              <AvatarImage src={user?.avatar || undefined} />
              <AvatarFallback className="bg-cyber-500/20 text-cyber-400 text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2">
            <div className="px-2 py-2 border-b border-border">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name || "Security Analyst"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || "analyst@stegshield.local"}</p>
              {user?.role && (
                <Badge variant="outline" className="mt-1.5 text-[9px] uppercase px-1.5 py-0 font-mono">
                  {String(user.role).toUpperCase() === "ADMIN" ? <ShieldAlert className="h-2.5 w-2.5 mr-1 text-cyber-400" /> : <Shield className="h-2.5 w-2.5 mr-1" />}
                  {user.role}
                </Badge>
              )}
            </div>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/settings" className="flex items-center gap-2">
                <User className="h-4 w-4" /> Account Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/api-platform" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" /> API Platform Keys
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/team-workspace" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Team Workspace
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer text-destructive focus:text-destructive">
              <Link href="/panic-mode" className="flex items-center gap-2">
                <Flame className="h-4 w-4" /> Panic Mode Lockdown
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/help" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-violet-400" /> Help & Knowledge Guide
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" /> Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
})
