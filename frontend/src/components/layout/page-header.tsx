"use client"

import { memo } from "react"
import { Button } from "@/components/ui/button"
import type { LucideIcon } from "lucide-react"

interface PageHeaderProps {
  title: string
  description?: string
  action?: {
    label: string
    icon?: LucideIcon
    onClick?: () => void
  }
}

export const PageHeader = memo(function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && (
        <Button variant="cyber" onClick={action.onClick}>
          {action.icon && <action.icon className="mr-2 h-4 w-4" />}
          {action.label}
        </Button>
      )}
    </div>
  )
})
