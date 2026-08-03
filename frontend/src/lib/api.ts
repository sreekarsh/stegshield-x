import { useAuthStore } from "@/store/useAuthStore"

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
const API_BASE = rawApiUrl.replace(/\/$/, "")

if (typeof window !== "undefined" && process.env.NODE_ENV === "production" && rawApiUrl.includes("localhost")) {
  console.error("[api] NEXT_PUBLIC_API_URL is not set in production. API calls will fail. Set it in Vercel Settings → Environment Variables.")
}

interface ApiOptions extends RequestInit {
  params?: Record<string, string>
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken ?? null
}

let _refreshPromise: Promise<boolean> | null = null

async function tryRefreshToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      })
      if (!res.ok) return false
      const data = await res.json()
      if (!data.accessToken) return false
      useAuthStore.setState({ accessToken: data.accessToken, user: data.user, isAuthenticated: true })
      return true
    } catch {
      return false
    } finally {
      _refreshPromise = null
    }
  })()
  return _refreshPromise
}

function redirectToLogin() {
  if (typeof window !== "undefined") {
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false })
    window.location.href = "/login"
  }
}

const FETCH_TIMEOUT = 45000 // 45 seconds to accommodate Render free tier cold starts
const UPLOAD_TIMEOUT = 180000 // 3 minutes for uploads/downloads/AI analysis

async function requestWithTimeout(url: string, options: RequestInit, timeout = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...options, signal: options.signal || controller.signal })
    return response
  } finally {
    clearTimeout(id)
  }
}

async function request<T>(endpoint: string, options: ApiOptions = {}, retried = false): Promise<T> {
  const { params, ...fetchOptions } = options

  let url = `${API_BASE}${endpoint}`
  if (params) {
    const searchParams = new URLSearchParams(params)
    url += `?${searchParams.toString()}`
  }

  let token = getAccessToken()

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...fetchOptions.headers,
  }

  try {
    const response = await requestWithTimeout(url, {
      ...fetchOptions,
      headers,
      credentials: "include",
    }, FETCH_TIMEOUT)

    if (response.status === 401) {
      const refreshed = await tryRefreshToken()
      if (refreshed) {
        token = getAccessToken()
        const retryHeaders: Record<string, string> = { "Content-Type": "application/json" }
        if (token) retryHeaders["Authorization"] = `Bearer ${token}`
        const retryRes = await fetch(url, { ...fetchOptions, headers: retryHeaders, credentials: "include" })
        if (retryRes.ok) return retryRes.json()
      }
      redirectToLogin()
      throw new ApiError(401, "Session expired — redirecting to login")
    }

    if (response.status === 413) {
      throw new ApiError(413, "File too large. Maximum upload size is 500MB.")
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Request failed" }))
      throw new ApiError(response.status, error.message || "Request failed", error)
    }

    return response.json()
  } catch (e: unknown) {
    if (e instanceof ApiError) throw e
    // Transient network error retry (1 attempt)
    if (!retried && !(e instanceof DOMException && e.name === "AbortError")) {
      await new Promise(r => setTimeout(r, 300))
      return request<T>(endpoint, options, true)
    }
    const isTimeout = e instanceof DOMException && e.name === "AbortError"
    const message = isTimeout ? "Request timed out — server took too long to respond" : (e instanceof Error ? e.message : "Network error — unable to reach server")
    throw new ApiError(0, message)
  }
}

export const api = {
  get: <T>(endpoint: string, options?: ApiOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: ApiOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: ApiOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  upload: async <T>(endpoint: string, formData: FormData): Promise<T> => {
    let token = getAccessToken() ?? undefined
    const doFetch = (authToken?: string) => requestWithTimeout(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: formData,
      credentials: "include",
    }, UPLOAD_TIMEOUT)

    try {
      let response = await doFetch(token)
      if (response.status === 401) {
        const refreshed = await tryRefreshToken()
        if (refreshed) {
          token = getAccessToken() ?? undefined
          response = await doFetch(token)
          if (response.ok) return response.json()
        }
        redirectToLogin()
        throw new ApiError(401, "Session expired — redirecting to login")
      }
      if (response.status === 413) {
        throw new ApiError(413, "File too large. Maximum upload size is 500MB.")
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Upload failed" }))
        throw new ApiError(response.status, error.message || "Upload failed", error)
      }
      return response.json()
    } catch (e: unknown) {
      if (e instanceof ApiError) throw e
      if (e instanceof DOMException && e.name === "AbortError") throw new ApiError(0, "Upload timed out — process took longer than 3 minutes")
      throw new ApiError(0, e instanceof Error ? e.message : "Network error — unable to reach server")
    }
  },

  download: async (endpoint: string): Promise<Blob> => {
    let token = getAccessToken()
    const options = (authToken?: string): RequestInit => ({
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      credentials: "include" as const,
    })
    try {
      let response = await requestWithTimeout(`${API_BASE}${endpoint}`, options(token ?? undefined), UPLOAD_TIMEOUT)
      if (response.status === 401) {
        const refreshed = await tryRefreshToken()
        if (refreshed) {
          token = getAccessToken()
          response = await requestWithTimeout(`${API_BASE}${endpoint}`, options(token ?? undefined), UPLOAD_TIMEOUT)
          if (response.ok) return response.blob()
        }
        redirectToLogin()
        throw new ApiError(401, "Session expired — redirecting to login")
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Download failed" }))
        throw new ApiError(response.status, error.message || "Download failed", error)
      }
      return response.blob()
    } catch (e: unknown) {
      if (e instanceof ApiError) throw e
      if (e instanceof DOMException && e.name === "AbortError") throw new ApiError(0, "Download timed out")
      throw new ApiError(0, e instanceof Error ? e.message : "Network error — unable to reach server")
    }
  },

  downloadBlob: async (endpoint: string, formData: FormData): Promise<Blob> => {
    let token: string | undefined = getAccessToken() ?? undefined
    const doFetch = (authToken?: string) => requestWithTimeout(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: formData,
      credentials: "include",
    }, UPLOAD_TIMEOUT)
    try {
      let response = await doFetch(token)
      if (response.status === 401) {
        const refreshed = await tryRefreshToken()
        if (refreshed) {
          token = getAccessToken() ?? undefined
          response = await doFetch(token)
          if (response.ok) return response.blob()
        }
        redirectToLogin()
        throw new ApiError(401, "Session expired — redirecting to login")
      }
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Request failed" }))
        throw new ApiError(response.status, error.message || "Request failed", error)
      }
      return response.blob()
    } catch (e: unknown) {
      if (e instanceof ApiError) throw e
      if (e instanceof DOMException && e.name === "AbortError") throw new ApiError(0, "Request timed out")
      throw new ApiError(0, e instanceof Error ? e.message : "Network error — unable to reach server")
    }
  },
}

export async function* streamChat(
  endpoint: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  let token = getAccessToken()
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages }),
    signal,
    credentials: "include",
  })

  if (response.status === 401) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      token = getAccessToken()
      const retryRes = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages }),
        signal,
        credentials: "include",
      })
      if (retryRes.ok) {
        const reader = retryRes.body?.getReader()
        if (reader) yield* readStream(reader)
      }
      return
    }
    redirectToLogin()
    throw new ApiError(401, "Session expired — redirecting to login")
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Chat request failed" }))
    throw new ApiError(response.status, error.message, error)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body")
  yield* readStream(reader)
}

async function* readStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder()
  let buffer = ""
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim()
        if (data === "[DONE]") return
        try {
          const parsed = JSON.parse(data)
          if (parsed.content) yield parsed.content
        } catch {}
      }
    }
  }
}

export { ApiError }
