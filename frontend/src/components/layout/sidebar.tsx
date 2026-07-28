"use client"

import { memo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUIStore } from "@/store/useUIStore"
import { useAuthStore } from "@/store/useAuthStore"
import {
  LayoutDashboard,
  MessageSquare,
  Eye,
  Image,
  FileKey,
  Languages,
  FileText,
  Search,
  Shield,
  Brain,
  ScanFace,
  Share2,
  Droplets,
  FileX,
  Puzzle,
  AlertTriangle,
  Ghost,
  Clock,
  Award,
  Users,
  Settings,
  ScrollText,
  Terminal,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Database,
  Fingerprint,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

const navigation = [
  { section: "Core", items: [
    { name: "Dashboard", href: "/home", icon: LayoutDashboard },
    { name: "Secure Messaging", href: "/secure-messaging", icon: MessageSquare },
    { name: "Steganography", href: "/steganography", icon: Eye },
    { name: "Image Encryption", href: "/image-encryption", icon: Image },
    { name: "File Encryption", href: "/file-encryption", icon: FileKey },
    { name: "Secret Language", href: "/secret-language", icon: Languages },
    { name: "PDF Protect", href: "/pdf-protect", icon: FileText },
    { name: "URL Checker", href: "/url-checker", icon: Globe },
  ]},
  { section: "Forensics", items: [
    { name: "Digital Forensics", href: "/digital-forensics", icon: Search },
    { name: "Evidence Vault", href: "/evidence-vault", icon: Shield },
    { name: "AI Assistant", href: "/ai-assistant", icon: Brain },
    { name: "Tamper Detection", href: "/tamper-detection", icon: ScanFace },
    { name: "Metadata Privacy", href: "/metadata-privacy", icon: Fingerprint },
  ]},
  { section: "Sharing & Privacy", items: [
    { name: "Secure Sharing", href: "/secure-sharing", icon: Share2 },
    { name: "Watermarking", href: "/watermarking", icon: Droplets },
  ]},
  { section: "Advanced", items: [
    { name: "Shamir Secret", href: "/shamir-secret", icon: Puzzle },
    { name: "Panic Mode", href: "/panic-mode", icon: AlertTriangle },
    { name: "Decoy Vault", href: "/decoy-vault", icon: Ghost },
    { name: "Time Capsule", href: "/time-capsule", icon: Clock },
    { name: "Trust Score", href: "/trust-score", icon: Award },
  ]},
  { section: "Team", items: [
    { name: "Team Workspace", href: "/team-workspace", icon: Users },
  ]},
  { section: "Management", items: [
    { name: "Admin Panel", href: "/admin-panel", icon: Settings },
    { name: "API Platform", href: "/api-platform", icon: Terminal },
    { name: "Audit Logging", href: "/audit-logging", icon: ScrollText },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "Vault", href: "/vault", icon: Database },
  ]},
]

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const handleSignOut = () => {
    useAuthStore.getState().logout()
    router.push("/login")
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border/50 bg-background transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/50">
        {sidebarOpen && (
          <Link href="/home" className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-cyber-500" />
            <span className="font-bold text-sm">StegShield X</span>
          </Link>
        )}
        {!sidebarOpen && (
          <Link href="/home" className="mx-auto">
            <Shield className="h-7 w-7 text-cyber-500" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn("h-8 w-8", !sidebarOpen && "mx-auto mt-2")}
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1 h-[calc(100vh-4rem)] pb-16">
        <nav className="p-2 space-y-4">
          {navigation.map((section) => (
            <div key={section.section}>
              {sidebarOpen && (
                <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {section.section}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200",
                        isActive
                          ? "bg-gradient-to-r from-violet-600/25 to-indigo-600/15 text-cyan-300 font-semibold border border-violet-500/40 shadow-[0_0_15px_rgba(124,58,237,0.3)]"
                          : "text-muted-foreground hover:text-white hover:bg-violet-500/10 hover:border hover:border-violet-500/20",
                        !sidebarOpen && "justify-center px-2"
                      )}
                      title={sidebarOpen ? undefined : item.name}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {sidebarOpen && <span>{item.name}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-border/50 bg-background space-y-1">
          <button
            onClick={handleSignOut}
            className={cn(
              "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all",
              !sidebarOpen && "justify-center px-2"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
          {sidebarOpen && (
            <p className="text-[10px] text-center text-muted-foreground pt-1 border-t border-border/20">
              Created by <span className="font-semibold text-violet-400">Sree Karsh</span>
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
})
