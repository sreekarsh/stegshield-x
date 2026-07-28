"use client"

import { useEffect, useRef, useState } from "react"
import type { User } from "@/types"
import {
  Send, Lock, Trash2, Clock, CheckCheck, Loader2, MessageSquare,
  AlertCircle, Search, UserPlus, UserCheck, UserX, Eye,
  X, Check, Bell, Users, ArrowLeft, Pencil, Trash,
  Plus, ImageIcon, Film, FileText, Smile,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useMessageStore } from "@/store/useMessageStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useDebounce } from "@/hooks/useDebounce"
import toast from "react-hot-toast"

type SidebarView = "contacts" | "search" | "requests"

export default function SecureMessagingPage() {
  const {
    contacts, messages, selectedContactId, loading, error,
    pendingRequests, sentRequests,
    fetchContacts, fetchConversation, sendMessage, editMessage, deleteMessage,
    selectContact, reorderContacts, removeContact, clearError,
    searchUsers, sendContactRequest, acceptContactRequest,
    rejectContactRequest, cancelContactRequest, fetchRequests,
  } = useMessageStore()
  const user = useAuthStore((s) => s.user)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [sending, setSending] = useState(false)
  const [messageText, setMessageText] = useState("")
  const [selfDestruct, setSelfDestruct] = useState(false)
  const [oneTimeView, setOneTimeView] = useState(false)
  const [encryptEnabled, setEncryptEnabled] = useState(true)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const [sidebarView, setSidebarView] = useState<SidebarView>("contacts")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [sendingRequest, setSendingRequest] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")
  const [showMediaMenu, setShowMediaMenu] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifQuery, setGifQuery] = useState("")
  const [gifResults, setGifResults] = useState<{ url: string; preview: string }[]>([])
  const [searchingGif, setSearchingGif] = useState(false)
  const [showStickerPicker, setShowStickerPicker] = useState(false)
  const [stickerCategory, setStickerCategory] = useState<"security" | "fun" | "emoji">("security")

  const STICKERS = [
    { id: "s1", category: "security", name: "Shield Guard", url: "https://cdn-icons-png.flaticon.com/512/2092/2092663.png" },
    { id: "s2", category: "security", name: "AES Lock", url: "https://cdn-icons-png.flaticon.com/512/3064/3064155.png" },
    { id: "s3", category: "security", name: "Hacker Mode", url: "https://cdn-icons-png.flaticon.com/512/924/924915.png" },
    { id: "s4", category: "security", name: "Secret Agent", url: "https://cdn-icons-png.flaticon.com/512/1022/1022313.png" },
    { id: "s5", category: "security", name: "Cyber Bot", url: "https://cdn-icons-png.flaticon.com/512/4712/4712109.png" },
    { id: "s6", category: "security", name: "Top Secret", url: "https://cdn-icons-png.flaticon.com/512/2913/2913465.png" },
    { id: "s7", category: "security", name: "Access Denied", url: "https://cdn-icons-png.flaticon.com/512/753/753345.png" },
    { id: "s8", category: "security", name: "Cyber Shield", url: "https://cdn-icons-png.flaticon.com/512/2438/2438078.png" },
    { id: "f1", category: "fun", name: "Hacker Cat", url: "https://cdn-icons-png.flaticon.com/512/616/616408.png" },
    { id: "f2", category: "fun", name: "Fire", url: "https://cdn-icons-png.flaticon.com/512/785/785116.png" },
    { id: "f3", category: "fun", name: "Celebration", url: "https://cdn-icons-png.flaticon.com/512/3132/3132743.png" },
    { id: "f4", category: "fun", name: "Cool Sunglasses", url: "https://cdn-icons-png.flaticon.com/512/166/166538.png" },
    { id: "f5", category: "fun", name: "Brainiac", url: "https://cdn-icons-png.flaticon.com/512/2996/2996898.png" },
    { id: "f6", category: "fun", name: "Rocket", url: "https://cdn-icons-png.flaticon.com/512/1356/1356479.png" },
    { id: "f7", category: "fun", name: "Trophy", url: "https://cdn-icons-png.flaticon.com/512/3112/3112946.png" },
    { id: "f8", category: "fun", name: "Target Locked", url: "https://cdn-icons-png.flaticon.com/512/3593/3593452.png" },
    { id: "e1", category: "emoji", name: "Thumbs Up", url: "https://cdn-icons-png.flaticon.com/512/179/179545.png" },
    { id: "e2", category: "emoji", name: "Check Mark", url: "https://cdn-icons-png.flaticon.com/512/190/190411.png" },
    { id: "e3", category: "emoji", name: "Warning Alert", url: "https://cdn-icons-png.flaticon.com/512/564/564619.png" },
    { id: "e4", category: "emoji", name: "Skull Security", url: "https://cdn-icons-png.flaticon.com/512/868/868779.png" },
    { id: "e5", category: "emoji", name: "Eye Watch", url: "https://cdn-icons-png.flaticon.com/512/709/709612.png" },
    { id: "e6", category: "emoji", name: "Key Access", url: "https://cdn-icons-png.flaticon.com/512/1086/1086741.png" },
  ]

  const handleStickerSelect = async (stickerUrl: string) => {
    if (!selectedContactId) return
    try {
      await sendMessage(selectedContactId, stickerUrl, false, false, false, "sticker")
      setShowStickerPicker(false)
      toast.success("Sticker sent")
    } catch {
      toast.error("Failed to send sticker")
    }
  }
  const fileInputRef = useRef<HTMLInputElement>(null)
  const genericFileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedContactId) return
    if (file.size > 25 * 1024 * 1024) { toast.error("File must be under 25MB"); return }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Format payload with filename prefix for proper display/download
      const payload = `${file.name}|${dataUrl}`
      sendMessage(selectedContactId, payload, false, false, false, "file")
        .then(() => toast.success(`File "${file.name}" sent`))
        .catch(() => toast.error("Failed to send file"))
    }
    reader.onerror = () => toast.error("Failed to read file")
    reader.readAsDataURL(file)
    e.target.value = ""
    setShowMediaMenu(false)
  }

  const debouncedSearch = useDebounce(searchQuery, 400)

  useEffect(() => {
    fetchContacts()
    fetchRequests()
  }, [fetchContacts, fetchRequests])

  useEffect(() => {
    if (selectedContactId) fetchConversation(selectedContactId)
  }, [selectedContactId, fetchConversation])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!debouncedSearch || debouncedSearch.length < 2) {
      setSearchResults([])
      return
    }
    let cancelled = false
    setSearching(true)
    searchUsers(debouncedSearch).then(results => {
      if (!cancelled) {
        const self = user && (user.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) || user.email?.toLowerCase().includes(debouncedSearch.toLowerCase()))
          ? [{ id: user.id, name: user.name || "", email: user.email || "", role: user.role, isVerified: user.isVerified, isMFAEnabled: user.isMFAEnabled, createdAt: user.createdAt || "", updatedAt: user.updatedAt || "" }]
          : []
        const others = results.filter(r => r.id !== user?.id)
        const merged = [...self, ...others]
        const deduped = merged.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
        setSearchResults(deduped)
        setSearching(false)
      }
    }).catch(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [debouncedSearch, searchUsers, user?.id])

  const handleSendRequest = async (userId: string, userName?: string) => {
    if (userId === user?.id) {
      toast.error("You cannot send a request to yourself")
      return
    }
    if (contacts.some(c => c.id === userId)) {
      toast.error("Already in your contacts")
      return
    }
    setSendingRequest(userId)
    try {
      await sendContactRequest(userId, userName)
      toast.success("Contact request sent")
    } catch {
      toast.error("Failed to send request")
    } finally {
      setSendingRequest(null)
    }
  }

  const handleAccept = async (requestId: string) => {
    setAcceptingId(requestId)
    try {
      await acceptContactRequest(requestId)
      setSidebarView("contacts")
      toast.success("Request accepted")
    } catch {
      toast.error("Failed to accept request")
    } finally {
      setAcceptingId(null)
    }
  }

  const handleReject = async (requestId: string) => {
    setRejectingId(requestId)
    try {
      await rejectContactRequest(requestId)
      toast.success("Request rejected")
    } catch {
      toast.error("Failed to reject request")
    } finally {
      setRejectingId(null)
    }
  }

  const handleCancelRequest = async (requestId: string) => {
    setCancellingId(requestId)
    try {
      await cancelContactRequest(requestId)
      toast.success("Request cancelled")
    } catch {
      toast.error("Failed to cancel request")
    } finally {
      setCancellingId(null)
    }
  }

  const handleSend = async () => {
    const text = messageText.trim()
    if (!text || !selectedContactId || sending) return
    setSending(true)
    setMessageText("")
    try {
      await sendMessage(selectedContactId, text, selfDestruct, encryptEnabled, oneTimeView)
    } catch {
      toast.error("Failed to send message")
    } finally {
      setSending(false)
      setSelfDestruct(false)
      setOneTimeView(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedContactId) return
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return }
    if (file.size > 15 * 1024 * 1024) { toast.error("Image must be under 15MB"); return }

    const MAX_DIMENSION = 640
    const QUALITY = 0.65
    const USE_WEBP = true

    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round(height * MAX_DIMENSION / width)
          width = MAX_DIMENSION
        } else {
          width = Math.round(width * MAX_DIMENSION / height)
          height = MAX_DIMENSION
        }
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) { toast.error("Failed to process image"); return }
      ctx.drawImage(img, 0, 0, width, height)

      // Prefer WebP for better compression, fallback to JPEG
      const supportsWebp = canvas.toDataURL("image/webp").startsWith("data:image/webp")
      const mimeType = supportsWebp ? "image/webp" : "image/jpeg"
      let dataUrl = canvas.toDataURL(mimeType, QUALITY)

      // Safety cap: if still > 300KB, recompress lower
      const sizeKB = Math.round(dataUrl.length * 0.75 / 1024)
      if (sizeKB > 300) {
        const lowerQuality = Math.max(0.25, QUALITY * 300 / sizeKB)
        dataUrl = canvas.toDataURL(mimeType, lowerQuality)
      }
      sendMessage(selectedContactId, dataUrl, false, false, false, "image")
        .then(() => toast.success("Image sent"))
        .catch(() => toast.error("Failed to send image"))
    }
    img.onerror = () => toast.error("Failed to load image")
    img.src = URL.createObjectURL(file)
    e.target.value = ""
    setShowMediaMenu(false)
  }

  const handleGifSelect = async (gifUrl: string) => {
    if (!selectedContactId) return
    try {
      await sendMessage(selectedContactId, gifUrl, false, false, false, "gif")
      setShowGifPicker(false)
      setGifQuery("")
      setGifResults([])
    } catch { toast.error("Failed to send GIF") }
  }

  const FALLBACK_GIFS = [
    {
      title: "Hacking Cyber Matrix",
      keywords: ["hack", "cyber", "code", "matrix", "security"],
      url: "https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif",
      preview: "https://media.giphy.com/media/l0HlHFRbmaZtBRhXG/giphy.gif",
    },
    {
      title: "Cat Typing",
      keywords: ["cat", "typing", "work", "fast", "computer"],
      url: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
      preview: "https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif",
    },
    {
      title: "Thumbs Up",
      keywords: ["yes", "ok", "thumbs up", "agree", "like", "approve"],
      url: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif",
      preview: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyM/giphy.gif",
    },
    {
      title: "Success Celebration",
      keywords: ["success", "party", "celebrate", "win"],
      url: "https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif",
      preview: "https://media.giphy.com/media/26tn33aiTi1jkl6H6/giphy.gif",
    },
    {
      title: "Approved Security",
      keywords: ["lock", "shield", "secure", "check", "pass"],
      url: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
      preview: "https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif",
    },
    {
      title: "Mind Blown",
      keywords: ["wow", "mind blown", "amazing", "cool"],
      url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
      preview: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
    },
    {
      title: "Loading Processing",
      keywords: ["wait", "load", "process", "think"],
      url: "https://media.giphy.com/media/d31w24psGYeekCXY/giphy.gif",
      preview: "https://media.giphy.com/media/d31w24psGYeekCXY/giphy.gif",
    },
    {
      title: "Hacker Dog",
      keywords: ["dog", "hacker", "cyber", "cool"],
      url: "https://media.giphy.com/media/13Hgw8T855Cp96/giphy.gif",
      preview: "https://media.giphy.com/media/13Hgw8T855Cp96/giphy.gif",
    },
  ]

  const searchGifs = async (query: string) => {
    setSearchingGif(true)
    const isTrending = !query || query === "trending"
    try {
      const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "GlVGYHkrB1wvj7iVnR3M5JQflSJx1F6A"
      const url = !isTrending
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=20&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`
      const res = await fetch(url)
      if (!res.ok) throw new Error("Giphy API error " + res.status)
      const data = await res.json()
      if (Array.isArray(data?.data) && data.data.length > 0) {
        setGifResults(data.data.map((g: any) => ({
          url: g.images.original.url,
          preview: g.images.fixed_width_small?.url || g.images.original.url,
        })))
        return
      }
      throw new Error("No GIFs returned")
    } catch {
      const q = query.toLowerCase().trim()
      const filtered = isTrending || q === "trending"
        ? FALLBACK_GIFS
        : FALLBACK_GIFS.filter(g =>
            g.title.toLowerCase().includes(q) ||
            g.keywords.some(k => k.includes(q))
          )
      setGifResults(filtered.length > 0 ? filtered : FALLBACK_GIFS)
    } finally { setSearchingGif(false) }
  }

  const debouncedGifSearch = useDebounce(gifQuery, 400)

  useEffect(() => {
    if (showGifPicker && debouncedGifSearch.length >= 1) {
      searchGifs(debouncedGifSearch)
    } else if (showGifPicker && !debouncedGifSearch) {
      searchGifs("trending")
    }
  }, [debouncedGifSearch, showGifPicker])

  const selectedContact = contacts.find((c) => c.id === selectedContactId)
  const pendingCount = pendingRequests.length

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto text-destructive hover:text-destructive/80" onClick={clearError}>×</button>
        </div>
      )}

      <div className="h-[calc(100vh-8rem)] flex gap-6">
        {/* Sidebar */}
        <Card className="w-80 shrink-0 glass-card flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>Secure Chat</span>
              <div className="flex items-center gap-1">
                <Badge variant="cyber" className="text-[10px]">AES-256</Badge>
              </div>
            </CardTitle>
            <div className="flex border-b border-border -mx-6 px-6 pb-0 mt-2">
              <button
                className={`flex-1 pb-2 text-xs font-medium border-b-2 transition-colors ${
                  sidebarView === "contacts"
                    ? "border-cyber-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSidebarView("contacts")}
              >
                <Users className="h-3.5 w-3.5 inline mr-1" /> Contacts
              </button>
              <button
                className={`flex-1 pb-2 text-xs font-medium border-b-2 transition-colors ${
                  sidebarView === "search"
                    ? "border-cyber-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSidebarView("search")}
              >
                <Search className="h-3.5 w-3.5 inline mr-1" /> Discover
              </button>
              <button
                className={`flex-1 pb-2 text-xs font-medium border-b-2 transition-colors relative ${
                  sidebarView === "requests"
                    ? "border-cyber-500 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSidebarView("requests")}
              >
                <Bell className="h-3.5 w-3.5 inline mr-1" /> Requests
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-1">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-hidden p-2 pt-0">
            {sidebarView === "contacts" && (
              <div className="overflow-y-auto h-full space-y-0.5 pt-2">
                {contacts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground mb-1">No contacts yet</p>
                    <p className="text-xs text-muted-foreground mb-3">Search for users to start messaging</p>
                    <Button variant="outline" size="sm" onClick={() => setSidebarView("search")}>
                      <Search className="h-3 w-3 mr-1" /> Find People
                    </Button>
                  </div>
                )}
                {contacts
                  .filter((c) => c.id !== user?.id)
                  .map((contact, index) => (
                    <div
                      key={contact.id}
                      className={`group flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        selectedContactId === contact.id ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      <button
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        onDragOver={(e) => {
                          e.preventDefault()
                          if (dragIndex === null || dragIndex === index) return
                          const reordered = [...contacts]
                          const [moved] = reordered.splice(dragIndex, 1)
                          reordered.splice(index, 0, moved)
                          setDragIndex(index)
                          useMessageStore.setState({ contacts: reordered })
                        }}
                        onDragEnd={() => {
                          if (dragIndex !== null) {
                            reorderContacts(useMessageStore.getState().contacts)
                          }
                          setDragIndex(null)
                        }}
                        onClick={() => selectContact(contact.id)}
                        className={`flex-1 flex items-center gap-3 cursor-grab active:cursor-grabbing ${
                          dragIndex === index ? "opacity-50" : ""
                        }`}
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="bg-cyber-500/20 text-cyber-400">
                            {contact.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-sm font-medium truncate">{contact.name}</p>
                        </div>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeContact(contact.id)
                        }}
                        className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                        title="Remove contact"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {sidebarView === "search" && (
              <div className="pt-2 space-y-2 h-full flex flex-col">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 h-9 text-sm"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => { setSearchQuery(""); setSearchResults([]) }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1">
                  {searching && (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <UserX className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                      <p className="text-sm text-muted-foreground">No users found</p>
                      <p className="text-xs text-muted-foreground">Try a different name or email</p>
                    </div>
                  )}
                  {!searching && searchResults.length > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground px-1 py-2 font-medium">
                        Found {searchResults.length} user{searchResults.length !== 1 ? "s" : ""}
                      </p>
                      {searchResults.map((u) => {
                        const isSelf = u.id === user?.id
                        const isContact = contacts.some(c => c.id === u.id)
                        const isPending = sentRequests.some(r => r.toUserId === u.id)
                        return (
                          <div
                            key={u.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <Avatar className="h-10 w-10 shrink-0">
                              <AvatarFallback className="bg-cyber-500/20 text-cyber-400">
                                {u.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{u.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                            {isSelf ? (
                              <Badge variant="outline" className="text-[10px] shrink-0 text-muted-foreground">
                                <UserCheck className="h-3 w-3 mr-1" /> That&apos;s you
                              </Badge>
                            ) : isContact ? (
                              <Badge variant="success" className="text-[10px] shrink-0">
                                <UserCheck className="h-3 w-3 mr-1" /> Contact
                              </Badge>
                            ) : isPending ? (
                              <Badge variant="outline" className="text-[10px] shrink-0 text-warning">
                                <Clock className="h-3 w-3 mr-1" /> Pending
                              </Badge>
                            ) : (
                              <Button
                                variant="cyber"
                                size="sm"
                                className="h-8 text-xs shrink-0"
                                onClick={() => handleSendRequest(u.id, u.name)}
                                disabled={sendingRequest === u.id}
                              >
                                {sendingRequest === u.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <UserPlus className="h-3 w-3 mr-1" />
                                )}
                                Add
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </>
                  )}
                  {searchQuery.length < 2 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Search className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                      <p className="text-sm text-muted-foreground">Search for people</p>
                      <p className="text-xs text-muted-foreground">Type at least 2 characters to find users</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {sidebarView === "requests" && (
              <div className="pt-2 space-y-3 h-full overflow-y-auto">
                {pendingRequests.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground px-1 mb-2">
                      Incoming ({pendingRequests.length})
                    </p>
                    <div className="space-y-2">
                      {pendingRequests.map((req) => (
                        <div key={req.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-cyber-500/20 text-cyber-400">
                              {req.fromUserName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{req.fromUserName}</p>
                            <p className="text-xs text-muted-foreground truncate">{req.fromUserEmail || "Wants to connect"}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="cyber"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleAccept(req.id)}
                              disabled={acceptingId === req.id}
                              title="Accept"
                            >
                              {acceptingId === req.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleReject(req.id)}
                              disabled={rejectingId === req.id}
                              title="Reject"
                            >
                              {rejectingId === req.id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <X className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sentRequests.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground px-1 mb-2 pt-2 border-t border-border">
                      Sent ({sentRequests.length})
                    </p>
                    <div className="space-y-2">
                      {sentRequests.map((req) => (
                        <div key={req.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              {req.toUserName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{req.toUserName}</p>
                            <p className="text-xs text-muted-foreground">Request pending</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            <Clock className="h-3 w-3 mr-1" /> Pending
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleCancelRequest(req.id)}
                            disabled={cancellingId === req.id}
                            title="Cancel request"
                          >
                            {cancellingId === req.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <X className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pendingRequests.length === 0 && sentRequests.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Bell className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground mb-1">No pending requests</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Search for people and send them a contact request
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setSidebarView("search")}>
                      <Search className="h-3 w-3 mr-1" /> Find People
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat area */}
        <Card className="flex-1 glass-card flex flex-col">
          {!selectedContactId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <MessageSquare className="h-14 w-14 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">Your Secure Messages</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  AES-256-GCM encrypted messaging with self-destruct options.
                  Select a contact to start a conversation or discover new people.
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Badge variant="cyber" className="text-xs"><Lock className="h-3 w-3 mr-1" /> AES-256-GCM</Badge>
                  <Badge variant="outline" className="text-xs"><Trash2 className="h-3 w-3 mr-1" /> Self-Destruct</Badge>
                </div>
              </div>
            </div>
          ) : (
            <>
              <CardHeader className="border-b border-border py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1 hidden sm:flex" onClick={() => selectContact(null)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-cyber-500/20 text-cyber-400 text-xs">
                        {selectedContact?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{selectedContact?.name || "Unknown"}</p>
                      <p className="text-[11px] flex items-center gap-1">
                        {encryptEnabled ? (
                          <><Lock className="h-3 w-3 text-success" /><span className="text-success">AES-256-GCM</span></>
                        ) : (
                          <><span className="text-warning">Unencrypted</span></>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.success("Encryption active")}>
                      <Lock className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!loading && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground">Send the first encrypted message</p>
                  </div>
                )}
                {messages.map((msg) => {
                  const isMe = msg.senderId === user?.id
                  const isEditing = editingMessageId === msg.id
                  const msgDate = msg.editedAt ? msg.editedAt : msg.createdAt
                  return (
                    <div key={msg.id} className={`group flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] p-3 rounded-2xl ${
                        isMe
                          ? "bg-cyber-500/20 text-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}>
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full bg-background border border-border rounded-md p-2 text-sm resize-none min-h-[60px]"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              autoFocus
                            />
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setEditingMessageId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="cyber"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={async () => {
                                  const trimmed = editText.trim()
                                  if (!trimmed) return
                                  await editMessage(msg.id, trimmed)
                                  setEditingMessageId(null)
                                }}
                              >
                                <Check className="h-3 w-3 mr-1" /> Save
                              </Button>
                            </div>
                          </div>
                        ) : msg.type === "image" ? (
                          <img
                            src={msg.content}
                            alt="Shared image"
                            className="max-w-full rounded-lg cursor-pointer"
                            onClick={() => window.open(msg.content, "_blank")}
                            loading="lazy"
                          />
                        ) : msg.type === "gif" ? (
                          <img
                            src={msg.content}
                            alt="Shared GIF"
                            className="max-w-full rounded-lg cursor-pointer"
                            onClick={() => window.open(msg.content, "_blank")}
                            loading="lazy"
                          />
                        ) : msg.type === "file" ? (
                          (() => {
                            const pipeIdx = msg.content.indexOf("|")
                            const fileName = pipeIdx !== -1 ? msg.content.substring(0, pipeIdx) : "Shared File"
                            const fileDataUrl = pipeIdx !== -1 ? msg.content.substring(pipeIdx + 1) : msg.content
                            return (
                              <div className="flex items-center gap-3 p-2 rounded-lg bg-background/40 border border-border/50">
                                <FileText className="h-8 w-8 text-cyber-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{fileName}</p>
                                  <a
                                    href={fileDataUrl}
                                    download={fileName}
                                    className="text-xs text-cyber-400 hover:underline font-semibold"
                                  >
                                    Download File
                                  </a>
                                </div>
                              </div>
                            )
                          })()
                        ) : msg.type === "sticker" ? (
                          <div className="p-1 flex items-center justify-center">
                            <img
                              src={msg.content}
                              alt="Sticker"
                              className="w-28 h-28 object-contain drop-shadow-lg cursor-pointer hover:scale-110 transition-transform"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/3064/3064155.png"
                              }}
                            />
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                        <div className="flex items-center justify-end gap-1 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msgDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {msg.editedAt && <span className="text-[9px] ml-1 text-muted-foreground/60">(edited)</span>}
                          </span>
                          {isMe && (
                            <CheckCheck className={`h-3 w-3 ${msg.isRead ? "text-info" : "text-muted-foreground"}`} />
                          )}
                          {msg.oneTimeView && (
                            <span title="One-time view"><Eye className="h-3 w-3 text-warning/80" /></span>
                          )}
                          {msg.selfDestruct && !msg.oneTimeView && (
                            <span title="Self-destruct enabled"><Trash2 className="h-3 w-3 text-destructive/60" /></span>
                          )}
                        </div>
                        {isMe && !isEditing && (
                          <div className="flex justify-end gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditText(msg.content); setEditingMessageId(msg.id) }}
                              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={async () => { await deleteMessage(msg.id) }}
                              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete"
                            >
                              <Trash className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </CardContent>

              <div className="p-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowMediaMenu(!showMediaMenu)}
                      title="Add media"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                    {showMediaMenu && (
                      <>
                        <div className="absolute bottom-full left-0 mb-2 bg-popover border border-border rounded-lg shadow-lg p-1.5 flex gap-1 z-50">
                          <button
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium hover:bg-accent transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <ImageIcon className="h-4 w-4 text-blue-400" /> Photo
                          </button>
                          <button
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium hover:bg-accent transition-colors"
                            onClick={() => { setShowGifPicker(true); setShowMediaMenu(false) }}
                          >
                            <Film className="h-4 w-4 text-purple-400" /> GIF
                          </button>
                          <button
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium hover:bg-accent transition-colors"
                            onClick={() => { setShowStickerPicker(true); setShowMediaMenu(false) }}
                          >
                            <Smile className="h-4 w-4 text-yellow-400" /> Sticker
                          </button>
                          <button
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium hover:bg-accent transition-colors"
                            onClick={() => genericFileInputRef.current?.click()}
                          >
                            <FileText className="h-4 w-4 text-emerald-400" /> File
                          </button>
                        </div>
                        <div className="fixed inset-0 z-40" onClick={() => setShowMediaMenu(false)} />
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <input
                      ref={genericFileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </div>
                  <Input
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type an encrypted message..."
                    className="flex-1"
                    disabled={sending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                  />
                  <Button variant="cyber" size="icon" onClick={handleSend} disabled={sending || !messageText.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant={oneTimeView ? "default" : "outline"}
                    size="icon"
                    onClick={() => { setOneTimeView(!oneTimeView); if (!oneTimeView) setSelfDestruct(false) }}
                    title="One-time view"
                    className={oneTimeView ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={selfDestruct ? "destructive" : "outline"}
                    size="icon"
                    onClick={() => { setSelfDestruct(!selfDestruct); if (!selfDestruct) setOneTimeView(false) }}
                    title="Self-destruct"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    variant={encryptEnabled ? "default" : "outline"}
                    className={`text-[10px] cursor-pointer select-none transition-all ${encryptEnabled ? "bg-cyber-500 hover:bg-cyber-600" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setEncryptEnabled(!encryptEnabled)}
                    title="Toggle AES-256-GCM encryption"
                  >
                    <Lock className="h-3 w-3 mr-1 inline" />
                    {encryptEnabled ? "Encrypted (AES-256)" : "Unencrypted"}
                  </Badge>

                  <Badge
                    variant={oneTimeView ? "default" : "outline"}
                    className={`text-[10px] cursor-pointer select-none transition-all ${oneTimeView ? "bg-amber-500 text-white hover:bg-amber-600" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => { setOneTimeView(!oneTimeView); if (!oneTimeView) setSelfDestruct(false) }}
                    title="Toggle One-Time View (disappears after being opened once)"
                  >
                    <Eye className="h-3 w-3 mr-1 inline" />
                    {oneTimeView ? "One-Time View (Active)" : "One-Time View"}
                  </Badge>

                  <Badge
                    variant={selfDestruct ? "destructive" : "outline"}
                    className={`text-[10px] cursor-pointer select-none transition-all ${selfDestruct ? "" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => { setSelfDestruct(!selfDestruct); if (!selfDestruct) setOneTimeView(false) }}
                    title="Toggle Auto-Delete (self-destruct after 24h)"
                  >
                    <Trash2 className="h-3 w-3 mr-1 inline" />
                    {selfDestruct ? "Auto-Delete (Active)" : "Auto-Delete"}
                  </Badge>
                </div>
              </div>

              {/* GIF Picker Modal */}
              {showGifPicker && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                  <div className="fixed inset-0 bg-black/60" onClick={() => { setShowGifPicker(false); setGifResults([]); setGifQuery("") }} />
                  <div className="relative bg-popover border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[70vh] flex flex-col z-10">
                    <div className="flex items-center gap-2 p-3 border-b border-border">
                      <Input
                        value={gifQuery}
                        onChange={(e) => setGifQuery(e.target.value)}
                        placeholder="Search GIFs..."
                        className="flex-1 h-9 text-sm"
                        autoFocus
                      />
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setShowGifPicker(false); setGifResults([]); setGifQuery("") }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3">
                      {searchingGif && (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {!searchingGif && gifResults.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Film className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                          <p className="text-sm text-muted-foreground">Search for GIFs or browse trending</p>
                        </div>
                      )}
                      {gifResults.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {gifResults.map((gif, i) => (
                            <button
                              key={i}
                              className="rounded-lg overflow-hidden hover:ring-2 hover:ring-cyber-500 transition-all"
                              onClick={() => handleGifSelect(gif.url)}
                            >
                              <img
                                src={gif.preview}
                                alt="GIF"
                                className="w-full h-32 object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=60"
                                }}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sticker Picker Modal */}
              {showStickerPicker && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                  <div className="fixed inset-0 bg-black/60" onClick={() => setShowStickerPicker(false)} />
                  <div className="relative bg-popover border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[65vh] flex flex-col z-10">
                    <div className="flex items-center justify-between p-3 border-b border-border">
                      <div className="flex items-center gap-1.5">
                        <Smile className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm font-semibold">Select Sticker</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowStickerPicker(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex border-b border-border px-3 bg-muted/20">
                      <button
                        className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                          stickerCategory === "security"
                            ? "border-cyber-500 text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setStickerCategory("security")}
                      >
                        Cyber & Security
                      </button>
                      <button
                        className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                          stickerCategory === "fun"
                            ? "border-cyber-500 text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setStickerCategory("fun")}
                      >
                        Fun & Tech
                      </button>
                      <button
                        className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                          stickerCategory === "emoji"
                            ? "border-cyber-500 text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setStickerCategory("emoji")}
                      >
                        Expressive
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="grid grid-cols-4 gap-3">
                        {STICKERS.filter(s => s.category === stickerCategory).map((st) => (
                          <button
                            key={st.id}
                            className="flex flex-col items-center p-2 rounded-xl border border-border/40 hover:border-cyber-500 hover:bg-accent/50 hover:scale-105 transition-all group"
                            onClick={() => handleStickerSelect(st.url)}
                            title={st.name}
                          >
                            <img
                              src={st.url}
                              alt={st.name}
                              className="w-14 h-14 object-contain group-hover:scale-110 transition-transform"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "https://cdn-icons-png.flaticon.com/512/3064/3064155.png"
                              }}
                            />
                            <span className="text-[10px] text-muted-foreground mt-1 truncate max-w-full font-medium">
                              {st.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
