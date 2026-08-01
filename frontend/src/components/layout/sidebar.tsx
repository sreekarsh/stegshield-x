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
  HelpCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"

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
    { name: "Help & FAQ", href: "/help", icon: HelpCircle },
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
        "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-border/50 bg-background/95 backdrop-blur-xl transition-[width] duration-300 ease-in-out shadow-2xl select-none overflow-hidden",
        sidebarOpen ? "w-64" : "w-16"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-border/50 shrink-0 bg-background/80">
        {sidebarOpen && (
          <Link href="/home" className="flex items-center gap-2 group">
            <Shield className="h-7 w-7 text-cyber-500 shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-200" />
            <div className="flex flex-col">
              <span className="font-bold text-sm leading-none bg-gradient-to-r from-white via-violet-200 to-cyan-400 bg-clip-text text-transparent">
                StegShield X
              </span>
              <span className="text-[10px] text-muted-foreground font-medium pt-1">
                Created by <span className="text-cyber-400 font-semibold">Sree Karsh</span>
              </span>
            </div>
          </Link>
        )}
        {!sidebarOpen && (
          <Link href="/home" className="mx-auto">
            <Shield className="h-7 w-7 text-cyber-500 hover:scale-110 hover:rotate-6 transition-transform duration-200" />
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn("h-8 w-8 hover:bg-violet-500/20 hover:text-cyan-300 transition-colors", !sidebarOpen && "mx-auto mt-2")}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Main Nav Scroll Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 pr-1 scrollbar-thin">
        <nav className="p-2 space-y-3 pb-6">
          {navigation.map((section) => (
            <div key={section.section} className="space-y-1">
              {sidebarOpen && (
                <p className="px-3 py-1 text-[11px] font-bold text-muted-foreground/80 uppercase tracking-widest">
                  {section.section}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  const Icon = item.icon

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 h-10 text-[13.5px] font-medium transition-all duration-150 ease-out select-none overflow-hidden",
                        isActive
                          ? "bg-gradient-to-r from-violet-600/35 via-indigo-600/25 to-cyan-600/20 text-cyan-200 font-bold border border-cyan-400/50 shadow-[0_0_15px_rgba(124,58,237,0.35)] translate-x-1"
                          : "text-muted-foreground hover:text-white hover:bg-violet-500/15 hover:translate-x-1 hover:border hover:border-violet-500/30",
                        !sidebarOpen && "justify-center px-2 hover:translate-x-0"
                      )}
                      title={sidebarOpen ? undefined : item.name}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1.5 h-4 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
                      )}

                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:scale-110",
                          isActive ? "text-cyan-300" : "text-muted-foreground group-hover:text-violet-300"
                        )}
                      />

                      {sidebarOpen && (
                        <span className={cn("truncate transition-colors", isActive ? "text-cyan-200 font-bold text-[14px]" : "")}>
                          {item.name}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="shrink-0 p-2 border-t border-border/50 bg-background/95 backdrop-blur-md space-y-1">
        <button
          onClick={handleSignOut}
          className={cn(
            "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 hover:scale-[1.02]",
            !sidebarOpen && "justify-center px-2"
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {sidebarOpen && <span>Sign Out</span>}
        </button>
        {sidebarOpen && (
          <p className="text-[11px] text-center text-muted-foreground pt-1 border-t border-border/20">
            Created by <span className="font-semibold text-violet-400">Sree Karsh</span>
          </p>
        )}
      </div>
    </aside>
  )
})
