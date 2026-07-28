"use client"

import { useState } from "react"
import Link from "next/link"
import {
  HelpCircle,
  Search,
  BookOpen,
  Shield,
  Eye,
  Lock,
  Search as SearchIcon,
  MessageSquare,
  Share2,
  Users,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Flame,
  Ghost,
  Puzzle,
  Clock,
  Award,
  Globe,
  FileText,
  ScanFace,
  Fingerprint,
  Droplets,
  Terminal,
  Database,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

// Module explanations for new users
const moduleGuides = [
  {
    category: "Core Security",
    modules: [
      {
        title: "Secure Messaging",
        href: "/secure-messaging",
        icon: MessageSquare,
        gradient: "from-violet-500 to-purple-600",
        summary: "Client-side encrypted direct messaging.",
        details: "Messages are encrypted in your browser using AES-256-GCM before transmission. Features 24-hour auto self-destruct and 15-second one-time view modes.",
      },
      {
        title: "Steganography Engine",
        href: "/steganography",
        icon: Eye,
        gradient: "from-cyan-500 to-blue-600",
        summary: "Hide secret files inside carrier images & audio.",
        details: "Embeds secret payloads into PNG, BMP, or WAV files using Spatial LSB (Least Significant Bit) or Append methods without visible alteration.",
      },
      {
        title: "File & Image Encryption",
        href: "/file-encryption",
        icon: Lock,
        gradient: "from-emerald-500 to-teal-600",
        summary: "Zero-knowledge file encryption.",
        details: "Encrypts files with AES-256-GCM. Passwords are key-derived locally via Argon2id so no unencrypted plaintext or master keys ever touch the server.",
      },
      {
        title: "Secret Language Engine",
        href: "/secret-language",
        icon: Globe,
        gradient: "from-indigo-500 to-violet-600",
        summary: "Custom glyph-based cipher languages.",
        details: "Encodes sensitive messages into custom unicode glyph symbols or custom alphabet substitution keys for high-obscurity communication.",
      },
    ],
  },
  {
    category: "Digital Forensics & AI",
    modules: [
      {
        title: "Digital Forensics Engine",
        href: "/digital-forensics",
        icon: SearchIcon,
        gradient: "from-orange-500 to-red-600",
        summary: "Analyze files for hidden steganography & entropy.",
        details: "Computes spatial entropy (0.0 to 8.0 scale), extracts hidden strings, scrubs EXIF metadata, and runs LSB steganalysis to detect concealed data.",
      },
      {
        title: "Tamper & ELA Analysis",
        href: "/tamper-detection",
        icon: ScanFace,
        gradient: "from-pink-500 to-rose-600",
        summary: "Detect image manipulation & Error Level Analysis.",
        details: "Performs Error Level Analysis (ELA) and color variance checks to highlight edited or tampered pixels in digital evidence.",
      },
      {
        title: "Evidence Vault",
        href: "/evidence-vault",
        icon: Shield,
        gradient: "from-sky-500 to-indigo-600",
        summary: "Chain-of-custody evidence management.",
        details: "Stores forensic evidence with SHA-256 cryptographic fingerprints, access logs, and verifiable chain-of-custody audit trails for legal admissibility.",
      },
      {
        title: "AI Security Assistant",
        href: "/ai-assistant",
        icon: Sparkles,
        gradient: "from-amber-500 to-yellow-600",
        summary: "AI-powered threat evaluation.",
        details: "Queries the microservice AI model for threat scoring, vulnerability remediation advice, and automated steganalysis summaries.",
      },
    ],
  },
  {
    category: "Advanced Safeguards",
    modules: [
      {
        title: "Panic Mode Lockdown",
        href: "/panic-mode",
        icon: Flame,
        gradient: "from-red-600 to-rose-700",
        summary: "Emergency account session & key wipe.",
        details: "In an emergency under duress, triggering Panic Mode instantly revokes active refresh tokens, wipes in-memory crypto keys, and locks down account access.",
      },
      {
        title: "Decoy Vault",
        href: "/decoy-vault",
        icon: Ghost,
        gradient: "from-purple-600 to-indigo-700",
        summary: "Plausible deniability fake vault.",
        details: "Configure a secondary 'decoy' password. When entered, StegShield presents realistic fake files while keeping your real vault completely invisible.",
      },
      {
        title: "Shamir Secret Sharing",
        href: "/shamir-secret",
        icon: Puzzle,
        gradient: "from-teal-500 to-emerald-600",
        summary: "Split master keys into M-of-N threshold shares.",
        details: "Splits a master secret key into N cryptographic shares (e.g. 3 of 5 required). No single share reveals any information about the original secret.",
      },
      {
        title: "Time Capsule",
        href: "/time-capsule",
        icon: Clock,
        gradient: "from-blue-600 to-cyan-600",
        summary: "Encrypted data with timed unlock dates.",
        details: "Locks encrypted payloads until a specified future date/time. Payload decryption keys remain locked until the time threshold is reached.",
      },
    ],
  },
]

// Frequently Asked Questions
const faqs = [
  {
    question: "What is StegShield X and who is it designed for?",
    answer:
      "StegShield X is an enterprise cybersecurity and digital forensics platform designed for security analysts, investigators, journalists, and organizations. It provides zero-trust file encryption, covert steganography, digital evidence chain-of-custody tracking, and AI-assisted tamper analysis.",
  },
  {
    question: "How does Steganography work, and is the hidden payload detectable?",
    answer:
      "Steganography hides a secret payload inside a normal 'carrier' file (like a PNG photo or WAV audio file). Spatial LSB steganography substitutes the least significant bits of image pixels with secret payload bits. Because the bit changes are imperceptible to human eyes, the image looks normal. However, StegShield's Digital Forensics engine can analyze spatial entropy (7.5+ score) to detect hidden data.",
  },
  {
    question: "What is the difference between Spatial LSB and Append Steganography?",
    answer:
      "Spatial LSB modifies the pixel values inside lossless image/audio formats (PNG, BMP, WAV). Append Steganography attaches an encrypted payload with a magic marker signature (`STEG`) to the end of any file format. Spatial LSB is completely invisible, while Append works across all file extensions.",
  },
  {
    question: "Can StegShield X servers read my encrypted files or messages?",
    answer:
      "No. All encryption (AES-256-GCM) is executed locally inside your browser before transmitting data. Passwords are converted into cryptographic keys using Argon2id key derivation. The server only sees encrypted ciphertext arrays and never possesses your plaintext or master password.",
  },
  {
    question: "What happens when I trigger Panic Mode?",
    answer:
      "Panic Mode is an emergency lockdown mechanism designed for duress situations. Triggering it immediately revokes all active JWT refresh tokens, clears local browser encryption keys, logs an emergency audit alert, and redirects your session to a neutral login screen.",
  },
  {
    question: "How does the Decoy Vault provide plausible deniability?",
    answer:
      "When enabled, you can define a secondary 'Decoy Password'. If forced to reveal a password under coercion, logging in with the Decoy Password opens a realistic fake vault containing harmless dummy files. The system gives no indication that a primary secret vault exists.",
  },
  {
    question: "What is Shamir Secret Sharing (M-of-N Threshold)?",
    answer:
      "Shamir Secret Sharing is a mathematical algorithm (over finite fields) that splits a secret key into N shares. You define a minimum threshold M (e.g., 3 shares out of 5 total). Any M shares can combine to reconstruct the original secret, but M-1 shares reveal zero information.",
  },
  {
    question: "How does the Evidence Vault maintain Chain of Custody?",
    answer:
      "Every evidence file uploaded generates a SHA-256 cryptographic hash fingerprint upon ingestion. Every view, download, or access attempt is logged into an immutable audit table with timestamp, user ID, IP address, and hash verification status for legal compliance.",
  },
  {
    question: "How do I set up Multi-Factor Authentication (TOTP MFA)?",
    answer:
      "Navigate to Settings -> Security -> Enable MFA. Scan the generated QR code using an authenticator app (e.g. Google Authenticator, Authy, or 1Password) and enter the 6-digit verification code to lock your account with TOTP MFA.",
  },
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  const filteredGuides = moduleGuides.map((group) => ({
    ...group,
    modules: group.modules.filter(
      (m) =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.details.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((group) => group.modules.length > 0)

  const filteredFaqs = faqs.filter(
    (f) =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index)
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8 max-w-7xl">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-r from-violet-950/40 via-background to-indigo-950/40 p-6 sm:p-8 backdrop-blur-xl shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-xs font-semibold text-violet-300">
              <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
              Help & Onboarding Center
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              StegShield X <span className="text-violet-400">Knowledge Guide</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl">
              Complete beginner guide, module explanations, security architecture overview, and frequently asked questions.
            </p>
          </div>

          <div className="w-full md:w-80">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search guide & FAQs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-background/80 border-violet-500/30 focus:border-violet-500 text-sm rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding Guide for a New User (3-Step Quickstart) */}
      <Card className="border-violet-500/20 bg-card/60 backdrop-blur-md">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-violet-500/10 text-violet-300 border-violet-500/30">
              New User Onboarding
            </Badge>
            <CardTitle className="text-xl font-bold">Getting Started in 3 Simple Steps</CardTitle>
          </div>
          <CardDescription>
            How to perform your first end-to-end zero-trust encryption and steganography workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Step 1 */}
          <div className="p-5 rounded-2xl border border-violet-500/20 bg-background/60 space-y-3 relative group hover:border-violet-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-violet-600/20 text-violet-400 font-bold flex items-center justify-center border border-violet-500/30">
                01
              </div>
              <Lock className="h-5 w-5 text-violet-400" />
            </div>
            <h3 className="font-semibold text-foreground">Encrypt Your Files</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Navigate to <strong className="text-foreground">File Encryption</strong> or <strong className="text-foreground">Secure Messaging</strong>. Enter your secret text or upload a file. Your browser uses AES-256-GCM to lock it locally.
            </p>
            <Link href="/file-encryption" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-cyan-300 pt-1">
              Try File Encryption <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-2xl border border-cyan-500/20 bg-background/60 space-y-3 relative group hover:border-cyan-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-cyan-600/20 text-cyan-400 font-bold flex items-center justify-center border border-cyan-500/30">
                02
              </div>
              <Eye className="h-5 w-5 text-cyan-400" />
            </div>
            <h3 className="font-semibold text-foreground">Hide in Stego Carrier</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Open <strong className="text-foreground">Steganography</strong>. Select a cover photo (PNG) or audio track (WAV) and embed your encrypted payload using Spatial LSB without altering the appearance.
            </p>
            <Link href="/steganography" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 pt-1">
              Try Steganography <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Step 3 */}
          <div className="p-5 rounded-2xl border border-emerald-500/20 bg-background/60 space-y-3 relative group hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 font-bold flex items-center justify-center border border-emerald-500/30">
                03
              </div>
              <Share2 className="h-5 w-5 text-emerald-400" />
            </div>
            <h3 className="font-semibold text-foreground">Share or Archive Safely</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Use <strong className="text-foreground">Secure Sharing</strong> to generate password-protected expiration links, or store files in the <strong className="text-foreground">Evidence Vault</strong> with SHA-256 custody logging.
            </p>
            <Link href="/secure-sharing" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 pt-1">
              Create Secure Link <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Module Explainer Directory (All Features Explained) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">System Modules Directory</h2>
          <Badge variant="outline" className="font-mono text-xs">
            {filteredGuides.reduce((acc, g) => acc + g.modules.length, 0)} Modules Listed
          </Badge>
        </div>

        {filteredGuides.map((group) => (
          <div key={group.category} className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 pb-2">
              {group.category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {group.modules.map((m) => (
                <Card key={m.title} className="border-border/60 hover:border-violet-500/40 transition-all">
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.gradient} p-2 flex items-center justify-center shrink-0 shadow-md`}>
                      <m.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-foreground text-sm">{m.title}</h4>
                        <Link href={m.href}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-violet-400 hover:text-violet-300 px-2">
                            Open Module <ChevronRight className="ml-1 h-3 w-3" />
                          </Button>
                        </Link>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">{m.summary}</p>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed pt-1">
                        {m.details}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Frequently Asked Questions (FAQ Section) */}
      <Card className="border-violet-500/20 bg-card/60 backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Frequently Asked Questions (FAQ)</CardTitle>
              <CardDescription className="text-sm mt-1">
                Common questions regarding security, steganography detection, encryption keys, and panic modes.
              </CardDescription>
            </div>
            <HelpCircle className="h-8 w-8 text-violet-400 opacity-60 hidden sm:block" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          {filteredFaqs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No questions found matching "{searchQuery}".</p>
          ) : (
            filteredFaqs.map((faq, index) => {
              const isOpen = openFaqIndex === index
              return (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-border/60 bg-background/60 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full p-4 sm:p-5 text-left font-semibold text-sm flex items-center justify-between gap-4 hover:text-violet-400 transition-colors"
                  >
                    <span className="flex items-center gap-3">
                      <span className="h-2 w-2 rounded-full bg-violet-400 shrink-0" />
                      {faq.question}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180 text-violet-400" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-muted-foreground/90 leading-relaxed border-t border-border/30 bg-violet-950/10">
                      {faq.answer}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
