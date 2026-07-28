"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useUIStore } from "@/store/useUIStore"
import { PanicBanner } from "@/components/layout/panic-banner"

const Sidebar = dynamic(() => import("@/components/layout/sidebar").then((m) => ({ default: m.Sidebar })), { ssr: false })
const Header = dynamic(() => import("@/components/layout/header").then((m) => ({ default: m.Header })), { ssr: false })
const CommandPalette = dynamic(() => import("@/components/layout/command-palette").then((m) => ({ default: m.CommandPalette })), { ssr: false })

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const router = useRouter()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "P") {
        e.preventDefault()
        router.push("/panic-mode")
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [router])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <CommandPalette />
      <main
        className={`transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-16"
        }`}
      >
        <Header />
        <PanicBanner />
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
