"use client"

import { useState } from "react"
import { Copy, Check, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import toast from "react-hot-toast"

interface QuickCopyButtonProps {
  url: string
  size?: "sm" | "default"
}

export function QuickCopyButton({ url, size = "sm" }: QuickCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering parent click handlers
    
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Link copied!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(url, "_blank")
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size={size}
        onClick={handleCopy}
        className="h-8 px-2"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size={size}
        onClick={handleOpen}
        className="h-8 px-2"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
