import { create } from "zustand"
import type { User, Session } from "@/types"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  sessions: Session[]
  mfaRequired: boolean
  mfaToken: string | null
  setUser: (user: User | null) => void
  setSessions: (sessions: Session[]) => void
  setLoading: (loading: boolean) => void
  setMfaRequired: (required: boolean, token?: string | null) => void
  clearMfa: () => void
  login: (email: string, password: string) => Promise<void>
  mfaLogin: (mfaToken: string, code: string) => Promise<void>
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

export const useAuthStore = create<AuthState>((set, get) => {
  let initialAccessToken: string | null = null
  let initialUser: User | null = null
  if (typeof window !== "undefined") {
    const storedToken = localStorage.getItem("stegshield_access_token")
    const storedUser = localStorage.getItem("stegshield_user")
    if (storedToken) initialAccessToken = storedToken
    if (storedUser) {
      try { initialUser = JSON.parse(storedUser) } catch {}
    }
  }

  return {
    user: initialUser,
    accessToken: initialAccessToken,
    isAuthenticated: !!initialAccessToken,
    isLoading: false,
    sessions: [],
    mfaRequired: false,
    mfaToken: null,

    setUser: (user) =>
      set({ user, isAuthenticated: !!user }),

    setSessions: (sessions) =>
      set({ sessions }),

    setLoading: (isLoading) =>
      set({ isLoading }),

    setMfaRequired: (required, token = null) =>
      set({ mfaRequired: required, mfaToken: token }),

    clearMfa: () =>
      set({ mfaRequired: false, mfaToken: null }),

    login: async (email, password) => {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      })
      const data = await handleResponse(response)

      if (data.mfaRequired) {
        set({ mfaRequired: true, mfaToken: data.mfaToken })
        return
      }

      set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, mfaRequired: false, mfaToken: null })
      if (typeof window !== "undefined") {
        localStorage.setItem("stegshield_access_token", data.accessToken)
        localStorage.setItem("stegshield_user", JSON.stringify(data.user))
      }
    },

    mfaLogin: async (mfaToken, code) => {
      const response = await fetch(`${API}/auth/mfa/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, token: code }),
        credentials: "include",
      })
      const data = await handleResponse(response)
      set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, mfaRequired: false, mfaToken: null })
      if (typeof window !== "undefined") {
        localStorage.setItem("stegshield_access_token", data.accessToken)
        localStorage.setItem("stegshield_user", JSON.stringify(data.user))
      }
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
      if (typeof window !== "undefined") {
        localStorage.setItem("stegshield_access_token", data.accessToken)
        localStorage.setItem("stegshield_user", JSON.stringify(data.user))
      }
    },

    logout: async () => {
      try {
        await fetch(`${API}/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: { Authorization: `Bearer ${get().accessToken}` },
        })
      } catch {}
      set({ user: null, accessToken: null, isAuthenticated: false, sessions: [], mfaRequired: false, mfaToken: null })
      if (typeof window !== "undefined") {
        localStorage.removeItem("stegshield_access_token")
        localStorage.removeItem("stegshield_user")
      }
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
              if (typeof window !== "undefined") {
                localStorage.setItem("stegshield_access_token", data.accessToken)
                if (data.user) localStorage.setItem("stegshield_user", JSON.stringify(data.user))
              }
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
  }
})
