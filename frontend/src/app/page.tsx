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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const features = [
  {
    icon: MessageSquare,
    title: "Secure Messaging",
    description: "End-to-end encrypted communication with self-destruct messages",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: Eye,
    title: "Steganography",
    description: "Hide data inside images, audio, and video with AI-powered embedding",
    gradient: "from-cyan-500 to-blue-600",
  },
  {
    icon: Lock,
    title: "Military-Grade Encryption",
    description: "AES-256-GCM, RSA-4096, ECC, and quantum-resistant algorithms",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: FileSearch,
    title: "Digital Forensics",
    description: "AI-powered steganalysis, tamper detection, and deepfake analysis",
    gradient: "from-orange-500 to-red-600",
  },
  {
    icon: Cpu,
    title: "AI Security Assistant",
    description: "Threat detection, risk scoring, and intelligent recommendations",
    gradient: "from-pink-500 to-rose-600",
  },
  {
    icon: Share2,
    title: "Secure File Sharing",
    description: "Password-protected links with expiration and geo-restrictions",
    gradient: "from-indigo-500 to-violet-600",
  },
  {
    icon: Users,
    title: "Team Workspace",
    description: "Zero-trust collaboration with RBAC and audit logging",
    gradient: "from-yellow-500 to-amber-600",
  },
  {
    icon: Shield,
    title: "Evidence Vault",
    description: "Chain-of-custody proven digital evidence management",
    gradient: "from-sky-500 to-indigo-600",
  },
]

const stats = [
  { value: "AES-256-GCM", label: "Encryption" },
  { value: "99.99%", label: "Uptime" },
  { value: "Zero-Trust", label: "Architecture" },
  { value: "24/7", label: "Monitoring" },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-cyber-500" />
            <span className="text-xl font-bold bg-gradient-to-r from-cyber-500 to-cyan-400 bg-clip-text text-transparent">
              StegShield X
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#modules" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Modules
            </Link>
            <Link href="#security" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Security
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button variant="cyber" size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyber-500/5 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-cyber-500/10 rounded-full blur-3xl" />

        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-4xl mx-auto animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyber-500/30 bg-cyber-500/5 text-sm text-cyber-400 mb-6">
              <Star className="h-4 w-4" />
              <span>Enterprise-Grade Cybersecurity Platform</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              AI-Powered{" "}
              <span className="bg-gradient-to-r from-cyber-500 to-cyan-400 bg-clip-text text-transparent">
                Zero-Trust
              </span>{" "}
              Security
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              Military-grade encryption, invisible steganography, AI forensics, and
              digital evidence protection — all in one unified platform.
            </p>

            <div className="flex items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" variant="cyber" className="text-base">
                  Start Free Trial
                  <ArrowUpRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="text-base">
                  View Demo
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold text-cyber-400">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need for{" "}
              <span className="bg-gradient-to-r from-cyber-500 to-cyan-400 bg-clip-text text-transparent">
                Complete Security
              </span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              25 integrated modules covering encryption, steganography, forensics, AI analysis, and secure collaboration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="group relative overflow-hidden p-6 h-full hover:border-cyber-500/50 transition-all duration-300 animate-fade-in">
                <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.gradient} p-2.5 mb-4`}>
                  <feature.icon className="w-full h-full text-white" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-cyber-500/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 text-center relative">
          <div className="animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Secure Your Digital World?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Join security professionals, investigators, and enterprises who trust StegShield X.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" variant="cyber" className="text-base">
                  Get Started Free
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="text-base">
                  Contact Sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/50 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-cyber-500" />
              <span className="font-bold">StegShield X</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Security</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Documentation</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; 2026 StegShield X. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
