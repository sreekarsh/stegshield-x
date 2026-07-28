"use client"

import { useEffect, useCallback } from "react"
import { AlertTriangle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "destructive" | "default"
  loading?: boolean
  children?: React.ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  loading = false,
  children,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    },
    [onOpenChange]
  )

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => !loading && onOpenChange(false)}
      />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => !loading && onOpenChange(false)}
          disabled={loading}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex flex-col items-center text-center">
          <div
            className={`p-3 rounded-full mb-4 ${
              variant === "destructive" ? "bg-destructive/10" : "bg-muted"
            }`}
          >
            <AlertTriangle
              className={`h-6 w-6 ${
                variant === "destructive" ? "text-destructive" : "text-cyber-400"
              }`}
            />
          </div>
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mb-6">{description}</p>}
          {children}
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={variant === "destructive" ? "destructive" : "cyber"}
              className="flex-1"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Processing..." : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
