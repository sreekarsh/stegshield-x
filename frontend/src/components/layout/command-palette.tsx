"use client"

import { memo, useEffect, useCallback, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useUIStore } from "@/store/useUIStore"
import {
  Search, MessageSquare, Eye, Shield, Brain, Users, Settings, FileText,
  FileSearch, AlertTriangle, Award, Flame, Lock, Share2, KeyRound,
  FileCheck, Droplets, SlidersHorizontal, Hourglass, Puzzle, Languages,
  Globe, Terminal, ShieldAlert, Database,
} from "lucide-react"

interface CommandItem {
  name: string
  href: string
  category: string
  icon: typeof Search
}

const commands: CommandItem[] = [
  // Core & Analysis
  { name: "Home Dashboard", href: "/home", category: "Core", icon: Search },
  { name: "Steganography Engine", href: "/steganography", category: "Analysis", icon: Eye },
  { name: "Digital Forensics", href: "/digital-forensics", category: "Analysis", icon: FileSearch },
  { name: "Tamper & Deepfake Detection", href: "/tamper-detection", category: "Analysis", icon: AlertTriangle },
  { name: "Trust Score Engine", href: "/trust-score", category: "Analysis", icon: Award },
  { name: "AI Security Assistant", href: "/ai-assistant", category: "Core", icon: Brain },

  // Vault & Protection
  { name: "Evidence Vault", href: "/evidence-vault", category: "Vault", icon: Shield },
  { name: "Decoy Vault Protection", href: "/decoy-vault", category: "Vault", icon: Lock },
  { name: "Panic Mode Lockdown", href: "/panic-mode", category: "Security", icon: Flame },

  // Encryption & Sharing
  { name: "Secure Sharing", href: "/secure-sharing", category: "Encryption", icon: Share2 },
  { name: "File Encryption", href: "/file-encryption", category: "Encryption", icon: KeyRound },
  { name: "Image Encryption", href: "/image-encryption", category: "Encryption", icon: Lock },
  { name: "PDF Protection", href: "/pdf-protect", category: "Encryption", icon: FileCheck },
  { name: "Watermarking", href: "/watermarking", category: "Encryption", icon: Droplets },
  { name: "Metadata Privacy Cleaner", href: "/metadata-privacy", category: "Privacy", icon: SlidersHorizontal },

  // Advanced Crypto
  { name: "Time Capsules", href: "/time-capsule", category: "Crypto", icon: Hourglass },
  { name: "Shamir Secret Sharing", href: "/shamir-secret", category: "Crypto", icon: Puzzle },
  { name: "Secret Language Mapping", href: "/secret-language", category: "Crypto", icon: Languages },

  // Communication & Tools
  { name: "Encrypted Messaging", href: "/secure-messaging", category: "Tools", icon: MessageSquare },
  { name: "URL Safety Checker", href: "/url-checker", category: "Tools", icon: Globe },
  { name: "Team Workspace", href: "/team-workspace", category: "Collaboration", icon: Users },

  // Management
  { name: "Admin Panel", href: "/admin-panel", category: "Management", icon: ShieldAlert },
  { name: "API Platform Keys", href: "/api-platform", category: "Management", icon: Terminal },
  { name: "Audit Logging", href: "/audit-logging", category: "Management", icon: FileText },
  { name: "Forensics Reports", href: "/reports", category: "Management", icon: FileText },
  { name: "Vault Index", href: "/vault", category: "Management", icon: Database },
  { name: "Account Settings", href: "/settings", category: "Settings", icon: Settings },
]

export const CommandPalette = memo(function CommandPalette() {
  const router = useRouter()
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen)
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase().trim()
    return commands.filter(
      (c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
    )
  }, [query])

  useEffect(() => { setSelectedIndex(0) }, [query])

  const navigateTo = useCallback(
    (href: string) => {
      router.push(href)
      setCommandPaletteOpen(false)
      setQuery("")
    },
    [router, setCommandPaletteOpen]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
      if (e.key === "Escape" && commandPaletteOpen) {
        setCommandPaletteOpen(false)
        setQuery("")
      }
      if (commandPaletteOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1))
        } else if (e.key === "ArrowUp") {
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1))
        } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
          e.preventDefault()
          navigateTo(filteredCommands[selectedIndex].href)
        }
      }
    },
    [commandPaletteOpen, setCommandPaletteOpen, filteredCommands, selectedIndex, navigateTo]
  )

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  if (!commandPaletteOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
      onClick={() => { setCommandPaletteOpen(false); setQuery("") }}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative w-full max-w-xl rounded-xl border border-cyber-500/30 bg-card shadow-2xl animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-muted/20">
          <Search className="h-5 w-5 text-cyber-400 shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search all 25+ modules, security tools, vault, settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setQuery("")}>
              Clear
            </button>
          )}
        </div>

        <div className="p-2 max-h-80 overflow-y-auto space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No features match &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon
              const isSelected = idx === selectedIndex
              return (
                <button
                  key={cmd.name}
                  onClick={() => navigateTo(cmd.href)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all ${
                    isSelected
                      ? "bg-cyber-500/15 text-cyber-400 border border-cyber-500/30 font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${isSelected ? "text-cyber-400" : ""}`} />
                    <span>{cmd.name}</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-muted/50 text-muted-foreground">
                    {cmd.category}
                  </span>
                </button>
              )
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground bg-muted/10">
          <span>Navigation: <kbd className="px-1 rounded bg-muted">↑</kbd> <kbd className="px-1 rounded bg-muted">↓</kbd> to select</span>
          <span>Select: <kbd className="px-1 rounded bg-muted">↵</kbd> &middot; Exit: <kbd className="px-1 rounded bg-muted">esc</kbd></span>
        </div>
      </div>
    </div>
  )
})
