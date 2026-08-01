"use client"

import { useTheme } from "next-themes"
import { Moon, Sun, Monitor, MoonStar, TreePine, Sunset } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useUIStore } from "@/store/useUIStore"
import { memo, useEffect, useState } from "react"

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "cyberpunk", label: "Cyberpunk", icon: Monitor },
  { value: "midnight", label: "Midnight", icon: MoonStar },
  { value: "forest", label: "Forest", icon: TreePine },
  { value: "sunset", label: "Sunset", icon: Sunset },
] as const

export const ThemeToggle = memo(function ThemeToggle() {
  const { setTheme: setNextTheme, theme } = useTheme()
  const storeTheme = useUIStore((s) => s.theme)
  const setStoreTheme = useUIStore((s) => s.setTheme)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const active = (mounted ? theme : storeTheme) || "dark"

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Sun className="h-5 w-5" />
      </Button>
    )
  }

  const ActiveIcon = themeOptions.find((t) => t.value === active)?.icon || Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Toggle theme">
          <ActiveIcon className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themeOptions.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => {
              setNextTheme(t.value)
              setStoreTheme(t.value)
            }}
            className={active === t.value ? "bg-accent text-accent-foreground" : ""}
          >
            <t.icon className="mr-2 h-4 w-4" /> {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
