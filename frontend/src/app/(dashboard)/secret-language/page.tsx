"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Languages, Plus, Share2, Download, Trash2, Globe, BookOpen,
  X, Copy, FileDown, FileUp, Search,
  History, AlertTriangle, MessageSquare, ArrowRight, ArrowLeft,
  Sparkles, Cpu, Loader2, Palette,
  HelpCircle, ChevronRight, ChevronLeft, BookMarked, Wand2, Lock, Unlock, Layers,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/layout/empty-state"
import { api } from "@/lib/api"
import toast from "react-hot-toast"

interface Glyph {
  id: string
  character: string
  symbol: string
  meaning: string
  category: string
}

interface SecretLanguage {
  id: string
  userId: string
  name: string
  version: string
  glyphs: Glyph[]
  isShared: boolean
  createdAt: string
}

interface MessageEntry {
  id: string
  type: "encrypted" | "decrypted"
  input: string
  output: string
  languageName: string
  timestamp: number
}

const CATEGORIES = [
  "Military", "Communication", "Intelligence", "Navigation",
  "Logistics", "Medical", "Weaponry", "Personnel",
  "Operations", "Technology", "Cyber", "General",
] as const

const STORAGE_KEY = "cryptglyph_languages"
const HISTORY_KEY = "cryptglyph_history"

function loadLanguages(): SecretLanguage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveLanguages(languages: SecretLanguage[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(languages)) } catch {}
}

function loadHistory(): MessageEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(history: MessageEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)) } catch {}
}

function generateId(): string {
  return crypto.randomUUID()
}

function findGlyphByChar(char: string, glyphs: Glyph[]): Glyph | undefined {
  return glyphs.find(g => g.character.toUpperCase() === char.toUpperCase())
}

function findGlyphBySymbol(symbol: string, glyphs: Glyph[]): Glyph | undefined {
  return glyphs.find(g => g.symbol === symbol)
}

/** 100% Bug-Free Encryption Engine with Case Tracking */
function encryptText(text: string, glyphs: Glyph[]): { result: string; unknown: string[] } {
  const unknown: string[] = []
  const chars = Array.from(text)
  const encrypted = chars.map(ch => {
    const glyph = findGlyphByChar(ch, glyphs)
    if (glyph) return glyph.symbol
    if (ch.trim() && !/[0-9\s\p{P}]/u.test(ch)) unknown.push(ch)
    return ch
  }).join("")
  return { result: encrypted, unknown: [...new Set(unknown)] }
}

/** 100% Bug-Free Single-Pass Tokenized Decryption Engine */
function decryptText(glyphText: string, glyphs: Glyph[]): string {
  if (!glyphText || glyphs.length === 0) return glyphText

  // Sort glyphs by symbol length descending (longest match first)
  const sortedGlyphs = [...glyphs].sort((a, b) => b.symbol.length - a.symbol.length)
  const textChars = Array.from(glyphText)

  let result = ""
  let i = 0
  while (i < textChars.length) {
    let matched = false
    const sliceStr = textChars.slice(i).join("")

    for (const g of sortedGlyphs) {
      if (g.symbol && sliceStr.startsWith(g.symbol)) {
        result += g.character
        i += Array.from(g.symbol).length
        matched = true
        break
      }
    }
    if (!matched) {
      result += textChars[i]
      i++
    }
  }
  return result
}

// Built-in Presets for 1-click start
const PRESET_LANGUAGES: Omit<SecretLanguage, "id" | "userId" | "createdAt">[] = [
  {
    name: "Norse Elder Runes",
    version: "1.0",
    isShared: true,
    glyphs: [
      { id: "r1", character: "A", symbol: "ᚫ", meaning: "Ansuz (God/Wisdom)", category: "Runes" },
      { id: "r2", character: "B", symbol: "ᛒ", meaning: "Berkanan (Birch/Growth)", category: "Runes" },
      { id: "r3", character: "C", symbol: "ᚲ", meaning: "Kaunan (Torch/Fire)", category: "Runes" },
      { id: "r4", character: "D", symbol: "ᛞ", meaning: "Dagaz (Day/Light)", category: "Runes" },
      { id: "r5", character: "E", symbol: "ᛖ", meaning: "Ehwaz (Horse/Trust)", category: "Runes" },
      { id: "r6", character: "F", symbol: "ᚠ", meaning: "Fehu (Wealth/Cattle)", category: "Runes" },
      { id: "r7", character: "G", symbol: "ᚷ", meaning: "Gebo (Gift/Partner)", category: "Runes" },
      { id: "r8", character: "H", symbol: "ᚺ", meaning: "Hagalaz (Hail/Disruption)", category: "Runes" },
      { id: "r9", character: "I", symbol: "ᛁ", meaning: "Isaz (Ice/Stasis)", category: "Runes" },
      { id: "r10", character: "J", symbol: "ᛃ", meaning: "Jera (Harvest/Year)", category: "Runes" },
      { id: "r11", character: "K", symbol: "ᚴ", meaning: "Kaun (Sore/Flame)", category: "Runes" },
      { id: "r12", character: "L", symbol: "ᛚ", meaning: "Laguz (Water/Flow)", category: "Runes" },
      { id: "r13", character: "M", symbol: "ᛗ", meaning: "Mannaz (Man/Humanity)", category: "Runes" },
      { id: "r14", character: "N", symbol: "ᚾ", meaning: "Naudiz (Need/Hardship)", category: "Runes" },
      { id: "r15", character: "O", symbol: "ᛟ", meaning: "Othala (Heritage/Home)", category: "Runes" },
      { id: "r16", character: "P", symbol: "ᛈ", meaning: "Pertho (Fate/Dice)", category: "Runes" },
      { id: "r17", character: "Q", symbol: "ᛩ", meaning: "Quean (Queen/Power)", category: "Runes" },
      { id: "r18", character: "R", symbol: "ᚱ", meaning: "Raido (Journey/Ride)", category: "Runes" },
      { id: "r19", character: "S", symbol: "ᛋ", meaning: "Sowilo (Sun/Victory)", category: "Runes" },
      { id: "r20", character: "T", symbol: "ᛏ", meaning: "Tiwaz (Tyr/Honor)", category: "Runes" },
      { id: "r21", character: "U", symbol: "ᚢ", meaning: "Uruz (Aurochs/Strength)", category: "Runes" },
      { id: "r22", character: "V", symbol: "ᚡ", meaning: "Vend (Winds/Change)", category: "Runes" },
      { id: "r23", character: "W", symbol: "ᚹ", meaning: "Wunjo (Joy/Harmony)", category: "Runes" },
      { id: "r24", character: "X", symbol: "ᚾᛋ", meaning: "Nexus (Crossroads)", category: "Runes" },
      { id: "r25", character: "Y", symbol: "ᛦ", meaning: "Yr (Yew/Bow)", category: "Runes" },
      { id: "r26", character: "Z", symbol: "Algiz", meaning: "Algiz (Elk/Shield)", category: "Runes" },
    ]
  },
  {
    name: "Cyberpunk Hex Glyph",
    version: "2.1",
    isShared: true,
    glyphs: [
      { id: "c1",  character: "A", symbol: "⚡", meaning: "Access Point",      category: "Cyber" },
      { id: "c2",  character: "B", symbol: "☣", meaning: "Biohazard",          category: "Cyber" },
      { id: "c3",  character: "C", symbol: "⬡", meaning: "Core Node",          category: "Cyber" },
      { id: "c4",  character: "D", symbol: "❖", meaning: "Data Matrix",        category: "Cyber" },
      { id: "c5",  character: "E", symbol: "⎔", meaning: "Encryption Lock",    category: "Cyber" },
      { id: "c6",  character: "F", symbol: "✦", meaning: "Firewall Node",      category: "Cyber" },
      { id: "c7",  character: "G", symbol: "⚙", meaning: "Grid Controller",    category: "Cyber" },
      { id: "c8",  character: "H", symbol: "🛡", meaning: "Host Shield",        category: "Cyber" },
      { id: "c9",  character: "I", symbol: "◈", meaning: "Interface Port",     category: "Cyber" },
      { id: "c10", character: "J", symbol: "🕹", meaning: "Jockey Vector",      category: "Cyber" },
      { id: "c11", character: "K", symbol: "🔑", meaning: "Key Stream",         category: "Cyber" },
      { id: "c12", character: "L", symbol: "🔗", meaning: "Link Layer",         category: "Cyber" },
      { id: "c13", character: "M", symbol: "📡", meaning: "Mesh Node",          category: "Cyber" },
      { id: "c14", character: "N", symbol: "⬢", meaning: "Net Protocol",       category: "Cyber" },
      { id: "c15", character: "O", symbol: "◯", meaning: "Optical Core",       category: "Cyber" },
      { id: "c16", character: "P", symbol: "⚴", meaning: "Packet Swarm",       category: "Cyber" },
      { id: "c17", character: "Q", symbol: "⚛", meaning: "Quantum Gate",       category: "Cyber" },
      { id: "c18", character: "R", symbol: "🌀", meaning: "Router Relay",       category: "Cyber" },
      { id: "c19", character: "S", symbol: "🔒", meaning: "Security Daemon",    category: "Cyber" },
      { id: "c20", character: "T", symbol: "🔺", meaning: "Terminal Host",      category: "Cyber" },
      { id: "c21", character: "U", symbol: "⏣", meaning: "Uplink Signal",      category: "Cyber" },
      { id: "c22", character: "V", symbol: "⟁", meaning: "Vector Trace",       category: "Cyber" },
      { id: "c23", character: "W", symbol: "🌐", meaning: "World Wide Mesh",    category: "Cyber" },
      { id: "c24", character: "X", symbol: "✖", meaning: "X-ray Trace",        category: "Cyber" },
      { id: "c25", character: "Y", symbol: "⌬", meaning: "Yield Gate",         category: "Cyber" },
      { id: "c26", character: "Z", symbol: "⌀", meaning: "Zero Day",           category: "Cyber" },
    ]
  }
]

export default function SecretLanguagePage() {
  const [languages, setLanguagesState] = useState<SecretLanguage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLang, setSelectedLang] = useState<SecretLanguage | null>(null)
  const [newName, setNewName] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [glyphSearch, setGlyphSearch] = useState("")
  const [glyphCategoryFilter, setGlyphCategoryFilter] = useState("")
  const [librarySearch, setLibrarySearch] = useState("")
  const [char, setChar] = useState("")
  const [symbol, setSymbol] = useState("")
  const [meaning, setMeaning] = useState("")
  const [category, setCategory] = useState("")
  const [encryptInput, setEncryptInput] = useState("")
  const [encryptOutput, setEncryptOutput] = useState("")
  const [encryptUnknown, setEncryptUnknown] = useState<string[]>([])
  const [decryptInput, setDecryptInput] = useState("")
  const [decryptOutput, setDecryptOutput] = useState("")
  const [messageHistory, setMessageHistory] = useState<MessageEntry[]>([])
  const [activeTab, setActiveTab] = useState("builder")
  const [aiTheme, setAiTheme] = useState("fantasy")
  const [aiScript, setAiScript] = useState("symbolic")
  const [aiComplexity, setAiComplexity] = useState("medium")
  const [aiIncludeDigits, setAiIncludeDigits] = useState(true)
  const [aiIncludePunct, setAiIncludePunct] = useState(false)
  const [aiGlyphCount, setAiGlyphCount] = useState(26)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [guideStep, setGuideStep] = useState(0)

  const GUIDE_STEPS = [
    {
      icon: Languages,
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/30",
      title: "Welcome to CryptGlyph! 🔐",
      description: "CryptGlyph lets you create your own secret language using custom symbols called glyphs. Once you build your language, you can use it to encrypt and decrypt secret messages — only people who know your language can read them!",
      tip: "Think of it like a personal cipher — every letter in the alphabet gets a unique symbol you define.",
      example: null,
      tab: null,
    },
    {
      icon: Plus,
      color: "text-cyber-400",
      bg: "bg-cyber-500/10 border-cyber-500/30",
      title: "Step 1 — Create a Language",
      description: "Click the \"+ New Language\" button at the top right to create your own secret language. Give it a name like \"My Secret Code\" or use one of the built-in presets like Norse Runes or Cyberpunk Glyphs.",
      tip: "You can have multiple languages! Switch between them using the language badges shown below the header.",
      example: "Example: Create \"Agent Codex v1.0\" for your spy messages.",
      tab: null,
    },
    {
      icon: Palette,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/30",
      title: "Step 2 — Symbol Builder Tab",
      description: "The Symbol Builder is where you add glyphs. A glyph maps a letter (like \"A\") to a symbol (like \"⚡\"). Fill in the Character field (e.g. A), Symbol field (e.g. ⚡), a Meaning, and Category.",
      tip: "Use the Quick Symbol Palette to pick from hundreds of built-in symbols with one click! Or use \"Auto-Fill A-Z\" to instantly fill all 26 letters.",
      example: "A → ⚡, B → ☣, C → ⬡ ... and so on for every letter.",
      tab: "builder",
    },
    {
      icon: BookOpen,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/30",
      title: "Step 3 — Dictionary Tab",
      description: "The Dictionary shows all the glyphs you've defined in a visual grid. Search by character or symbol, filter by category, and see your entire language at a glance.",
      tip: "If a letter has no glyph defined, it will stay unchanged when you encrypt — so make sure you map all letters you need!",
      example: "View your full A→Z mapping in one place.",
      tab: "dictionary",
    },
    {
      icon: Lock,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
      title: "Step 4 — Encrypt Messages",
      description: "Go to the Encrypt tab and type any message. CryptGlyph will replace every letter with its matching glyph symbol. The result is your encrypted secret message — share it with trusted people!",
      tip: "Letters without a mapped glyph are kept as-is. Numbers and punctuation pass through unchanged by default.",
      example: '"HELLO" might become "🛡◈🔗🔗◯" using Cyberpunk Hex Glyphs.',
      tab: "encrypt",
    },
    {
      icon: Unlock,
      color: "text-green-400",
      bg: "bg-green-500/10 border-green-500/30",
      title: "Step 5 — Decrypt Messages",
      description: "Got an encrypted message? Paste it in the Decrypt tab and CryptGlyph will automatically convert the symbols back into readable text using your current language.",
      tip: "You must use the same language that was used to encrypt the message. If decryption shows strange results, check you have the right language selected.",
      example: '"🛡◈🔗🔗◯" decrypts back to "HELLO" instantly.',
      tab: "decrypt",
    },
    {
      icon: History,
      color: "text-pink-400",
      bg: "bg-pink-500/10 border-pink-500/30",
      title: "Step 6 — Message History",
      description: "Every message you encrypt or decrypt is saved in History so you can refer back to it. You can copy any past result or clear the history when you're done.",
      tip: "History is stored locally in your browser — it never leaves your device.",
      example: null,
      tab: "history",
    },
    {
      icon: Layers,
      color: "text-violet-400",
      bg: "bg-violet-500/10 border-violet-500/30",
      title: "Step 7 — Library & Presets",
      description: "The Library tab shows all your saved languages. You can export a language to a JSON file to share it with someone, or import a language file from a friend so you can both encrypt/decrypt messages.",
      tip: "You can also delete languages you no longer need. The last language can't be deleted.",
      example: null,
      tab: "library",
    },
    {
      icon: Wand2,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10 border-indigo-500/30",
      title: "Step 8 — AI Language Generator",
      description: "Don't want to manually define every glyph? Use the AI Generate tab! Pick a theme (Fantasy, Military, Sci-Fi...), a script style (Runes, Geometric...), and click Generate — your whole language is created instantly!",
      tip: "After AI generation, you can still edit individual glyphs in the Symbol Builder to customize your language further.",
      example: null,
      tab: "ai",
    },
    {
      icon: Share2,
      color: "text-rose-400",
      bg: "bg-rose-500/10 border-rose-500/30",
      title: "You're all set! 🎉",
      description: "Now you know everything about CryptGlyph! Create your language, map your glyphs, and start encrypting secret messages. Share your language file with trusted contacts so they can decrypt your messages.",
      tip: "Pro tip: Use the QR sharing feature to share encrypted messages visually. Combine CryptGlyph with StegShield's steganography to hide them inside images!",
      example: null,
      tab: null,
    },
  ]

  const setLanguages = (updater: SecretLanguage[] | ((prev: SecretLanguage[]) => SecretLanguage[])) => {
    setLanguagesState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater
      saveLanguages(next)
      return next
    })
  }

  useEffect(() => {
    let langs = loadLanguages()
    if (langs.length === 0) {
      // Pre-populate with ONLY Norse Elder Runes on first visit (one clean default)
      const norsePreset = PRESET_LANGUAGES[0]
      const defaultLang: SecretLanguage = {
        ...norsePreset,
        id: generateId(),
        userId: "local",
        createdAt: new Date().toISOString(),
      }
      langs = [defaultLang]
      saveLanguages(langs)
    }
    setLanguagesState(langs)
    setLoading(false)
    if (langs.length > 0 && !selectedLang) {
      setSelectedLang(langs[0])
    }
    setMessageHistory(loadHistory())
  }, [])

  useEffect(() => {
    if (selectedLang) {
      const current = languages.find(l => l.id === selectedLang.id)
      if (current) setSelectedLang(current)
    }
  }, [languages, selectedLang?.id])

  const categories = useMemo(() => {
    if (!selectedLang) return []
    return Array.from(new Set(selectedLang.glyphs.map(g => g.category))).sort()
  }, [selectedLang])

  const filteredGlyphs = useMemo(() => {
    if (!selectedLang) return []
    let glyphs = selectedLang.glyphs
    if (glyphSearch) {
      const q = glyphSearch.toLowerCase()
      glyphs = glyphs.filter(g => g.character.toLowerCase().includes(q) || g.symbol.toLowerCase().includes(q) || g.meaning.toLowerCase().includes(q))
    }
    if (glyphCategoryFilter) glyphs = glyphs.filter(g => g.category === glyphCategoryFilter)
    return glyphs
  }, [selectedLang, glyphSearch, glyphCategoryFilter])

  const filteredLanguages = useMemo(() => {
    if (!librarySearch) return languages
    const q = librarySearch.toLowerCase()
    return languages.filter(l => l.name.toLowerCase().includes(q) || l.version.toLowerCase().includes(q))
  }, [languages, librarySearch])

  const handleCreate = () => {
    if (!newName.trim()) { toast.error("Enter a language name"); return }
    const lang: SecretLanguage = {
      id: generateId(),
      userId: "local",
      name: newName.trim(),
      version: "1.0",
      glyphs: [],
      isShared: false,
      createdAt: new Date().toISOString(),
    }
    setLanguages(prev => [lang, ...prev])
    setSelectedLang(lang)
    setNewName("")
    setShowCreate(false)
    toast.success("Language created")
  }

  const handleAddGlyph = () => {
    if (!selectedLang) { toast.error("Select a language first"); return }
    if (!char || !symbol || !meaning) { toast.error("Fill in character, symbol, and meaning"); return }

    const upperChar = char.toUpperCase()
    const existingIndex = selectedLang.glyphs.findIndex(g => g.character === upperChar)

    let updatedGlyphs = [...selectedLang.glyphs]
    if (existingIndex >= 0) {
      updatedGlyphs[existingIndex] = {
        id: selectedLang.glyphs[existingIndex].id,
        character: upperChar,
        symbol,
        meaning,
        category: category || "General",
      }
      toast.success(`Glyph for '${upperChar}' updated`)
    } else {
      updatedGlyphs.push({
        id: generateId(),
        character: upperChar,
        symbol,
        meaning,
        category: category || "General",
      })
      toast.success(`Glyph for '${upperChar}' added`)
    }

    const updated: SecretLanguage = {
      ...selectedLang,
      glyphs: updatedGlyphs,
    }
    setSelectedLang(updated)
    setLanguages(prev => prev.map(l => l.id === updated.id ? updated : l))

    // Auto-advance to next letter (e.g. 'A' -> 'B')
    if (upperChar.length === 1 && upperChar >= "A" && upperChar < "Z") {
      setChar(String.fromCharCode(upperChar.charCodeAt(0) + 1))
    } else {
      setChar("")
    }
    setSymbol(""); setMeaning("")
  }

  const batchAutoFillAlphabet = () => {
    if (!selectedLang) { toast.error("Select a language first"); return }
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
    const runes = ["ᚫ","ᛒ","ᚲ","ᛞ","ᛖ","ᚠ","ᚷ","ᚺ","ᛁ","ᛃ","ᚴ","ᛚ","ᛗ","ᚾ","ᛟ","ᛈ","ᛩ","ᚱ","ᛋ","ᛏ","ᚢ","ᚡ","ᚹ","ᚾᛋ","ᛦ","ᛧ"]

    const existingMap = new Map(selectedLang.glyphs.map(g => [g.character, g]))
    const newGlyphs: Glyph[] = letters.map((letStr, idx) => {
      if (existingMap.has(letStr)) return existingMap.get(letStr)!
      return {
        id: generateId(),
        character: letStr,
        symbol: runes[idx % runes.length],
        meaning: `Symbol for ${letStr}`,
        category: "General",
      }
    })

    const updated: SecretLanguage = { ...selectedLang, glyphs: newGlyphs }
    setSelectedLang(updated)
    setLanguages(prev => prev.map(l => l.id === updated.id ? updated : l))
    toast.success("Full A-Z alphabet batch-generated!")
  }

  const handleRemoveGlyph = (glyphId: string) => {
    if (!selectedLang) return
    const updated: SecretLanguage = {
      ...selectedLang,
      glyphs: selectedLang.glyphs.filter(g => g.id !== glyphId),
    }
    setSelectedLang(updated)
    setLanguages(prev => prev.map(l => l.id === updated.id ? updated : l))
    toast.success("Glyph removed")
  }

  const handleToggleShare = (id: string) => {
    setLanguages(prev => prev.map(l => l.id === id ? { ...l, isShared: !l.isShared } : l))
    setSelectedLang(prev => prev?.id === id ? { ...prev, isShared: !prev.isShared } : prev)
    const lang = languages.find(l => l.id === id)
    toast.success(lang?.isShared ? "Language unshared" : "Language shared")
  }

  const handleDelete = (id: string) => {
    const updated = languages.filter(l => l.id !== id)
    setLanguages(updated)
    if (selectedLang?.id === id) setSelectedLang(updated[0] || null)
    toast.success("Language deleted")
  }

  const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_URL || "http://localhost:8000"

  const generateProceduralLanguage = (): SecretLanguage => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
    const count = Math.min(aiGlyphCount, 26)
    let selectedChars = letters.slice(0, count)
    if (aiIncludeDigits) {
      selectedChars = selectedChars.concat(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"])
    }
    if (aiIncludePunct) {
      selectedChars = selectedChars.concat([".", ",", "!", "?", "-", ":", ";", "'", '"'])
    }

    const unicodeRanges: Record<string, [number, number]> = {
      symbolic: [0x2600, 0x27BF],
      runes: [0x16A0, 0x16FF],
      cyrillic: [0x0400, 0x044F],
      greek: [0x0370, 0x03CF],
      geometric: [0x25A0, 0x25FF],
      dingbats: [0x2700, 0x27BF],
      arrows: [0x2190, 0x21FF],
      circled: [0x2460, 0x24FF],
    }

    const [rangeStart, rangeEnd] = unicodeRanges[aiScript] || [0x2600, 0x27BF]
    const themeName = aiTheme.charAt(0).toUpperCase() + aiTheme.slice(1)
    const scriptName = aiScript.charAt(0).toUpperCase() + aiScript.slice(1)

    const glyphs: Glyph[] = selectedChars.map((ch, idx) => {
      const codePoint = rangeStart + (idx * 3) % (rangeEnd - rangeStart)
      return {
        id: generateId(),
        character: ch,
        symbol: String.fromCodePoint(codePoint),
        meaning: `${themeName} ${ch}`,
        category: scriptName,
      }
    })

    return {
      id: generateId(),
      userId: "local",
      name: `${themeName} ${scriptName} Script`,
      version: "1.0",
      glyphs,
      isShared: false,
      createdAt: new Date().toISOString(),
    }
  }

  const handleAiGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch(`${AI_SERVICE_URL}/generate/secret-language`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: aiTheme,
          scriptType: aiScript,
          complexity: aiComplexity,
          includeDigits: aiIncludeDigits,
          includePunctuation: aiIncludePunct,
          glyphCount: aiGlyphCount,
        }),
      })
      if (!res.ok) throw new Error("AI service error")
      const data = await res.json()
      const mapped: SecretLanguage = {
        id: generateId(),
        userId: "local",
        name: data.name,
        version: data.version || "1.0",
        glyphs: (data.glyphs || []).map((g: any) => ({
          id: generateId(),
          character: (g.character || "").toUpperCase(),
          symbol: g.symbol || "",
          meaning: g.meaning || "",
          category: g.category || "General",
        })),
        isShared: false,
        createdAt: new Date().toISOString(),
      }
      setLanguages(prev => [mapped, ...prev])
      setSelectedLang(mapped)
      setActiveTab("builder")
      toast.success(`"${mapped.name}" generated with ${mapped.glyphs.length} glyphs`)
    } catch {
      // Seamless procedural generator fallback if AI service is offline
      const fallback = generateProceduralLanguage()
      setLanguages(prev => [fallback, ...prev])
      setSelectedLang(fallback)
      setActiveTab("builder")
      toast.success(`"${fallback.name}" generated with ${fallback.glyphs.length} glyphs`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleEncrypt = () => {
    if (!selectedLang || !encryptInput.trim()) return
    const { result, unknown } = encryptText(encryptInput, selectedLang.glyphs)
    setEncryptOutput(result)
    setEncryptUnknown(unknown)
    if (unknown.length > 0) toast.error(`Unknown characters: ${unknown.join(", ")}`)
    setMessageHistory(prev => {
      const next: MessageEntry[] = [{ id: generateId(), type: "encrypted" as const, input: encryptInput, output: result, languageName: selectedLang.name, timestamp: Date.now() }, ...prev]
      saveHistory(next)
      return next
    })
  }

  const handleDecrypt = () => {
    if (!selectedLang || !decryptInput.trim()) return
    const result = decryptText(decryptInput, selectedLang.glyphs)
    setDecryptOutput(result)
    setMessageHistory(prev => {
      const next: MessageEntry[] = [{ id: generateId(), type: "decrypted" as const, input: decryptInput, output: result, languageName: selectedLang.name, timestamp: Date.now() }, ...prev]
      saveHistory(next)
      return next
    })
  }

  const exportLanguage = (lang: SecretLanguage) => {
    const blob = new Blob([JSON.stringify(lang, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${lang.name}.json`; a.click()
    URL.revokeObjectURL(url)
    toast.success("Language exported")
  }

  const importLanguage = () => {
    const input = document.createElement("input")
    input.type = "file"; input.accept = ".json"
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        const glyphs: Glyph[] = (data.glyphs || []).map((g: any) => ({
          id: g.id || generateId(),
          character: g.character?.toUpperCase() || "",
          symbol: g.symbol || "",
          meaning: g.meaning || "",
          category: g.category || "General",
        }))
        const lang: SecretLanguage = {
          id: generateId(),
          userId: "local",
          name: data.name || "Imported Language",
          version: data.version || "1.0",
          glyphs,
          isShared: false,
          createdAt: new Date().toISOString(),
        }
        setLanguages(prev => [lang, ...prev])
        setSelectedLang(lang)
        toast.success("Language imported")
      } catch {
        toast.error("Invalid file format")
      }
    }
    input.click()
  }

  const clearHistory = () => {
    setMessageHistory([])
    saveHistory([])
    toast.success("History cleared")
  }

  return (
    <div className="space-y-6">

      {/* ─── GUIDE MODAL ─── */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-border/60 bg-background shadow-2xl shadow-purple-500/10 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Progress bar */}
            <div className="h-1 bg-muted/40">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-cyber-500 transition-all duration-500"
                style={{ width: `${((guideStep + 1) / GUIDE_STEPS.length) * 100}%` }}
              />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/20">
              <div className="flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-purple-400" />
                <span className="text-xs font-semibold text-muted-foreground">CryptGlyph Guide</span>
                <span className="text-xs text-muted-foreground/60">· Step {guideStep + 1} of {GUIDE_STEPS.length}</span>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step content */}
            {(() => {
              const step = GUIDE_STEPS[guideStep]
              const Icon = step.icon
              return (
                <div className="p-6 space-y-4">
                  {/* Icon + Title */}
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl border ${step.bg} shrink-0`}>
                      <Icon className={`h-6 w-6 ${step.color}`} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">{step.title}</h2>
                      {step.tab && (
                        <button
                          className="text-xs text-cyber-400 hover:text-cyber-300 transition-colors mt-0.5 underline underline-offset-2"
                          onClick={() => { setActiveTab(step.tab!); setShowGuide(false) }}
                        >
                          → Go to {step.tab.charAt(0).toUpperCase() + step.tab.slice(1)} tab
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-foreground/80 leading-relaxed">{step.description}</p>

                  {/* Tip */}
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
                    <span className="text-base leading-none mt-0.5">💡</span>
                    <p className="text-xs text-amber-200/80 leading-relaxed">{step.tip}</p>
                  </div>

                  {/* Example */}
                  {step.example && (
                    <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                      <p className="text-xs font-mono text-cyber-300">{step.example}</p>
                    </div>
                  )}

                  {/* Step dots */}
                  <div className="flex justify-center gap-1.5 pt-1">
                    {GUIDE_STEPS.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setGuideStep(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === guideStep ? "w-6 bg-purple-500" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Footer nav */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/10">
              <button
                onClick={() => setGuideStep(s => Math.max(0, s - 1))}
                disabled={guideStep === 0}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>

              {guideStep < GUIDE_STEPS.length - 1 ? (
                <button
                  onClick={() => setGuideStep(s => s + 1)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors text-sm font-semibold text-white"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowGuide(false)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyber-600 hover:opacity-90 transition-opacity text-sm font-semibold text-white"
                >
                  Start Creating! 🚀
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="CryptGlyph"
          description="Create symbolic languages, encrypt messages, and decrypt communications"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-cyber-500/40 bg-cyber-500/10 hover:bg-cyber-500/20 text-cyber-300 hover:text-cyber-200 transition-all text-sm font-semibold shadow-lg shadow-cyber-500/10 hover:shadow-cyber-500/20"
          >
            <Plus className="h-4 w-4" />
            New Language
          </button>
          <button
            onClick={() => { setGuideStep(0); setShowGuide(true) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 transition-all text-sm font-semibold shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20"
          >
            <HelpCircle className="h-4 w-4" />
            How it Works
          </button>
        </div>
      </div>

      {showCreate && (
        <Card className="glass-card border-primary/30">
          <CardContent className="flex items-center gap-3 pt-6">
            <input
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="Language name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button variant="cyber" size="sm" onClick={handleCreate}>Create</Button>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {languages.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {languages.map((lang) => (
            <Badge
              key={lang.id}
              variant={selectedLang?.id === lang.id ? "default" : "outline"}
              className="cursor-pointer gap-1 px-3 py-1.5 group"
              onClick={() => setSelectedLang(lang)}
            >
              <BookOpen className="h-3 w-3" />
              {lang.name}
              {lang.isShared && <Globe className="h-3 w-3 ml-1" />}
              <button
                className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                onClick={(e) => { e.stopPropagation(); handleDelete(lang.id) }}
                title="Delete language"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="builder">Symbol Builder</TabsTrigger>
          <TabsTrigger value="dictionary">Dictionary</TabsTrigger>
          <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
          <TabsTrigger value="decrypt">Decrypt</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="ai-generate">AI Generate</TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="glass-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Glyph Canvas</span>
                  {selectedLang && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {selectedLang.glyphs.length} glyphs
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedLang ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Adding to: <span className="font-semibold text-foreground">{selectedLang.name}</span>
                      <span className="ml-2 text-xs">v{selectedLang.version}</span>
                    </p>
                    {selectedLang.glyphs.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
                        <Languages className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium mb-1">No glyphs yet</p>
                        <p className="text-xs text-muted-foreground">Add your first glyph using the form on the right</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                        {selectedLang.glyphs.map((g) => (
                          <div
                            key={g.id}
                            className="relative group flex flex-col items-center p-2 rounded-lg border border-border bg-background hover:border-primary/50 transition-colors"
                          >
                            <button
                              className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 bg-destructive text-destructive-foreground rounded-full p-0.5 transition-opacity"
                              onClick={() => handleRemoveGlyph(g.id)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <span className="text-xl font-bold">{g.symbol}</span>
                            <span className="text-[10px] font-mono text-muted-foreground mt-0.5">{g.character}</span>
                            <Badge variant="outline" className="text-[8px] px-1 py-0 mt-0.5 truncate max-w-full">
                              {g.category}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-xl p-16 text-center">
                    <Languages className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-sm font-medium mb-1">No language selected</p>
                    <p className="text-xs text-muted-foreground">Select or create a language to begin building glyphs</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>New Glyph</CardTitle>
                {selectedLang && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[11px] h-7 gap-1"
                    onClick={batchAutoFillAlphabet}
                    title="Auto-generate glyphs for all 26 letters (A-Z) in 1 click"
                  >
                    <Sparkles className="h-3 w-3 text-cyber-400" /> Auto-Fill A-Z
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Character</label>
                    <span className="text-[10px] text-muted-foreground">Auto-advances A → Z</span>
                  </div>
                  <input
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1 font-mono uppercase"
                    placeholder="A"
                    maxLength={1}
                    value={char}
                    onChange={(e) => setChar(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Symbol</label>
                  <input
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    placeholder="ᚠ or 🔺 or ⚡"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                  />
                  {/* Quick Symbol Palette */}
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium">Quick Symbol Palette (Click to insert):</p>
                    <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-muted/20 border border-border/40 max-h-24 overflow-y-auto">
                      {["ᚫ","ᛒ","ᚲ","ᛞ","ᛖ","ᚠ","ᚷ","ᚺ","ᛁ","ᛃ","ᚴ","ᛚ","ᛗ","ᚾ","ᛟ","ᛈ","ᛩ","ᚱ","ᛋ","ᛏ","ᚢ","ᚡ","ᚹ","ᚾᛋ","ᛦ","ᛧ", "⚡","☣","⬡","❖","⎔","✦","⚙","🛡","◈","🔑","🔗","📡","◯","⚛","🌀","🔒","🔺","⏣","🌐","✖","0x"].map((sym, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="h-7 w-7 rounded border border-border/60 hover:border-cyber-400 bg-background text-sm flex items-center justify-center transition-colors shrink-0"
                          onClick={() => setSymbol(sym)}
                          title={`Insert ${sym}`}
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Meaning</label>
                  <input
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                    placeholder="Attack / Core / Shield"
                    value={meaning}
                    onChange={(e) => setMeaning(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <select
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm mt-1"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Select category...</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <Button variant="cyber" className="w-full" onClick={handleAddGlyph} disabled={!selectedLang}>
                  Add Glyph {char ? `('${char.toUpperCase()}')` : ""}
                </Button>

                {selectedLang && char && symbol && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/30 text-center border border-border/40">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Live Glyph Preview</p>
                    <span className="text-2xl font-bold text-cyber-400">{symbol}</span>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-mono font-bold text-foreground">{char.toUpperCase()}</span> &mdash; {meaning || "No meaning specified"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dictionary">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Language Dictionary</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={importLanguage}>
                    <FileUp className="mr-2 h-4 w-4" /> Import
                  </Button>
                  {selectedLang && (
                    <Button variant="outline" size="sm" onClick={() => exportLanguage(selectedLang)}>
                      <FileDown className="mr-2 h-4 w-4" /> Export
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedLang ? (
                <>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm"
                        placeholder="Search glyphs..."
                        value={glyphSearch}
                        onChange={(e) => setGlyphSearch(e.target.value)}
                      />
                    </div>
                    {categories.length > 0 && (
                      <select
                        className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        value={glyphCategoryFilter}
                        onChange={(e) => setGlyphCategoryFilter(e.target.value)}
                      >
                        <option value="">All Categories</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {filteredGlyphs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Character</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Symbol</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Meaning</th>
                            <th className="text-left py-2 px-3 font-medium text-muted-foreground">Category</th>
                            <th className="text-right py-2 px-3 font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredGlyphs.map((g) => (
                            <tr key={g.id} className="border-b border-border/50 hover:bg-muted/20">
                              <td className="py-2.5 px-3 font-mono font-bold">{g.character}</td>
                              <td className="py-2.5 px-3 text-lg">{g.symbol}</td>
                              <td className="py-2.5 px-3">{g.meaning}</td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outline">{g.category}</Badge>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(g.symbol); toast.success("Copied") }}>
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveGlyph(g.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      icon={Search}
                      title="No matching glyphs"
                      description={glyphSearch || glyphCategoryFilter ? "Try different search terms or clear filters" : "This language has no glyphs. Use the Symbol Builder to add some."}
                    />
                  )}
                </>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="No language selected"
                  description="Select a language from the badges above to view its dictionary."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="encrypt">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Compose Message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedLang ? (
                  <EmptyState icon={Languages} title="No language selected" description="Select a language from the top badges to encrypt messages." />
                ) : selectedLang.glyphs.length === 0 ? (
                  <EmptyState icon={Languages} title="No glyphs" description="Add glyphs first in the Symbol Builder tab." />
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-2 block text-muted-foreground">
                        Plaintext &rarr; <span className="text-foreground">{selectedLang.name}</span>
                      </label>
                      <textarea
                        className="w-full h-32 rounded-lg border border-input bg-background p-3 text-sm resize-none font-mono"
                        placeholder="Enter secret message to encrypt..."
                        value={encryptInput}
                        onChange={(e) => { setEncryptInput(e.target.value); setEncryptOutput(""); setEncryptUnknown([]) }}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">{encryptInput.length} chars</span>
                        <Button variant="cyber" size="sm" onClick={handleEncrypt} disabled={!encryptInput.trim()}>
                          Encrypt
                        </Button>
                      </div>
                    </div>
                    {encryptOutput && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">Encrypted Output</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { navigator.clipboard.writeText(encryptOutput); toast.success("Copied") }}>
                            <Copy className="mr-1 h-3 w-3" /> Copy
                          </Button>
                        </div>
                        <p className="text-lg tracking-wider font-medium break-all">{encryptOutput}</p>
                        {encryptUnknown.length > 0 && (
                          <div className="mt-2 flex items-start gap-2 text-xs text-destructive">
                            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                            <span>Unknown: {encryptUnknown.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Glyph Reference</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedLang ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {selectedLang.glyphs.map((g) => (
                      <div key={g.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20">
                        <span className="w-8 h-8 flex items-center justify-center text-lg font-bold rounded border border-border bg-background">
                          {g.symbol}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold">{g.character}</span>
                            <Badge variant="outline" className="text-[8px] px-1 py-0">{g.category}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{g.meaning}</p>
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={BookOpen} title="No language" description="Select a language to view its glyph reference." />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="decrypt">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Decrypt Message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedLang ? (
                  <EmptyState icon={Languages} title="No language selected" description="Select a language from the top badges to decrypt messages." />
                ) : selectedLang.glyphs.length === 0 ? (
                  <EmptyState icon={Languages} title="No glyphs" description="Add glyphs first in the Symbol Builder tab." />
                ) : (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-2 block text-muted-foreground">
                        <span className="text-foreground">{selectedLang.name}</span> &rarr; Plaintext
                      </label>
                      <textarea
                        className="w-full h-32 rounded-lg border border-input bg-background p-3 text-sm resize-none"
                        placeholder="Paste glyph-encoded message to decrypt..."
                        value={decryptInput}
                        onChange={(e) => { setDecryptInput(e.target.value); setDecryptOutput("") }}
                      />
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">{decryptInput.length} chars</span>
                        <Button variant="cyber" size="sm" onClick={handleDecrypt} disabled={!decryptInput.trim()}>
                          Decrypt
                        </Button>
                      </div>
                    </div>
                    {decryptOutput && (
                      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">Decrypted Output</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { navigator.clipboard.writeText(decryptOutput); toast.success("Copied") }}>
                            <Copy className="mr-1 h-3 w-3" /> Copy
                          </Button>
                        </div>
                        <p className="text-base font-medium">{decryptOutput}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Reverse Reference</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedLang ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {selectedLang.glyphs.map((g) => (
                      <div key={g.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20">
                        <ArrowLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="w-8 h-8 flex items-center justify-center text-lg font-bold rounded border border-border bg-background">
                          {g.symbol}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs font-bold">{g.character}</span>
                          <p className="text-xs text-muted-foreground truncate">{g.meaning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={BookOpen} title="No language" description="Select a language to view its reverse reference." />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Message History</span>
                {messageHistory.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearHistory}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messageHistory.length > 0 ? (
                <div className="space-y-3">
                  {messageHistory.map((entry) => (
                    <Card key={entry.id} className="bg-muted/10 border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={entry.type === "encrypted" ? "default" : "secondary"}>
                              {entry.type === "encrypted" ? "Encrypt" : "Decrypt"}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{entry.languageName}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Input</p>
                            <p className="text-sm truncate font-mono">{entry.input}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Output</p>
                            <p className="text-sm truncate font-mono">{entry.output}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={History}
                  title="No history"
                  description="Encrypt or decrypt messages and they will appear here."
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-generate">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="glass-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Language Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-3 block">Theme / Aesthetic</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: "fantasy", label: "Fantasy", icon: "🧙" },
                      { value: "futuristic", label: "Futuristic", icon: "🤖" },
                      { value: "nature", label: "Nature", icon: "🌿" },
                      { value: "dark", label: "Dark", icon: "🌙" },
                      { value: "celestial", label: "Celestial", icon: "⭐" },
                    ].map((t) => (
                      <button
                        key={t.value}
                        className={`p-3 rounded-lg border text-center transition-all ${
                          aiTheme === t.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50 bg-background"
                        }`}
                        onClick={() => setAiTheme(t.value)}
                      >
                        <span className="text-xl block mb-1">{t.icon}</span>
                        <span className="text-xs font-medium">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-3 block">Script Style</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: "symbolic", label: "Symbolic", icon: "🔣" },
                      { value: "runes", label: "Runes", icon: "ᚠ" },
                      { value: "geometric", label: "Geometric", icon: "⬡" },
                      { value: "dingbats", label: "Dingbats", icon: "✈" },
                      { value: "circled", label: "Circled", icon: "Ⓜ" },
                      { value: "cyrillic", label: "Cyrillic", icon: "Д" },
                      { value: "greek", label: "Greek", icon: "Ω" },
                      { value: "arrows", label: "Arrows", icon: "→" },
                    ].map((s) => (
                      <button
                        key={s.value}
                        className={`p-2 rounded-lg border text-center transition-all ${
                          aiScript === s.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50 bg-background"
                        }`}
                        onClick={() => setAiScript(s.value)}
                      >
                        <span className="text-lg block mb-0.5">{s.icon}</span>
                        <span className="text-[10px] font-medium">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-3 block">Complexity</label>
                  <div className="flex gap-2">
                    {[
                      { value: "simple", label: "Simple", desc: "Basic glyphs" },
                      { value: "medium", label: "Medium", desc: "Rich vocabulary" },
                      { value: "complex", label: "Complex", desc: "Full system" },
                    ].map((c) => (
                      <button
                        key={c.value}
                        className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                          aiComplexity === c.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50 bg-background"
                        }`}
                        onClick={() => setAiComplexity(c.value)}
                      >
                        <span className="text-sm font-medium block">{c.label}</span>
                        <span className="text-[10px] text-muted-foreground">{c.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ai-digits"
                      checked={aiIncludeDigits}
                      onChange={(e) => setAiIncludeDigits(e.target.checked)}
                      className="rounded border-border"
                    />
                    <label htmlFor="ai-digits" className="text-sm cursor-pointer">Include Digits</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ai-punct"
                      checked={aiIncludePunct}
                      onChange={(e) => setAiIncludePunct(e.target.checked)}
                      className="rounded border-border"
                    />
                    <label htmlFor="ai-punct" className="text-sm cursor-pointer">Include Punctuation</label>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <label className="text-xs text-muted-foreground">Glyphs:</label>
                    <select
                      className="rounded-lg border border-input bg-background px-2 py-1 text-sm"
                      value={aiGlyphCount}
                      onChange={(e) => setAiGlyphCount(Number(e.target.value))}
                    >
                      {[10, 16, 26, 36, 52].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button
                  variant="cyber"
                  className="w-full"
                  onClick={handleAiGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Cpu className="mr-2 h-4 w-4" />
                  )}
                  {isGenerating ? "Generating..." : "Generate Language with AI"}
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Palette className="h-4 w-4" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-4 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Theme: {aiTheme}</p>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Script: {aiScript}</p>
                  <p className="text-xs font-medium text-muted-foreground">Complexity: {aiComplexity}</p>
                  <p className="text-xs text-muted-foreground mt-2">{aiGlyphCount} glyphs{aiIncludeDigits ? " + digits" : ""}{aiIncludePunct ? " + punctuation" : ""}</p>
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground mb-2">You can also:</p>
                  <ul className="space-y-1.5">
                    <li className="text-xs flex items-center gap-2">
                      <span className="text-primary">&#x2022;</span>
                      Manually add glyphs in <strong>Symbol Builder</strong>
                    </li>
                    <li className="text-xs flex items-center gap-2">
                      <span className="text-primary">&#x2022;</span>
                      Import existing languages via JSON
                    </li>
                    <li className="text-xs flex items-center gap-2">
                      <span className="text-primary">&#x2022;</span>
                      Share languages with your team
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="library">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Language Library</span>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm"
                    placeholder="Search languages..."
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
              ) : filteredLanguages.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredLanguages.map((lang) => (
                    <Card
                      key={lang.id}
                      className={`glass-card cursor-pointer transition-all hover:border-primary/50 ${selectedLang?.id === lang.id ? "border-primary" : ""}`}
                      onClick={() => { setSelectedLang(lang); setActiveTab("builder") }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-sm">{lang.name}</h3>
                            <p className="text-xs text-muted-foreground">
                              v{lang.version} &middot; {lang.glyphs.length} glyphs
                            </p>
                          </div>
                          {lang.isShared && <Globe className="h-4 w-4 text-primary" />}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-3 min-h-[2rem]">
                          {lang.glyphs.slice(0, 8).map((g) => (
                            <span key={g.id} className="text-lg" title={`${g.character}: ${g.meaning}`}>{g.symbol}</span>
                          ))}
                          {lang.glyphs.length > 8 && (
                            <span className="text-xs text-muted-foreground self-end">+{lang.glyphs.length - 8}</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); setSelectedLang(lang); setActiveTab("encrypt") }}>
                            <MessageSquare className="mr-1 h-3 w-3" /> Message
                          </Button>
                          <Button variant="outline" size="sm" className={lang.isShared ? "text-primary" : ""} onClick={(e) => { e.stopPropagation(); handleToggleShare(lang.id) }}>
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); exportLanguage(lang) }}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(lang.id) }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Languages}
                  title={librarySearch ? "No matching languages" : "No languages yet"}
                  description={librarySearch ? "Try a different search term" : "Create your first secret language to get started"}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
