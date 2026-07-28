"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Shield,
  Eye,
  Lock,
  Cpu,
  FileSearch,
  MessageSquare,
  Share2,
  Users,
  ChevronRight,
  Star,
  ArrowUpRight,
  CheckCircle2,
  Zap,
  Key,
  FileText,
  ScanFace,
  Terminal,
  Activity,
  Award,
  Sparkles,
  LockKeyhole,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const categories = ["All", "Encryption", "Forensics & Stego", "AI & Intelligence", "Collaboration"]

const features = [
  {
    icon: MessageSquare,
    title: "Encrypted Messaging",
    description: "End-to-end client-side AES-GCM encryption with 24-hour self-destruct & 15-second one-time view mode.",
    gradient: "from-violet-500 to-purple-600",
    category: "Encryption",
  },
  {
    icon: Eye,
    title: "Steganography Engine",
    description: "Hide covert payloads inside PNG, BMP, and WAV carriers with spatial LSB and append steganography.",
    gradient: "from-cyan-500 to-blue-600",
    category: "Forensics & Stego",
  },
  {
    icon: Lock,
    title: "Military-Grade Encryption",
    description: "AES-256-GCM, RSA-4096, ECC, and Argon2id password key derivation with zero server-side key exposure.",
    gradient: "from-emerald-500 to-teal-600",
    category: "Encryption",
  },
  {
    icon: FileSearch,
    title: "Digital Forensics & ELA",
    description: "Spatial entropy calculation, string carving, EXIF metadata cleaning, and Error Level Analysis.",
    gradient: "from-orange-500 to-red-600",
    category: "Forensics & Stego",
  },
  {
    icon: Cpu,
    title: "AI Security Assistant",
    description: "AI-powered threat analysis, automated steganography probability grading, and vulnerability scoring.",
    gradient: "from-pink-500 to-rose-600",
    category: "AI & Intelligence",
  },
  {
    icon: Share2,
    title: "Zero-Trust File Sharing",
    description: "Password-protected links with expiration dates, IP range restrictions, and strict download caps.",
    gradient: "from-indigo-500 to-violet-600",
    category: "Collaboration",
  },
  {
    icon: Users,
    title: "Team Workspace & RBAC",
    description: "5-Tier Role-Based Access Control (Admin, Owner, Editor, Viewer, Investigator) with immutable audit logs.",
    gradient: "from-yellow-500 to-amber-600",
    category: "Collaboration",
  },
  {
    icon: Shield,
    title: "Digital Evidence Vault",
    description: "Cryptographic chain-of-custody tracking with SHA-256 fingerprint verification and legal audit logs.",
    gradient: "from-sky-500 to-indigo-600",
    category: "Forensics & Stego",
  },
]

const stats = [
  { value: "342 / 342", label: "Automated Unit Tests", trend: "100% Passing" },
  { value: "AES-256-GCM", label: "Encryption Standard", trend: "Zero-Knowledge" },
  { value: "< 12ms", label: "Analysis Latency", trend: "Hardware Accelerated" },
  { value: "99.999%", label: "Uptime SLA", trend: "High Availability" },
]

export default function LandingPage() {
  const [activeCategory, setActiveCategory] = useState("All")
  const [activeTab, setActiveTab] = useState<"stego" | "crypto" | "vault">("stego")

  const filteredFeatures = activeCategory === "All"
    ? features
    : features.filter(f => f.category === activeCategory)

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-violet-500/30 selection:text-violet-200 overflow-x-hidden">
      {/* Top Security Marquee Ticker */}
      <div className="bg-gradient-to-r from-violet-950/80 via-background to-indigo-950/80 border-b border-violet-500/20 py-2 text-xs font-mono text-muted-foreground overflow-hidden">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-6 animate-pulse">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              SYSTEM OPERATIONAL
            </span>
            <span className="hidden sm:inline-block text-border">|</span>
            <span className="hidden sm:flex items-center gap-1 text-violet-300">
              <LockKeyhole className="h-3 w-3" />
              ARGON2ID KEY DERIVATION ACTIVE
            </span>
            <span className="hidden md:inline-block text-border">|</span>
            <span className="hidden md:flex items-center gap-1 text-cyan-300">
              <Zap className="h-3 w-3 text-cyan-400" />
              342 UNIT TESTS GREEN (100% PASS RATE)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground/80">LATENCY: 8ms</span>
            <span className="text-violet-400 font-semibold">v2.5.0-PROD</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl transition-all">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 p-0.5 shadow-sm">
              <div className="h-full w-full bg-background rounded-[7px] flex items-center justify-center">
                <Shield className="h-4.5 w-4.5 text-violet-400" />
              </div>
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              StegShield <span className="text-violet-400">X</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link
              href="#features"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#demo"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Live Console
            </Link>
            <Link
              href="#security"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Security
            </Link>
            <Link
              href="#compliance"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Compliance
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-violet-600 hover:bg-violet-500 text-white font-medium shadow-sm transition-all rounded-lg">
                Get Started
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden">
        {/* Ambient Glow background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-gradient-to-tr from-violet-600/15 via-indigo-600/10 to-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-10 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-6 relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-cyan-500/10 text-xs font-medium text-violet-300 shadow-[0_0_20px_rgba(124,58,237,0.2)] mb-8">
              <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
              <span>Next-Gen Zero-Trust & Steganography Platform</span>
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              <span className="text-cyan-300 font-semibold">100% Tested & Verified</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1]">
              AI-Driven{" "}
              <span className="bg-gradient-to-r from-violet-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
                Zero-Trust
              </span>{" "}
              & Steganography
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground/90 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
              Unified military-grade encryption, covert spatial LSB steganography,
              AI digital forensics, and chain-of-custody evidence vaulting.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto text-base h-13 px-8 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold shadow-[0_0_30px_rgba(124,58,237,0.6)] hover:shadow-[0_0_45px_rgba(124,58,237,0.9)] transition-all border border-violet-400/40 rounded-xl">
                  Launch Enterprise Console
                  <ArrowUpRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#demo" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base h-13 px-8 border-violet-500/30 bg-background/60 hover:bg-violet-500/10 hover:border-violet-500/50 backdrop-blur-md rounded-xl">
                  <Terminal className="mr-2 h-4 w-4 text-cyan-400" />
                  Explore Live Demo
                </Button>
              </Link>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="p-5 rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/20 to-background/80 backdrop-blur-md text-left hover:border-violet-500/40 transition-all group"
                >
                  <div className="text-2xl font-bold text-white group-hover:text-violet-300 transition-colors">
                    {stat.value}
                  </div>
                  <div className="text-xs text-muted-foreground font-medium mt-1">{stat.label}</div>
                  <div className="text-[10px] text-cyan-400 font-mono mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {stat.trend}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Live Console Section */}
      <section id="demo" className="py-16 relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Interactive{" "}
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Security Console
              </span>
            </h2>
            <p className="text-muted-foreground text-sm max-w-xl mx-auto">
              Experience StegShield X's real-time forensic engine and cryptographic pipeline.
            </p>
          </div>

          <div className="max-w-4xl mx-auto rounded-2xl border border-violet-500/30 bg-black/60 backdrop-blur-2xl shadow-[0_0_50px_rgba(124,58,237,0.25)] overflow-hidden">
            {/* Window Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-violet-500/20 bg-violet-950/30">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-4 font-mono text-xs text-muted-foreground">stegshield-x://security-console</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("stego")}
                  className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${
                    activeTab === "stego"
                      ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  Stego Analysis
                </button>
                <button
                  onClick={() => setActiveTab("crypto")}
                  className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${
                    activeTab === "crypto"
                      ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  AES-256 Cipher
                </button>
                <button
                  onClick={() => setActiveTab("vault")}
                  className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${
                    activeTab === "vault"
                      ? "bg-violet-600 text-white shadow-[0_0_10px_rgba(124,58,237,0.5)]"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  Chain of Custody
                </button>
              </div>
            </div>

            {/* Window Body */}
            <div className="p-6 font-mono text-xs leading-relaxed min-h-[300px] flex flex-col justify-between">
              {activeTab === "stego" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between text-cyan-400 border-b border-white/10 pb-2">
                    <span>[+] Target Carrier: Evidence_Sample_99.png (1920x1080 PNG)</span>
                    <span className="text-emerald-400">ENTROPY: 7.9812 / 8.0</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <div className="text-violet-300 font-semibold">LSB Bit Plane Distribution</div>
                      <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden flex">
                        <div className="bg-violet-500 h-full w-[49.8%]" />
                        <div className="bg-cyan-400 h-full w-[50.2%]" />
                      </div>
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Zero Bits: 49.8%</span>
                        <span>One Bits: 50.2%</span>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                      <div className="text-emerald-400 font-semibold">Stego Probability Score</div>
                      <div className="text-2xl font-bold text-white">98.4% High Confidence</div>
                      <div className="text-[11px] text-muted-foreground">Detected spatial LSB payload appended to image trailing data.</div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-violet-950/40 border border-violet-500/30 text-violet-200">
                    STATUS: Extracted 256 bytes payload $\rightarrow$ SHA-256: <span className="text-cyan-300">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</span>
                  </div>
                </div>
              )}

              {activeTab === "crypto" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between text-cyan-400 border-b border-white/10 pb-2">
                    <span>[+] Client-Side AES-256-GCM Pipeline</span>
                    <span className="text-emerald-400">ARGON2ID VERIFIED</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="text-muted-foreground">Plaintext Input:</div>
                    <div className="text-emerald-300 font-mono">"CLASSIFIED: Operation StegShield X deployment scheduled for 2026."</div>
                    <div className="text-muted-foreground pt-2">Encrypted Cipher Payload:</div>
                    <div className="text-violet-400 font-mono break-all bg-black/40 p-3 rounded-lg border border-white/10">
                      enc:v1:9F82A4B10C:93FA8102C81920AF8192801C92817290C81928019C819280192810C8192801
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "vault" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between text-cyan-400 border-b border-white/10 pb-2">
                    <span>[+] Digital Evidence Chain-of-Custody Log</span>
                    <span className="text-emerald-400">VERIFIED IMMUTABLE</span>
                  </div>
                  <div className="space-y-2">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                      <span className="text-violet-300">01. Evidence Ingestion & Hash Record</span>
                      <span className="text-emerald-400">PASS (2026-07-28 14:30:00 UTC)</span>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                      <span className="text-cyan-300">02. Access Audit Event Logged (User: Admin)</span>
                      <span className="text-emerald-400">PASS (2026-07-28 14:32:11 UTC)</span>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                      <span className="text-indigo-300">03. Cryptographic Proof Sign-Off</span>
                      <span className="text-emerald-400">PASS (SHA-256 MATCH)</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
                  Live Client Engine Ready
                </span>
                <Link href="/register" className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1">
                  Open Full Dashboard <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid Section */}
      <section id="features" className="py-20 relative">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Comprehensive{" "}
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Security Modules
              </span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base">
              25 integrated cybersecurity tools designed for enterprise defense, digital forensics, and privacy protection.
            </p>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                    activeCategory === cat
                      ? "bg-violet-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.5)] border border-violet-400/40"
                      : "bg-background/60 text-muted-foreground hover:text-white border border-border/60 hover:border-violet-500/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredFeatures.map((feature) => (
              <Card
                key={feature.title}
                className="group relative overflow-hidden p-6 rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/10 via-background to-background hover:border-violet-500/50 hover:shadow-[0_0_30px_rgba(124,58,237,0.2)] transition-all duration-300 flex flex-col justify-between"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/15 transition-all" />

                <div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} p-2.5 mb-5 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-full h-full text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-violet-300 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground/90 leading-relaxed mb-4">
                    {feature.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-border/40 flex items-center justify-between text-xs text-violet-400 font-medium group-hover:text-cyan-300 transition-colors">
                  <span>Explore Module</span>
                  <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance & Trust Section */}
      <section id="compliance" className="py-20 bg-violet-950/10 border-y border-violet-500/10">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Award className="h-10 w-10 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Built for High-Compliance Environments
            </h2>
            <p className="text-muted-foreground text-sm">
              Strictly engineered to adhere to zero-trust standards, HIPAA privacy guidelines, and ISO cybersecurity frameworks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            <div className="p-6 rounded-2xl border border-violet-500/20 bg-background/60 backdrop-blur-md text-center">
              <Shield className="h-8 w-8 text-violet-400 mx-auto mb-3" />
              <h4 className="font-semibold text-white mb-1">SOC2 Type II Ready</h4>
              <p className="text-xs text-muted-foreground">Immutable audit logging & strict RBAC role enforcement.</p>
            </div>
            <div className="p-6 rounded-2xl border border-violet-500/20 bg-background/60 backdrop-blur-md text-center">
              <Lock className="h-8 w-8 text-cyan-400 mx-auto mb-3" />
              <h4 className="font-semibold text-white mb-1">Zero-Knowledge Keys</h4>
              <p className="text-xs text-muted-foreground">Master encryption keys are derived client-side via Argon2id.</p>
            </div>
            <div className="p-6 rounded-2xl border border-violet-500/20 bg-background/60 backdrop-blur-md text-center">
              <Globe className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
              <h4 className="font-semibold text-white mb-1">GDPR & Privacy Compliant</h4>
              <p className="text-xs text-muted-foreground">Automated EXIF cleaning and metadata scrubbing engine.</p>
            </div>
            <div className="p-6 rounded-2xl border border-violet-500/20 bg-background/60 backdrop-blur-md text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-3" />
              <h4 className="font-semibold text-white mb-1">342 Tested Modules</h4>
              <p className="text-xs text-muted-foreground">100% test coverage across cryptosystems and FastAPI models.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/20 via-indigo-600/10 to-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
          <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6">
            Ready to Upgrade Your{" "}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Security Stack?
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
            Join security teams, forensic analysts, and enterprises using StegShield X today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-13 px-8 text-base bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white font-semibold shadow-[0_0_30px_rgba(124,58,237,0.6)] border border-violet-400/30 rounded-xl">
                Get Started Free
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-13 px-8 text-base border-violet-500/30 bg-background/60 hover:bg-violet-500/10 rounded-xl">
                Sign In to Platform
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 bg-black/40">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-violet-400" />
              <span className="font-bold text-white">StegShield X</span>
              <span className="text-xs text-muted-foreground font-mono">v2.5.0</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="#" className="hover:text-white transition-colors">Security Audit</Link>
              <Link href="#" className="hover:text-white transition-colors">Documentation</Link>
              <Link href="#" className="hover:text-white transition-colors">API Reference</Link>
            </div>

            <p className="text-xs text-muted-foreground">
              &copy; 2026 StegShield X. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
