"use client"

import { useEffect, useState } from "react"
import { Bell, Info, AlertTriangle, CheckCircle, Loader2, Trash2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import toast from "react-hot-toast"

interface Notification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  createdAt: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifs = async () => {
    setLoading(true)
    try {
      const data = await api.get<{ items: Notification[] }>("/notifications")
      setNotifications(data.items)
    } catch {
      // offline
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotifs() }, [])

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`, {})
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    } catch {
      toast.error("Failed to mark as read")
    }
  }

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all", {})
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      toast.success("All marked read")
    } catch {
      toast.error("Failed")
    }
  }

  const handleClearAll = async () => {
    try {
      await api.delete("/notifications")
      setNotifications([])
      toast.success("All notifications cleared")
    } catch {
      toast.error("Failed to clear notifications")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">Security alerts and system notifications</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={notifications.length === 0}>
            <CheckCircle className="h-4 w-4 mr-1.5" /> Mark All Read
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClearAll} disabled={notifications.length === 0}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Clear All
          </Button>
        </div>
      </div>
      <Card className="glass-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No notifications yet.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`flex items-start gap-4 p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${!n.isRead ? 'bg-cyber-500/5' : ''}`}>
                <div className={`p-2 rounded-full ${n.type === "success" ? "bg-success/10" : n.type === "warning" ? "bg-warning/10" : "bg-info/10"}`}>
                  {n.type === "success" ? <CheckCircle className="h-4 w-4 text-success" /> :
                   n.type === "warning" ? <AlertTriangle className="h-4 w-4 text-warning" /> :
                   <Info className="h-4 w-4 text-info" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(n.createdAt).toLocaleDateString()}</span>
                  {!n.isRead && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => markRead(n.id)}>
                      <CheckCircle className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
