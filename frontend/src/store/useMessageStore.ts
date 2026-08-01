import { create } from "zustand"
import type { Message, ContactRequest, User } from "@/types"
import { useAuthStore } from "./useAuthStore"
import { encryptStore, decryptStore } from "@/lib/crypto-store"
import { encryptMessageContent, decryptMessageContent, isSelfDestructed } from "@/lib/message-crypto"

interface Contact {
  id: string
  name: string
  avatar: string | null
}

const LOCAL_KEY = "stegshield_messages"
const LOCAL_REQUESTS_KEY = "stegshield_requests"

interface LocalData {
  contacts: Contact[]
  messages: Record<string, Message[]>
}

async function loadLocal(): Promise<LocalData> {
  if (typeof window === "undefined") return { contacts: [], messages: {} }
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return { contacts: [], messages: {} }
    const decrypted = await decryptStore<LocalData>(raw)
    return decrypted || { contacts: [], messages: {} }
  } catch {
    return { contacts: [], messages: {} }
  }
}

async function saveLocal(data: LocalData) {
  if (typeof window === "undefined") return
  const encrypted = await encryptStore(data)
  localStorage.setItem(LOCAL_KEY, encrypted)
}

async function loadLocalRequests(): Promise<ContactRequest[]> {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LOCAL_REQUESTS_KEY)
    if (!raw) return []
    const decrypted = await decryptStore<ContactRequest[]>(raw)
    return decrypted || []
  } catch {
    return []
  }
}

async function saveLocalRequests(requests: ContactRequest[]) {
  if (typeof window === "undefined") return
  const encrypted = await encryptStore(requests)
  localStorage.setItem(LOCAL_REQUESTS_KEY, encrypted)
}

function genId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function conversationId(a: string, b: string) {
  return [a, b].sort().join(":")
}

interface SearchableUser {
  id: string
  name: string
  email: string
}

export const DEMO_USER_DETAILS: Record<string, any> = {
  "agent-1": { id: "agent-1", name: "Alex Mercer", email: "alex.mercer@shield.gov", role: "investigator", isVerified: true, isMFAEnabled: true, createdAt: "2024-01-15T08:00:00Z", department: "Cyber Forensics & Steganography", fingerprint: "SHA256:7F8A:3D9E:4B11:C20F:9A32" },
  "agent-2": { id: "agent-2", name: "Sam Rivera", email: "sam.rivera@shield.gov", role: "editor", isVerified: true, isMFAEnabled: true, createdAt: "2024-02-10T09:30:00Z", department: "Threat Intelligence & Tamper Analysis", fingerprint: "SHA256:8E1C:4A2D:9C33:B10E:7F44" },
  "agent-3": { id: "agent-3", name: "Jordan Chase", email: "jordan.chase@shield.gov", role: "admin", isVerified: true, isMFAEnabled: true, createdAt: "2024-03-01T11:00:00Z", department: "Security Operations Center", fingerprint: "SHA256:9A4F:5B1E:1D22:E80A:3C55" },
  "agent-4": { id: "agent-4", name: "Casey Morgan", email: "casey.morgan@shield.gov", role: "viewer", isVerified: true, isMFAEnabled: false, createdAt: "2024-03-12T14:20:00Z", department: "Digital Evidence Management", fingerprint: "SHA256:1C2B:3D4E:5F6A:7B8C:9D0E" },
  "agent-5": { id: "agent-5", name: "Riley Quinn", email: "riley.quinn@shield.gov", role: "investigator", isVerified: true, isMFAEnabled: true, createdAt: "2024-04-05T16:45:00Z", department: "Cryptographic Analysis", fingerprint: "SHA256:2D3E:4F5A:6B7C:8D9E:0F1A" },
  "agent-6": { id: "agent-6", name: "Taylor Reed", email: "taylor.reed@shield.gov", role: "editor", isVerified: true, isMFAEnabled: true, createdAt: "2024-04-18T10:15:00Z", department: "Incident Response", fingerprint: "SHA256:3E4F:5A6B:7C8D:9E0F:1A2B" },
  "agent-7": { id: "agent-7", name: "Morgan Blair", email: "morgan.blair@shield.gov", role: "viewer", isVerified: true, isMFAEnabled: false, createdAt: "2024-05-02T13:00:00Z", department: "Compliance & Audit Log", fingerprint: "SHA256:4F5A:6B7C:8D9E:0F1A:2B3C" },
  "agent-8": { id: "agent-8", name: "Drew Harper", email: "drew.harper@shield.gov", role: "investigator", isVerified: true, isMFAEnabled: true, createdAt: "2024-05-20T08:30:00Z", department: "Malware & Deepfake Analysis", fingerprint: "SHA256:5A6B:7C8D:9E0F:1A2B:3C4D" },
  "agent-9": { id: "agent-9", name: "Sydney Cole", email: "sydney.cole@shield.gov", role: "owner", isVerified: true, isMFAEnabled: true, createdAt: "2024-06-01T09:00:00Z", department: "Chief Information Security Office", fingerprint: "SHA256:6B7C:8D9E:0F1A:2B3C:4D5E" },
  "agent-10": { id: "agent-10", name: "Jamie Wells", email: "jamie.wells@shield.gov", role: "editor", isVerified: true, isMFAEnabled: true, createdAt: "2024-06-15T15:10:00Z", department: "Network Security & Proxy", fingerprint: "SHA256:7C8D:9E0F:1A2B:3C4D:5E6F" },
}

const DEMO_USERS = Object.values(DEMO_USER_DETAILS)

const CONTACT_NAMES: Record<string, string> = {}
for (const u of DEMO_USERS) {
  CONTACT_NAMES[u.id] = u.name
}

interface MessageStore {
  contacts: Contact[]
  messages: Message[]
  selectedContactId: string | null
  loading: boolean
  error: string | null

  pendingRequests: ContactRequest[]
  sentRequests: ContactRequest[]

  fetchContacts: () => Promise<void>
  fetchConversation: (userId: string) => Promise<void>
  sendMessage: (receiverId: string, content: string, selfDestruct?: boolean, encrypted?: boolean, oneTimeView?: boolean, msgType?: Message["type"]) => Promise<void>
  editMessage: (messageId: string, newContent: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  selectContact: (id: string | null) => void
  addContact: (id: string, name: string) => Promise<void>
  removeContact: (id: string) => Promise<void>
  reorderContacts: (contacts: Contact[]) => void
  clearError: () => void

  searchUsers: (query: string) => Promise<User[]>
  sendContactRequest: (userId: string, userName?: string) => Promise<void>
  acceptContactRequest: (requestId: string) => Promise<void>
  rejectContactRequest: (requestId: string) => Promise<void>
  cancelContactRequest: (requestId: string) => Promise<void>
  fetchRequests: () => Promise<void>
}

export const useMessageStore = create<MessageStore>((set, get) => ({
  contacts: [],
  messages: [],
  selectedContactId: null,
  loading: false,
  error: null,

  pendingRequests: [],
  sentRequests: [],

  clearError: () => set({ error: null }),

  fetchContacts: async () => {
    set({ loading: true, error: null })
    const local = await loadLocal()
    let changed = false
    for (const convId of Object.keys(local.messages)) {
      const before = local.messages[convId].length
      local.messages[convId] = local.messages[convId].filter(m => !isSelfDestructed(m))
      if (local.messages[convId].length !== before) changed = true
    }
    if (changed) await saveLocal(local)
    const contacts = local.contacts.length > 0
      ? local.contacts
      : [
          { id: "agent-1", name: "Alex Mercer", avatar: null },
          { id: "agent-2", name: "Sam Rivera", avatar: null },
        ]
    if (local.contacts.length === 0) {
      await saveLocal({ contacts, messages: local.messages })
    }
    set({ contacts, loading: false })
  },

  fetchConversation: async (userId: string) => {
    set({ loading: true, error: null })
    const local = await loadLocal()
    const myId = getMyId()
    const convId = myId ? conversationId(myId, userId) : userId
    const raw = local.messages[convId] || []
    let changed = false
    const processed = raw.map(m => {
      if (!m.isRead && m.senderId !== myId && m.oneTimeView) {
        changed = true
        return { ...m, isRead: true, readAt: new Date().toISOString() }
      }
      return m
    })
    const filtered = processed.filter(m => !isSelfDestructed(m))
    if (changed || filtered.length !== raw.length) {
      local.messages[convId] = filtered
      await saveLocal(local)
    }
    const decrypted = await Promise.all(filtered.map(async (m) => ({
      ...m,
      content: (m.encrypted && m.type === "text") ? await decryptMessageContent(m.content) : m.content,
    })))
    set({ messages: decrypted, loading: false })
  },

  sendMessage: async (receiverId, content, selfDestruct = false, encrypted = true, oneTimeView = false, msgType: Message["type"] = "text") => {
    set({ error: null })
    const myId = getMyId() || "local-user"
    const convId = conversationId(myId, receiverId)

    const finalContent = (encrypted && msgType === "text") ? await encryptMessageContent(content) : content
    const msg: Message = {
      id: genId(),
      senderId: myId,
      receiverId,
      content: finalContent,
      type: msgType,
      encrypted: msgType === "text" && encrypted,
      selfDestruct,
      oneTimeView,
      isRead: false,
      createdAt: new Date().toISOString(),
    }
    const local = await loadLocal()
    if (!local.messages[convId]) local.messages[convId] = []
    local.messages[convId].push(msg)
    await saveLocal(local)
    set({ messages: [...get().messages, { ...msg, content }] })
  },

  editMessage: async (messageId: string, newContent: string) => {
    const myId = getMyId()
    if (!myId) return
    const local = await loadLocal()
    let found = false
    for (const convId of Object.keys(local.messages)) {
      const idx = local.messages[convId].findIndex(m => m.id === messageId)
      if (idx !== -1) {
        if (local.messages[convId][idx].senderId !== myId) return
        const isText = local.messages[convId][idx].type === "text"
        local.messages[convId][idx] = {
          ...local.messages[convId][idx],
          content: isText && local.messages[convId][idx].encrypted
            ? await encryptMessageContent(newContent)
            : newContent,
          editedAt: new Date().toISOString(),
        }
        found = true
        break
      }
    }
    if (!found) return
    await saveLocal(local)
    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId ? { ...m, content: newContent, editedAt: new Date().toISOString() } : m
      ),
    }))
  },

  deleteMessage: async (messageId: string) => {
    const myId = getMyId()
    if (!myId) return
    const local = await loadLocal()
    let found = false
    for (const convId of Object.keys(local.messages)) {
      const idx = local.messages[convId].findIndex(m => m.id === messageId)
      if (idx !== -1) {
        if (local.messages[convId][idx].senderId !== myId) return
        local.messages[convId][idx] = {
          ...local.messages[convId][idx],
          isDeleted: true,
          content: "[deleted]",
        }
        found = true
        break
      }
    }
    if (!found) return
    await saveLocal(local)
    set(state => ({
      messages: state.messages.filter(m => m.id !== messageId),
    }))
  },

  addContact: async (id: string, name: string) => {
    const newContact: Contact = { id, name, avatar: null }
    const local = await loadLocal()
    if (!local.contacts.some(c => c.id === id)) {
      local.contacts.push(newContact)
      await saveLocal(local)
    }
    set({ contacts: [...get().contacts, newContact] })
  },

  removeContact: async (id: string) => {
    const local = await loadLocal()
    const updated = local.contacts.filter(c => c.id !== id)
    await saveLocal({ ...local, contacts: updated })
    set(state => ({
      contacts: updated,
      selectedContactId: state.selectedContactId === id ? null : state.selectedContactId,
    }))
  },

  selectContact: (id: string | null) => set({ selectedContactId: id }),

  reorderContacts: async (contacts: Contact[]) => {
    const local = await loadLocal()
    await saveLocal({ ...local, contacts })
    set({ contacts })
  },

  searchUsers: async (query: string): Promise<User[]> => {
    const q = query.toLowerCase()
    try {
      const token = useAuthStore.getState().accessToken
      if (token) {
        const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"
        const res = await fetch(`${API}/users/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.users?.length > 0) return data.users
        }
      }
    } catch {}
    const seen = new Set<string>()
    const results: User[] = []
    for (const u of DEMO_USERS) {
      if (seen.has(u.id)) continue
      seen.add(u.id)
      if (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) {
        results.push({ id: u.id, name: u.name, email: u.email, role: "viewer", isVerified: true, isMFAEnabled: false, createdAt: "", updatedAt: "" })
      }
    }
    return results
  },

  sendContactRequest: async (userId: string, userName?: string) => {
    const myId = getMyId() || "local-user"
    const name = userName || CONTACT_NAMES[userId] || userId
    const myName = (() => {
      try { return useAuthStore.getState().user?.name } catch { return null }
    })() || "Unknown User"
    const req: ContactRequest = {
      id: genId(),
      fromUserId: myId,
      fromUserName: myName,
      fromUserEmail: "",
      toUserId: userId,
      toUserName: name,
      toUserEmail: "",
      status: "pending",
      createdAt: new Date().toISOString(),
    }
    const local = await loadLocalRequests()
    await saveLocalRequests([req, ...local])
    const all = await loadLocalRequests()
    set({
      sentRequests: all.filter(r => r.fromUserId === myId && r.status === "pending"),
    })
  },

  acceptContactRequest: async (requestId: string) => {
    const req = get().pendingRequests.find(r => r.id === requestId)
    if (!req) return
    const myId = getMyId() || "local-user"
    const local = await loadLocalRequests()
    const updated = local.map(r =>
      r.id === requestId ? { ...r, status: "accepted" as const } : r
    )
    await saveLocalRequests(updated)
    const newContact: Contact = { id: req.fromUserId, name: req.fromUserName, avatar: null }
    const data = await loadLocal()
    if (!data.contacts.some(c => c.id === newContact.id)) {
      data.contacts.push(newContact)
      await saveLocal(data)
    }
    set({
      contacts: data.contacts,
      selectedContactId: newContact.id,
      pendingRequests: updated.filter(r => r.toUserId === myId && r.status === "pending"),
    })
  },

  rejectContactRequest: async (requestId: string) => {
    const myId = getMyId() || "local-user"
    const local = await loadLocalRequests()
    const updated = local.filter(r => r.id !== requestId)
    await saveLocalRequests(updated)
    set({
      pendingRequests: updated.filter(r => r.toUserId === myId && r.status === "pending"),
    })
  },

  cancelContactRequest: async (requestId: string) => {
    const myId = getMyId() || "local-user"
    const local = await loadLocalRequests()
    const updated = local.filter(r => !(r.id === requestId && r.fromUserId === myId))
    await saveLocalRequests(updated)
    set({
      sentRequests: updated.filter(r => r.fromUserId === myId && r.status === "pending"),
    })
  },

  fetchRequests: async () => {
    const myId = getMyId() || "local-user"
    let local = await loadLocalRequests()
    if (local.length === 0) {
      const demoReqs: ContactRequest[] = [
        {
          id: "req-demo-1",
          fromUserId: "agent-3",
          fromUserName: "Jordan Chase",
          fromUserEmail: "jordan.chase@shield.gov",
          toUserId: myId,
          toUserName: "You",
          toUserEmail: "",
          status: "pending",
          createdAt: new Date().toISOString(),
        },
      ]
      await saveLocalRequests(demoReqs)
      local = demoReqs
    }
    const sent = local.filter(r => r.fromUserId === myId && r.status === "pending")
    const pending = local.filter(r => r.toUserId === myId && r.status === "pending")
    set({ pendingRequests: pending, sentRequests: sent })
  },
}))

const SESSION_ID_KEY = "stegshield_session_id"

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr"
  let id = localStorage.getItem(SESSION_ID_KEY)
  if (!id) {
    id = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(SESSION_ID_KEY, id)
  }
  return id
}

function getMyId(): string | null {
  const token = typeof window !== "undefined" ? useAuthStore.getState().accessToken : null
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]))
      if (payload.sub || payload.id) return payload.sub || payload.id
    } catch {}
  }
  try {
    const user = useAuthStore.getState().user
    if (user?.id) return user.id
  } catch {}
  return getSessionId()
}
