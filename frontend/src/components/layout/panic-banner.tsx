"use client"

import { useState, useEffect } from "react"
import { AlertTriangle, X } from "lucide-react"
import Link from "next/link"

const HOURS_24 = 86400000

export function PanicBanner() {
  const [show, setShow] = useState(false)
  const [timeAgo, setTimeAgo] = useState("")

  useEffect(() => {
    const raw = localStorage.getItem("panic_triggered_at")
    if (!raw) return
    const ts = parseInt(raw, 10)
    if (isNaN(ts) || Date.now() - ts > HOURS_24) {
      localStorage.removeItem("panic_triggered_at")
      return
    }
    const dismissed = localStorage.getItem("panic_banner_dismissed")
    if (dismissed === raw) return
    setShow(true)
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 60) setTimeAgo(`${mins} minute${mins === 1 ? "" : "s"} ago`)
    else setTimeAgo(`${Math.floor(mins / 60)} hour${Math.floor(mins / 60) === 1 ? "" : "s"} ago`)
  }, [])

  if (!show) return null

  return (
    <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-destructive font-medium">Panic Mode was triggered {timeAgo}.</span>
        <Link href="/panic-mode" className="text-destructive underline underline-offset-2 hover:opacity-80 text-xs">
          View details
        </Link>
      </div>
      <button
        onClick={() => { setShow(false); localStorage.setItem("panic_banner_dismissed", localStorage.getItem("panic_triggered_at") || "") }}
        className="text-destructive/60 hover:text-destructive transition-colors"
        aria-label="Dismiss panic banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
