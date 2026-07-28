import { create } from "zustand"

interface UIState {
  sidebarOpen: boolean
  theme: "dark" | "light" | "cyberpunk" | "midnight" | "forest" | "sunset"
  commandPaletteOpen: boolean
  mobileMenuOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setTheme: (theme: "dark" | "light" | "cyberpunk" | "midnight" | "forest" | "sunset") => void
  setCommandPaletteOpen: (open: boolean) => void
  setMobileMenuOpen: (open: boolean) => void
}

function getInitialTheme(): UIState["theme"] {
  if (typeof window === "undefined") return "dark"
  return (localStorage.getItem("stegshield-theme") as UIState["theme"]) || "dark"
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: getInitialTheme(),
  commandPaletteOpen: false,
  mobileMenuOpen: false,

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (sidebarOpen) =>
    set({ sidebarOpen }),

  setTheme: (theme) =>
    set({ theme }),

  setCommandPaletteOpen: (commandPaletteOpen) =>
    set({ commandPaletteOpen }),

  setMobileMenuOpen: (mobileMenuOpen) =>
    set({ mobileMenuOpen }),
}))
