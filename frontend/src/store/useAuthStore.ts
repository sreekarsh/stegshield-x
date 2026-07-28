import { create } from "zustand"
import type { User, Session } from "@/types"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  sessions: Session[]
  setUser: (user: User | null) => void
  setSessions: (sessions: Session[]) => void
  setLoading: (loading: boolean) => void
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || `Request failed (${response.status})`)
  }
  return response.json()
}

let _refreshPromise: Promise<void> | null = null

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  sessions: [],

  setUser: (user) =>
    set({ user, isAuthenticated: !!user }),

  setSessions: (sessions) =>
    set({ sessions }),

  setLoading: (isLoading) =>
    set({ isLoading }),

  login: async (email, password) => {
    const response = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    })
    const data = await handleResponse(response)
    set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true })
  },

  register: async (email, password, name) => {
    const response = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
      credentials: "include",
    })
    const data = await handleResponse(response)
    set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true })
  },

  logout: async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { Authorization: `Bearer ${get().accessToken}` },
      })
    } catch {}
    set({ user: null, accessToken: null, isAuthenticated: false, sessions: [] })
  },

  refreshSession: async () => {
    if (_refreshPromise) return _refreshPromise
    _refreshPromise = (async () => {
      try {
        const response = await fetch(`${API}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          credentials: "include",
        })
        if (response.ok) {
          const data = await response.json()
          if (data.accessToken) {
            set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true })
          } else {
            set({ user: null, accessToken: null, isAuthenticated: false })
          }
        } else {
          set({ user: null, accessToken: null, isAuthenticated: false })
        }
      } catch {
        set({ user: null, accessToken: null, isAuthenticated: false })
      } finally {
        set({ isLoading: false })
        _refreshPromise = null
      }
    })()
    return _refreshPromise
  },
}))
