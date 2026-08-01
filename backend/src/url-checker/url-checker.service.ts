import { Injectable, Logger } from "@nestjs/common"
import * as dns from "dns"
import * as tls from "tls"
import * as net from "net"
import { promisify } from "util"

const dnsResolve4 = promisify(dns.resolve4)
const dnsResolve6 = promisify(dns.resolve6)
const dnsResolveMx = promisify(dns.resolveMx)
const dnsResolveNs = promisify(dns.resolveNs)
const dnsResolveTxt = promisify(dns.resolveTxt)

export interface UrlCheckResult {
  url: string
  timestamp: string
  riskScore: number
  riskLevel: "safe" | "low" | "medium" | "high" | "critical"
  summary: {
    totalChecks: number
    passed: number
    warnings: number
    failures: number
  }
  sections: {
    structure: SectionResult
    hostname: SectionResult
    network: SectionResult
    ssl: SectionResult
    content: SectionResult
    headers: SectionResult
    reputation: SectionResult
  }
  redirectChain?: string[]
  finalDestination?: string
}

export interface SectionResult {
  score: number
  maxScore: number
  findings: Finding[]
}

export interface Finding {
  type: "passed" | "warning" | "failed" | "info"
  severity: "low" | "medium" | "high" | "critical"
  category: string
  detail: string
  recommendation?: string
}

const SUSPICIOUS_TLDS = new Set([
  "tk", "ml", "ga", "cf", "gq", "xyz", "top", "club", "work", "date",
  "men", "loan", "win", "bid", "download", "review", "trade", "science",
  "party", "racing", "accountant", "wang", "click", "link", "cam",
  "icu", "live", "pro", "rest", "cyou", "shop", "store", "blog",
])

const URL_SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "ow.ly", "is.gd", "buff.ly", "tiny.cc",
  "tr.im", "shorturl.at", "cutt.ly", "rb.gy", "t.co", "goo.gl",
  "bitly.com", "short.link", "s.id", "soo.gd", "zzb.bz", "cli.gs",
  "u.nu", "v.gd", "lc.chat", "bl.ink", "shorte.st", "adf.ly",
])

const PHISHING_KEYWORDS = [
  "login", "signin", "verify", "secure", "update", "confirm",
  "account", "banking", "password", "credential", "authenticate",
  "reset", "recover", "alert", "security", "webscr", "paypal",
  "free-money", "free-gift", "claim", "winning", "prize",
  "lottery", "inheritance", "cryptocurrency", "wallet", "bonus",
  "refund", "invoice", "statement", "unlock", "suspend", "blocked",
  "limited", "restricted", "validation", "ssn", "social-security",
]

const BRAND_NAMES = [
  "google", "facebook", "amazon", "paypal", "microsoft", "apple",
  "netflix", "instagram", "whatsapp", "telegram", "twitter", "x",
  "linkedin", "dropbox", "adobe", "github", "gitlab", "reddit",
  "discord", "slack", "zoom", "outlook", "office365", "sharepoint",
  "salesforce", "oracle", "ibm", "intel", "cisco", "vmware",
  "spotify", "youtube", "tiktok", "snapchat", "pinterest", "ebay",
  "walgreens", "chase", "wellsfargo", "bankofamerica", "amex",
  "visa", "mastercard", "payoneer", "stripe", "shopify", "woocommerce",
  "wordpress", "cloudflare", "atlassian", "samsung", "huawei", "xiaomi",
]

const MALICIOUS_IP_RANGES = [
  { start: "10.", end: "10." },
  { start: "172.16.", end: "172.31." },
  { start: "192.168.", end: "192.168." },
  { start: "127.", end: "127." },
  { start: "0.", end: "0." },
  { start: "169.254.", end: "169.254." },
  { start: "100.64.", end: "100.127." },
  { start: "198.18.", end: "198.19." },
]

const SECURITY_HEADERS_BEST_PRACTICES: Record<string, { desc: string; recommended: string; severity: "low" | "medium" | "high" }> = {
  "strict-transport-security": { desc: "HTTP Strict Transport Security", recommended: "Present", severity: "high" },
  "content-security-policy": { desc: "Content Security Policy", recommended: "Present", severity: "high" },
  "x-frame-options": { desc: "Clickjacking Protection", recommended: "DENY or SAMEORIGIN", severity: "medium" },
  "x-content-type-options": { desc: "MIME Type Sniffing Protection", recommended: "nosniff", severity: "medium" },
  "x-xss-protection": { desc: "XSS Protection", recommended: "1; mode=block", severity: "medium" },
  "referrer-policy": { desc: "Referrer Policy", recommended: "Present", severity: "low" },
  "permissions-policy": { desc: "Permissions Policy", recommended: "Present", severity: "low" },
  "cache-control": { desc: "Cache Control", recommended: "no-store for sensitive pages", severity: "medium" },
}

@Injectable()
export class UrlCheckerService {
  private readonly logger = new Logger(UrlCheckerService.name)
  private readonly urlscanApiKey = process.env.URLSCAN_API_KEY || ""

  async checkUrl(url: string): Promise<UrlCheckResult> {
    const sections = {
      structure: { score: 0, maxScore: 100, findings: [] as Finding[] },
      hostname: { score: 0, maxScore: 100, findings: [] as Finding[] },
      network: { score: 0, maxScore: 100, findings: [] as Finding[] },
      ssl: { score: 0, maxScore: 100, findings: [] as Finding[] },
      content: { score: 0, maxScore: 100, findings: [] as Finding[] },
      headers: { score: 0, maxScore: 100, findings: [] as Finding[] },
      reputation: { score: 0, maxScore: 100, findings: [] as Finding[] },
    }

    const urlMatch = url.match(/(?:https?:\/\/|www\.)[^\s<>"'}{|\\\^`\[\]()]+/i)
    if (urlMatch) {
      url = urlMatch[0]
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
      sections.structure.findings.push({
        type: "info", severity: "low",
        category: "Protocol Default",
        detail: "No protocol specified — defaulted to HTTPS",
      })
    }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return {
        url, timestamp: new Date().toISOString(),
        riskScore: 100, riskLevel: "critical",
        summary: { totalChecks: 1, passed: 0, warnings: 0, failures: 1 },
        sections,
      }
    }

    const { hostname, protocol, pathname, search, port, hash, username, password } = parsed

    await Promise.all([
      this.analyzeStructure(parsed, sections),
      this.analyzeHostname(hostname, sections),
      this.analyzeNetwork(hostname, protocol, sections),
      this.analyzeSsl(hostname, protocol, sections),
      this.analyzeContent(url, sections),
      this.analyzeHeaders(url, sections),
      this.analyzeReputation(url, hostname, sections),
    ])

    let totalScore = 0
    let maxPossible = 0
    let totalPassed = 0, totalWarnings = 0, totalFailures = 0
    for (const [key, section] of Object.entries(sections)) {
      if (key === "structure" || key === "ssl" || key === "headers") {
        if (protocol !== "https:" && (key === "ssl" || key === "headers")) continue
      }
      totalScore += section.score
      maxPossible += section.maxScore
      for (const f of section.findings) {
        if (f.type === "passed") totalPassed++
        else if (f.type === "warning") totalWarnings++
        else if (f.type === "failed") totalFailures++
      }
    }

    const riskScore = maxPossible > 0 ? Math.round((1 - totalScore / maxPossible) * 100) : 0
    const riskLevel = this.getRiskLevel(riskScore)

    let redirectChain: string[] | undefined
    let finalDestination: string | undefined
    try {
      const result = await this.followRedirects(url)
      if (result.chain.length > 1) {
        redirectChain = result.chain
        finalDestination = result.finalUrl
      }
    } catch {}

    return {
      url,
      timestamp: new Date().toISOString(),
      riskScore,
      riskLevel,
      summary: { totalChecks: totalPassed + totalWarnings + totalFailures, passed: totalPassed, warnings: totalWarnings, failures: totalFailures },
      sections,
      redirectChain,
      finalDestination,
    }
  }

  private async analyzeStructure(parsed: URL, sections: Record<string, SectionResult>): Promise<void> {
    const s = sections.structure

    this.addFinding(s, "passed", "low", "URL Format", "URL is well-formed and parseable")

    const { protocol, hostname, port, pathname, search, hash, username, password } = parsed

    if (username || password) {
      this.addFinding(s, "failed", "critical", "Credentials in URL",
        "URL contains username or password — credentials sent with every request",
        "Never embed credentials in URLs; use form-based authentication")
    }

    if (hash) {
      this.addFinding(s, "warning", "low", "URL Fragment",
        "URL contains a fragment (#) — fragment is client-side only and not sent to server")
    }

    if (protocol !== "https:") {
      this.addFinding(s, "failed", "high", "Insecure Protocol",
        `Protocol is "${protocol.replace(/:$/, "")}" — data transmitted in plaintext`,
        "Use HTTPS to encrypt all data in transit")
    } else {
      this.addFinding(s, "passed", "low", "Encrypted Protocol", "Connection uses HTTPS encryption")
    }

    if (port) {
      this.addFinding(s, "warning", "medium", "Non-standard Port",
        `Uses custom port ${port} — may bypass network security policies`)
    } else {
      this.addFinding(s, "passed", "low", "Standard Port", "Uses default port for protocol")
    }

    if (parsed.href !== parsed.href.replace(/[<>"'{}|\\^`]/g, "")) {
      this.addFinding(s, "failed", "medium", "Special Characters in URL",
        "URL contains special characters that may be used for injection",
        "Avoid unsafe characters in URLs; use proper URL encoding")
    }

    const pathLower = pathname.toLowerCase()
    if (/\.(exe|dll|bat|cmd|scr|js|vbs|ps1|jar|apk|msi)$/i.test(pathLower)) {
      this.addFinding(s, "warning", "high", "Executable File",
        `URL points to an executable file — may be malware`,
        "Only download executables from trusted sources")
    }

    if (/\.(zip|rar|7z|tar\.gz)$/i.test(pathLower)) {
      this.addFinding(s, "warning", "medium", "Archive File",
        "URL points to a compressed archive — may contain harmful content")
    }

    if (parsed.protocol === "javascript:") {
      this.addFinding(s, "failed", "critical", "JavaScript Protocol",
        "URL uses javascript: protocol — executes code in the browser",
        "Never click javascript: links from untrusted sources")
    }

    if (parsed.protocol === "data:") {
      this.addFinding(s, "failed", "high", "Data URI",
        "URL uses data: URI scheme — commonly used in phishing and XSS attacks")
    }

    const encodedPieces = pathname.match(/%[0-9a-fA-F]{2}/g)
    if (encodedPieces && encodedPieces.length > 10) {
      this.addFinding(s, "warning", "medium", "Heavily Encoded URL",
        `Path contains ${encodedPieces.length} percent-encoded characters — may be obfuscation`,
        "Heavy encoding is often used to hide malicious intent")
    }

    const suspiciousProtocols = ["ftp:", "telnet:", "gopher:"]
    if (suspiciousProtocols.includes(parsed.protocol)) {
      this.addFinding(s, "failed", "high", "Suspicious Protocol",
        `Uses ${parsed.protocol.replace(":", "")} protocol — unusual for web traffic`)
    }

    const repeatCount = (pathname.match(/(\/{2,})/g) || []).length
    if (repeatCount > 0) {
      this.addFinding(s, "warning", "low", "Multiple Slashes",
        "Path contains repeated slashes — may indicate URL manipulation")
    }

    if (/[^\x20-\x7E]/.test(parsed.href)) {
      this.addFinding(s, "warning", "medium", "Non-ASCII Characters",
        "URL contains non-ASCII characters — could be used for homograph attacks",
        "Use Punycode encoding for internationalized domain names")
    }

    const emojiRegex = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/u
    if (emojiRegex.test(parsed.href)) {
      this.addFinding(s, "failed", "high", "Emoji in URL",
        "URL contains emoji characters — extremely unusual for legitimate URLs",
        "Emojis in URLs are almost exclusively used in phishing attacks")
    }

    s.score = this.calculateSectionScore(s)
  }

  private async analyzeHostname(hostname: string, sections: Record<string, SectionResult>): Promise<void> {
    const s = sections.hostname
    const parts = hostname.split(".")
    const tld = parts[parts.length - 1]?.toLowerCase()
    const sld = parts.length >= 2 ? parts[parts.length - 2]?.toLowerCase() : ""
    const domain = parts.slice(-2).join(".").toLowerCase()
    const fullHostname = hostname.toLowerCase()

    this.addFinding(s, "passed", "low", "Hostname Format", `Hostname has ${parts.length} label(s)`)

    if (SUSPICIOUS_TLDS.has(tld)) {
      this.addFinding(s, "failed", "high", "Suspicious TLD",
        `.${tld.toUpperCase()} is a high-risk TLD — widely used by spam and malware domains`,
        "Avoid interacting with sites using free/high-risk TLDs")
    } else {
      this.addFinding(s, "passed", "low", "Top-Level Domain", `.${tld.toUpperCase()} is a commonly used TLD`)
    }

    if (URL_SHORTENERS.has(domain)) {
      this.addFinding(s, "failed", "high", "URL Shortener Detected",
        `"${domain}" is a known URL shortening service — destination is hidden`,
        "Use URL preview tools to verify the destination before clicking")
    }

    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipPattern.test(hostname)) {
      const isPrivate = this.isPrivateIp(hostname)
      if (isPrivate) {
        this.addFinding(s, "failed", "critical", "Private IP Address",
          `URL uses a private IP address (${hostname}) — only accessible on local networks`,
          "Legitimate services use domain names, not raw IPs")
      } else {
        this.addFinding(s, "failed", "high", "IP Address Instead of Domain",
          `URL uses a raw IP address (${hostname}) instead of a domain name`,
          "Standard websites use domain names; IP-based URLs often bypass security filters")
      }
    } else {
      this.addFinding(s, "passed", "low", "Domain Name Used", "URL uses a proper domain name instead of an IP address")
    }

    if (parts.length > 4) {
      this.addFinding(s, "warning", "medium", "Excessive Subdomains",
        `${parts.length - 2} subdomain level(s) — may be misleading users about the true domain`,
        "Check the last two labels (registered domain) for authenticity")
    } else {
      this.addFinding(s, "passed", "low", "Subdomain Count", `${parts.length - 2} subdomain level(s) — standard`)
    }

    if (/^\d/.test(sld)) {
      this.addFinding(s, "warning", "medium", "Domain Starts with Digit",
        `Domain "${sld}" starts with a number — uncommon for legitimate domains`,
        "Most legitimate domains start with a letter")
    }

    if (/\d{4,}/.test(hostname)) {
      this.addFinding(s, "warning", "medium", "Excessive Numbers in Domain",
        "Four or more consecutive digits in hostname — common in auto-generated malicious domains")
    }

    const hyphenCount = (hostname.match(/-/g) || []).length
    if (hyphenCount >= 3) {
      this.addFinding(s, "warning", "medium", "Multiple Hyphens",
        `${hyphenCount} hyphens in hostname — typosquatters and scam sites frequently use hyphens`,
        "Legitimate domains rarely have more than 2 hyphens")
    }

    if (hostname.length > 50) {
      this.addFinding(s, "warning", "low", "Long Hostname",
        `Hostname is ${hostname.length} characters — unusually long`)
    }

    if (/^www\./.test(hostname)) {
      this.addFinding(s, "passed", "low", "WWW Subdomain", "Standard www subdomain")
    }

    const suspiciousKeyword = PHISHING_KEYWORDS.find(k => sld.includes(k) || domain.includes(k))
    if (suspiciousKeyword) {
      this.addFinding(s, "failed", "critical", "Phishing Keyword in Domain",
        `Domain contains "${suspiciousKeyword}" — this is a primary phishing red flag`,
        `Legitimate sites rarely include "${suspiciousKeyword}" in their primary domain name`)
    }

    if (sld.length >= 3) {
      this.checkTyposquatting(sld, s)
    }
    if (fullHostname.length >= 5) {
      this.checkTyposquatting(fullHostname, s)
    }

    if (/[^a-zA-Z0-9.-]/.test(hostname)) {
      this.addFinding(s, "warning", "medium", "Unusual Characters",
        "Hostname contains non-standard characters — possible homograph attack")
    }

    try {
      if (hostname.includes("xn--")) {
        const punycode = new URL(`http://${hostname}`).hostname
        this.addFinding(s, "warning", "high", "Internationalized Domain (IDN)",
          "Domain uses Punycode (xn-- prefix) — may look identical to a legitimate domain",
          "IDN domains can visually spoof trusted brands using lookalike characters")
      }
    } catch {}

    const repeated = /([a-zA-Z0-9-]{2,})\1{2,}/.test(hostname)
    if (repeated) {
      this.addFinding(s, "warning", "low", "Repeating Pattern",
        "Hostname contains repeating character sequences — common in algorithmically generated domains")
    }

    const consonantRatio = (hostname.match(/[bcdfghjklmnpqrstvwxyz]/g) || []).length / hostname.length
    if (consonantRatio > 0.7 && hostname.length > 10) {
      this.addFinding(s, "warning", "low", "Unnatural Hostname",
        "Hostname has a high consonant-to-vowel ratio — common in auto-generated domains")
    }

    s.score = this.calculateSectionScore(s)
  }

  private async analyzeNetwork(hostname: string, protocol: string, sections: Record<string, SectionResult>): Promise<void> {
    const s = sections.network
    const isHttp = protocol !== "https:"

    if (isHttp) {
      this.addFinding(s, "info", "low", "Network Scan Skipped", "Network analysis requires HTTPS")
      s.score = s.maxScore / 2
      return
    }

    const addresses = await this.resolveHostname(hostname)
    if (addresses.length === 0) {
      this.addFinding(s, "failed", "high", "DNS Resolution Failed",
        "No DNS records found — domain may not exist or is unreachable")
    } else {
      const v4 = addresses.filter(a => !a.includes(":"))
      const v6 = addresses.filter(a => a.includes(":"))
      const parts: string[] = []
      if (v4.length > 0) parts.push(`${v4.length} IPv4`)
      if (v6.length > 0) parts.push(`${v6.length} IPv6`)
      this.addFinding(s, "passed", "low", "DNS Resolution",
        `Resolves to ${addresses.length} address(es) (${parts.join(", ")}): ${addresses.slice(0, 3).join(", ")}${addresses.length > 3 ? "..." : ""}`)

      for (const addr of addresses) {
        if (this.isPrivateIp(addr)) {
          this.addFinding(s, "failed", "high", "Private/Reserved IP",
            `Resolves to private/reserved IP ${addr} — DNS poisoning possible`)
        }
      }
    }

    try {
      const mx = await dnsResolveMx(hostname)
      this.addFinding(s, "passed", "low", "Mail Exchange (MX) Records",
        `${mx.length} mail server(s) configured`)
    } catch {
      this.addFinding(s, "warning", "low", "No MX Records",
        "No mail exchange records — domain cannot receive email")
    }

    try {
      const ns = await dnsResolveNs(hostname)
      this.addFinding(s, "passed", "low", "Nameserver (NS) Records",
        `Authority: ${ns.slice(0, 3).join(", ")}${ns.length > 3 ? "..." : ""}`)
    } catch {
      this.addFinding(s, "failed", "high", "No Nameserver Records",
        "No authoritative nameservers — domain configuration is incomplete")
    }

    try {
      const txtRecords = await dnsResolveTxt(hostname)
      const flatTxt = txtRecords.map(r => r.join(" ").toLowerCase())

      const spf = flatTxt.find(r => r.startsWith("v=spf1"))
      if (spf) {
        const hasHardFail = spf.includes("-all")
        const hasSoftFail = spf.includes("~all")
        if (hasHardFail) {
          this.addFinding(s, "passed", "low", "SPF Record (Hard Fail)",
            "SPF policy uses -all — unauthorized senders are rejected")
        } else if (hasSoftFail) {
          this.addFinding(s, "warning", "medium", "SPF Record (Soft Fail)",
            "SPF policy uses ~all — unauthorized emails are marked but delivered",
            "Switch to -all for strict email authentication")
        } else {
          this.addFinding(s, "warning", "medium", "SPF Record (No Hard Fail)",
            "SPF record exists but lacks -all — domain is vulnerable to email spoofing",
            "Add -all to your SPF record to reject unauthorized senders")
        }
      } else {
        this.addFinding(s, "warning", "high", "No SPF Record",
          "No SPF record found — domain can be spoofed in emails",
          "Add an SPF record to prevent email impersonation")
      }

      const dmarc = flatTxt.find(r => r.startsWith("v=dmarc1"))
      if (dmarc) {
        if (dmarc.includes("p=reject")) {
          this.addFinding(s, "passed", "low", "DMARC Policy (Reject)",
            "DMARC policy is p=reject — strong protection against email spoofing")
        } else if (dmarc.includes("p=quarantine")) {
          this.addFinding(s, "warning", "medium", "DMARC Policy (Quarantine)",
            "DMARC policy is p=quarantine — suspicious emails are sent to spam",
            "Consider upgrading to p=reject for stronger protection")
        } else if (dmarc.includes("p=none")) {
          this.addFinding(s, "warning", "medium", "DMARC Policy (None)",
            "DMARC is in monitoring mode (p=none) — no enforcement",
            "Set p=quarantine or p=reject once monitoring is complete")
        }
      } else {
        this.addFinding(s, "warning", "high", "No DMARC Record",
          "No DMARC record — domain is vulnerable to email spoofing and phishing",
          "Publish a DMARC record to protect your domain from impersonation")
      }

      const dkimSelectors = ["default", "google", "dkim", "mail", "selector1", "selector2"]
      let foundDkim = false
      for (const sel of dkimSelectors) {
        try {
          await dnsResolveTxt(`${sel}._domainkey.${hostname}`)
          foundDkim = true
          break
        } catch {}
      }
      if (foundDkim) {
        this.addFinding(s, "passed", "low", "DKIM Signatures",
          "DKIM keys found — outgoing emails are cryptographically signed")
      } else {
        this.addFinding(s, "warning", "medium", "No DKIM Found",
          "No DKIM keys detected for common selectors — emails may lack cryptographic signatures",
          "Configure DKIM signing for your email-sending domains")
      }
    } catch {
      this.addFinding(s, "info", "low", "TXT Records Unavailable",
        "Could not query DNS TXT records for email security analysis")
    }

    s.score = this.calculateSectionScore(s)
  }

  private async analyzeSsl(hostname: string, protocol: string, sections: Record<string, SectionResult>): Promise<void> {
    const s = sections.ssl

    if (protocol !== "https:") {
      this.addFinding(s, "failed", "high", "SSL/TLS Not Applicable",
        "No HTTPS — SSL/TLS certificate analysis requires a secure connection",
        "Switch to HTTPS to enable encryption and trust verification")
      s.score = 0
      return
    }

    this.addFinding(s, "passed", "low", "SSL/TLS Enabled", "Server supports encrypted connections via TLS")

    try {
      const cert = await this.getCertificate(hostname)
      if (!cert) {
        this.addFinding(s, "failed", "critical", "No Certificate",
          "Could not retrieve SSL/TLS certificate — connection may be intercepted",
          "Ensure the server presents a valid certificate from a trusted CA")
        s.score = this.calculateSectionScore(s)
        return
      }

      this.addFinding(s, "passed", "low", "Certificate Issued",
        `Issued by: ${cert.issuer?.O || cert.issuer?.CN || "Unknown CA"}`)

      if (cert.subject) {
        this.addFinding(s, "passed", "low", "Certificate Subject",
          `Issued to: ${cert.subject.CN || hostname}`)
      }

      const now = new Date()
      const validFrom = new Date(cert.validFrom)
      const validTo = new Date(cert.validTo)

      if (now < validFrom) {
        this.addFinding(s, "failed", "critical", "Certificate Not Yet Valid",
          `Certificate becomes valid on ${validFrom.toLocaleDateString()} — clock skew or future-dated cert`)
      } else {
        this.addFinding(s, "passed", "low", "Certificate Validity Start",
          `Valid from ${validFrom.toLocaleDateString()}`)
      }

      if (now > validTo) {
        this.addFinding(s, "failed", "critical", "Certificate Expired",
          `Certificate expired on ${validTo.toLocaleDateString()} — ${Math.round((now.getTime() - validTo.getTime()) / 86400000)} days ago`,
          "Expired certificates indicate poor maintenance or a compromised server")
      } else {
        const daysLeft = Math.round((validTo.getTime() - now.getTime()) / 86400000)
        if (daysLeft < 30) {
          this.addFinding(s, "warning", "medium", "Certificate Expiring Soon",
            `Certificate expires in ${daysLeft} day(s) — renew promptly`)
        } else {
          this.addFinding(s, "passed", "low", "Certificate Validity Period",
            `Valid until ${validTo.toLocaleDateString()} (${daysLeft} days remaining)`)
        }
      }

      const trusted = await this.verifyCertificateTrust(hostname)
      if (trusted) {
        this.addFinding(s, "passed", "low", "Certificate Trusted",
          "Certificate chain is valid and trusted by a recognized CA")
      } else {
        this.addFinding(s, "failed", "critical", "Certificate Not Trusted",
          "Certificate is self-signed or issued by an untrusted CA — connection may be intercepted",
          "Use certificates from a trusted Certificate Authority like Let's Encrypt")
      }

      if (cert.subjectaltname) {
        const altNames = cert.subjectaltname.split(", ").map((n: string) => n.replace(/^DNS:/, ""))
        if (altNames.some((name: string) => name === hostname || name === `*.${hostname.split(".").slice(1).join(".")}`)) {
          this.addFinding(s, "passed", "low", "SAN Match",
            `Certificate covers ${hostname} and ${altNames.length - 1} other name(s)`)
        } else {
          this.addFinding(s, "failed", "critical", "Hostname Mismatch",
            `Certificate is valid for ${altNames.join(", ")} but NOT for ${hostname}`,
            "This indicates a Man-in-the-Middle attack or misconfiguration")
        }
      }

      if (cert.fingerprint) {
        this.addFinding(s, "passed", "low", "Certificate Fingerprint",
          `SHA-256: ${cert.fingerprint256 || cert.fingerprint}`)
      }

      if (cert.serialNumber) {
        this.addFinding(s, "info", "low", "Serial Number",
          `Serial: ${cert.serialNumber}`)
      }
    } catch (e: any) {
      this.addFinding(s, "failed", "high", "SSL/TLS Handshake Failed",
        `Could not establish TLS connection: ${e.message}`,
        "The server may not support TLS or the connection is being blocked")
    }

    s.score = this.calculateSectionScore(s)
  }

  private async analyzeContent(url: string, sections: Record<string, SectionResult>): Promise<void> {
    const s = sections.content

    try {
      const ssrCheck = await this.validateSsrTarget(url)
      if (!ssrCheck.safe) {
        this.addFinding(s, "failed", "high", "SSRF Blocked",
          `Content fetch prevented: ${ssrCheck.reason}`,
          "Use only public URLs for analysis")
        s.score = this.calculateSectionScore(s)
        return
      }

      let currentUrl = url
      let response: Response | null = null
      let hops = 0
      const maxHops = 5

      while (hops < maxHops) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const currentCheck = await this.validateSsrTarget(currentUrl)
        if (!currentCheck.safe) {
          clearTimeout(timeout)
          this.addFinding(s, "failed", "high", "SSRF Blocked",
            `Redirect to internal network prevented: ${currentCheck.reason}`,
            "Use only public URLs for analysis")
          s.score = this.calculateSectionScore(s)
          return
        }

        const res: Response = await fetch(currentUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          redirect: "manual",
        })
        clearTimeout(timeout)

        response = res
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          const loc = res.headers.get("location")!
          currentUrl = new URL(loc, currentUrl).toString()
          hops++
        } else {
          break
        }
      }

      if (!response) {
        throw new Error("No response received")
      }

      this.addFinding(s, "passed", "low", "Server Response",
        `HTTP ${response.status} ${response.statusText}`)

      const contentType = response.headers.get("content-type") || ""
      if (contentType.includes("text/html")) {
        this.addFinding(s, "passed", "low", "Content Type", "Returns HTML content")
      } else {
        this.addFinding(s, "warning", "low", "Non-HTML Content",
          `Content-Type is "${contentType}" — not a standard web page`)
      }

      if (response.status >= 400) {
        this.addFinding(s, "warning", "medium", "HTTP Error Status",
          `Server returned ${response.status} — may indicate a parked or misconfigured domain`)
      }

      const text = await response.text()
      const body = text.substring(0, 100000)
      const lowerBody = body.toLowerCase()

      this.addFinding(s, "info", "low", "Page Size",
        `Approximately ${(body.length / 1024).toFixed(1)} KB of content fetched`)

      const hasForms = /<form[\s>]/i.test(body)
      const hasPasswordInput = /<input[^>]*type=["']password["']/i.test(body)
      const hasLoginInput = /<input[^>]*(name|id)["']\s*=\s*["']?(login|username|email)["']?/i.test(body)

      if (hasPasswordInput && hasLoginInput) {
        this.addFinding(s, "warning", "medium", "Login Form Detected",
          "Page contains a login form — verify it submits to the legitimate domain",
          "Always check the URL before entering credentials")
      }

      if (hasForms) {
        const actionMatch = body.match(/<form[^>]*action\s*=\s*["']([^"']+)["']/i)
        if (actionMatch) {
          const action = actionMatch[1]
          try {
            const actionUrl = new URL(action, url)
            if (actionUrl.hostname !== new URL(url).hostname) {
              this.addFinding(s, "failed", "critical", "Form Submits to External Domain",
                `Form action points to "${actionUrl.hostname}" — credentials may be stolen`,
                "Login forms should submit to the same domain as the page")
            }
          } catch {}
        }
      }

      const hasIframe = /<iframe[\s>]/i.test(body)
      if (hasIframe) {
        const iframeSrc = body.match(/<iframe[^>]*src\s*=\s*["']([^"']+)["']/i)
        if (iframeSrc) {
          this.addFinding(s, "warning", "medium", "Iframe Detected",
            `Page embeds an iframe from "${iframeSrc[1]}" — may load external content`)
        } else {
          this.addFinding(s, "warning", "low", "Iframe Present",
            "Page contains iframes — verify the embedded content is trusted")
        }
      }

      const inlineScripts = (body.match(/<script[^>]*>/gi) || []).length
      const externalScripts = (body.match(/<script[^>]*src\s*=/gi) || []).length
      if (inlineScripts > 20 || externalScripts > 20) {
        this.addFinding(s, "warning", "medium", "Excessive Scripts",
          `${inlineScripts} inline and ${externalScripts} external scripts — high attack surface`,
          "Excessive JavaScript can be used for cryptomining or data exfiltration")
      }

      const obfuscatedPatterns = [
        /eval\s*\(\s*function/i,
        /atob\s*\(/i,
        /String\.fromCharCode/i,
        /escape\s*\(/i,
        /unescape\s*\(/i,
        /document\.write\s*\(/i,
        /\\x[0-9a-fA-F]{2}/i,
      ]
      const obfuscatedMatches = obfuscatedPatterns.filter(p => p.test(body))
      if (obfuscatedMatches.length >= 3) {
        this.addFinding(s, "warning", "high", "Obfuscated JavaScript",
          `Detected ${obfuscatedMatches.length} obfuscation techniques — may hide malicious code`,
          "JavaScript obfuscation is commonly used to evade detection")
      }

      const cryptoPatterns = /(coinbase|coinhive|cryptonight|miner\.start|miner\.stop|webmine)/i
      if (cryptoPatterns.test(body)) {
        this.addFinding(s, "failed", "high", "Cryptominer Detected",
          "Page contains cryptocurrency mining scripts — uses your CPU without consent")
      }

      const externalLinks = (body.match(/<a[^>]*href\s*=\s*["']https?:\/\//gi) || []).length
      if (externalLinks > 50) {
        this.addFinding(s, "warning", "low", "Excessive External Links",
          `${externalLinks} external links — may be a link farm or SEO spam`)
      }

      if (/\b(\d{4}[-\s]?){3}\d{4}\b/.test(body)) {
        this.addFinding(s, "warning", "high", "Credit Card Pattern Detected",
          "Page contains text matching credit card number patterns — may be phishing for financial data")
      }

      this.addFinding(s, "info", "low", "Page Title",
        `"${(body.match(/<title[^>]*>([^<]*)<\/title>/i) || ["", "Untitled"])[1].substring(0, 100)}"`)

      const ogTitle = body.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
      const ogDesc = body.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
      const ogImage = body.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i)
      if (ogTitle || ogDesc) {
        this.addFinding(s, "passed", "low", "Open Graph Tags",
          `og:title="${(ogTitle?.[1] || "").substring(0, 60)}" — social media preview is configured`)
      } else {
        this.addFinding(s, "warning", "low", "Missing Open Graph Tags",
          "No og:title or og:description — social media previews may be suboptimal",
          "Add Open Graph meta tags to control how links appear on social media")
      }

      if (ogImage) {
        this.addFinding(s, "passed", "low", "OG Image",
          `Social preview image: ${(ogImage[1] || "").substring(0, 80)}`)
      }

      const twitterCard = body.match(/<meta[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["']/i)
      if (twitterCard) {
        this.addFinding(s, "passed", "low", "Twitter Card",
          `Twitter card type: ${twitterCard[1]}`)
      }

      const techDetections: string[] = []

      if (body.includes("wp-content") || body.includes("wp-json") || /\/wp-admin/i.test(body)) {
        techDetections.push("WordPress")
      }
      if (body.includes("drupal.js") || body.includes("Drupal.settings")) {
        techDetections.push("Drupal")
      }
      if (body.includes("Joomla!") || body.includes("joomla.")) {
        techDetections.push("Joomla")
      }
      if (body.includes("shopify") || body.includes("Shopify") || body.includes("myshopify.com")) {
        techDetections.push("Shopify")
      }
      if (/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']*)/i.test(body)) {
        const genMatch = body.match(/<meta[^>]*name=["']generator["'][^>]*content=["']([^"']*)/i)
        if (genMatch && !techDetections.some(t => genMatch[1].toLowerCase().includes(t.toLowerCase()))) {
          techDetections.push(genMatch[1].trim())
        }
      }
      if (/\.squarespace\.com/i.test(body) || body.includes("squarespace")) {
        techDetections.push("Squarespace")
      }
      if (body.includes("wix-brand") || body.includes("Wix") && body.includes("wix")) {
        techDetections.push("Wix")
      }
      if (body.includes("next-route-announcer") || body.includes("__NEXT_DATA__")) {
        techDetections.push("Next.js")
      }
      if (body.includes("react-root") || body.includes("__REACT_DEVTOOLS") || /data-reactroot/i.test(body)) {
        techDetections.push("React")
      }
      if (body.includes("vue-app") || body.includes("__VUE_DEVTOOLS")) {
        techDetections.push("Vue.js")
      }
      if (body.includes("ng-version") || body.includes("angular")) {
        techDetections.push("Angular")
      }
      if (body.includes("cloudflare") && body.includes("__cf_bm")) {
        techDetections.push("Cloudflare")
      }
      if (/google-analytics|gtag|ga\('/i.test(body)) {
        techDetections.push("Google Analytics")
      }
      if (body.includes("facebook") && /fbq|pixel/i.test(body)) {
        techDetections.push("Facebook Pixel")
      }

      if (techDetections.length > 0) {
        this.addFinding(s, "passed", "low", "Technology Stack",
          `Detected: ${[...new Set(techDetections)].join(", ")}`)
      } else {
        this.addFinding(s, "info", "low", "Technology Stack",
          "No specific CMS or framework patterns detected")
      }

      const socialLinks = new Set<string>()
      const socialPatterns: Record<string, RegExp> = {
        Facebook: /facebook\.com\/([a-zA-Z0-9.]+)/gi,
        Twitter: /twitter\.com\/([a-zA-Z0-9_]+)/gi,
        Instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/gi,
        LinkedIn: /linkedin\.com\/(company|in)\/[a-zA-Z0-9-]+/gi,
        YouTube: /youtube\.com\/(@?[a-zA-Z0-9_-]+|channel\/[a-zA-Z0-9_-]+)/gi,
        GitHub: /github\.com\/([a-zA-Z0-9_-]+)/gi,
      }
      for (const [platform, pattern] of Object.entries(socialPatterns)) {
        const matches = body.match(pattern)
        if (matches && matches.length > 0) {
          socialLinks.add(platform)
        }
      }
      if (socialLinks.size > 0) {
        this.addFinding(s, "passed", "low", "Social Media Presence",
          `Linked profiles: ${[...socialLinks].join(", ")}`)
      }

    } catch (e: any) {
      if (e.name === "AbortError") {
        this.addFinding(s, "warning", "medium", "Request Timeout",
          "Content fetch timed out after 8 seconds — server may be slow or unresponsive")
      } else {
        this.addFinding(s, "warning", "medium", "Content Fetch Failed",
          `Could not retrieve page content: ${e.message}`)
      }
    }

    s.score = this.calculateSectionScore(s)
  }

  private async analyzeHeaders(url: string, sections: Record<string, SectionResult>): Promise<void> {
    const s = sections.headers

    try {
      const ssrCheck = await this.validateSsrTarget(url)
      if (!ssrCheck.safe) {
        this.addFinding(s, "info", "low", "Header Scan Skipped",
          `Header analysis blocked: ${ssrCheck.reason}`)
        s.score = this.calculateSectionScore(s)
        return
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      })
      clearTimeout(timeout)

      const server = response.headers.get("server")
      if (server) {
        this.addFinding(s, "info", "low", "Server Software",
          `Server: ${server}`)
      }

      const poweredBy = response.headers.get("x-powered-by")
      if (poweredBy) {
        this.addFinding(s, "info", "low", "Technology Stack",
          `Powered by: ${poweredBy}`)
      }

      for (const [header, config] of Object.entries(SECURITY_HEADERS_BEST_PRACTICES)) {
        const value = response.headers.get(header)
        if (value) {
          this.addFinding(s, "passed", "low", config.desc,
            `Present: ${value.substring(0, 80)}${value.length > 80 ? "..." : ""}`)
        } else {
          this.addFinding(s, "warning", config.severity, `Missing: ${config.desc}`,
            `${config.desc} header is not set`,
            `Add "${header}: ${config.recommended}" to your server configuration`)
        }
      }

      const setCookie = response.headers.get("set-cookie")
      if (setCookie) {
        if (!setCookie.includes("HttpOnly")) {
          this.addFinding(s, "warning", "medium", "Cookie Without HttpOnly",
            "Cookies missing HttpOnly flag — accessible via JavaScript (XSS risk)")
        }
        if (!setCookie.includes("Secure")) {
          this.addFinding(s, "warning", "high", "Cookie Without Secure Flag",
            "Cookies missing Secure flag — can be sent over unencrypted connections")
        }
        if (!setCookie.includes("SameSite")) {
          this.addFinding(s, "warning", "medium", "Cookie Without SameSite",
            "Cookies missing SameSite attribute — vulnerable to CSRF attacks")
        }
      }

      const hsts = response.headers.get("strict-transport-security")
      if (hsts) {
        const maxAge = parseInt(hsts.match(/max-age=(\d+)/)?.[1] || "0")
        const includesSub = hsts.includes("includeSubDomains")
        const preload = hsts.includes("preload")
        if (maxAge >= 31536000 && includesSub && preload) {
          this.addFinding(s, "passed", "low", "HSTS Preload Ready",
            "HSTS header includes preload directive + includeSubDomains — eligible for browser preload list")
        } else if (maxAge >= 31536000) {
          this.addFinding(s, "passed", "low", "HSTS Good Duration",
            `HSTS max-age=${maxAge}s (~${Math.round(maxAge / 86400)} days) — adequate`)
          if (!includesSub) {
            this.addFinding(s, "warning", "medium", "HSTS Missing includeSubDomains",
              "HSTS does not cover subdomains — add includeSubDomains for full protection")
          }
        } else {
          this.addFinding(s, "warning", "medium", "HSTS Short Duration",
            `HSTS max-age=${maxAge}s — too short for effective protection`,
            "Set max-age to at least 31536000 (1 year)")
        }
      }

    } catch (e: any) {
      this.addFinding(s, "warning", "low", "Header Fetch Failed",
        `Could not retrieve headers: ${e.message}`)
    }

    s.score = this.calculateSectionScore(s)
  }

  private async analyzeReputation(url: string, hostname: string, sections: Record<string, SectionResult>): Promise<void> {
    const s = sections.reputation

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const wmResponse = await fetch(
        `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
        { signal: controller.signal }
      )
      clearTimeout(timeout)

      const wmData = await wmResponse.json()
      const snapshots = wmData?.archived_snapshots?.closest
      if (snapshots && snapshots.available) {
        const firstSeen = new Date(snapshots.timestamp)
        const daysAgo = Math.round((Date.now() - firstSeen.getTime()) / 86400000)
        const years = Math.floor(daysAgo / 365)
        if (years < 1) {
          this.addFinding(s, "warning", "high", "Very New Domain",
            `First archived ${daysAgo} day(s) ago — newly registered domains are higher risk`,
            "Recently created domains are disproportionately used for malicious purposes")
        } else if (years < 3) {
          this.addFinding(s, "warning", "medium", "Relatively New Domain",
            `First archived ~${years} year(s) ago — moderate domain age`)
        } else {
          this.addFinding(s, "passed", "low", "Established Domain",
            `First archived ~${years} year(s) ago — domain has a long history`)
        }
        this.addFinding(s, "passed", "low", "Wayback Machine",
          `Snapshots exist — domain has historical records`)
      } else {
        this.addFinding(s, "warning", "high", "No Archived History",
          "No Wayback Machine snapshots found — domain may be very new or rarely indexed",
          "Legitimate websites are typically crawled by the Wayback Machine")
      }
    } catch {
      this.addFinding(s, "info", "low", "Wayback Machine Unavailable",
        "Could not check domain history — archive.org may be unreachable")
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const usHeaders: Record<string, string> = { "User-Agent": "StegShield-UrlChecker/1.0" }
      if (this.urlscanApiKey) usHeaders["API-Key"] = this.urlscanApiKey
      const usResponse = await fetch(
        `https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(hostname)}&size=1`,
        { signal: controller.signal, headers: usHeaders }
      )
      clearTimeout(timeout)
      if (usResponse.ok) {
        const usData = await usResponse.json()
        const total = usData?.total || 0
        if (total > 0) {
          const malicious = usData.results?.filter((r: any) =>
            r.task?.malicious || r.page?.domain === hostname && r.score && r.score > 50
          ).length || 0
          if (malicious > 0) {
            this.addFinding(s, "failed", "critical", "URLScan.io Threat Found",
              `${malicious} malicious scan(s) reported on urlscan.io`,
              "Check the full urlscan.io report for detailed threat analysis")
          } else {
            this.addFinding(s, "passed", "low", "URLScan.io History",
              `${total} scan(s) found on urlscan.io — no malicious reports detected`)
          }
        } else {
          this.addFinding(s, "info", "low", "URLScan.io",
            "No existing scans on urlscan.io — submit one for deeper analysis")
        }
      }
    } catch {
      this.addFinding(s, "info", "low", "URLScan.io Unavailable",
        "Could not query urlscan.io — may be rate-limited")
    }

    try {
      const secUrl = `https://${hostname}/.well-known/security.txt`
      const secSsr = await this.validateSsrTarget(secUrl)
      if (!secSsr.safe) {
        this.addFinding(s, "info", "low", "Security.txt", "SSRF protection blocked security.txt scan")
        s.score = this.calculateSectionScore(s)
        return
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const secResponse = await fetch(secUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; UrlChecker/1.0)" },
      })
      clearTimeout(timeout)
      if (secResponse.ok) {
        const secText = await secResponse.text()
        const contact = secText.match(/^Contact:\s*(.+)$/im)
        if (contact) {
          this.addFinding(s, "passed", "low", "Security.txt Policy",
            `Security disclosure policy found — contact: ${contact[1].substring(0, 80)}`)
        } else {
          this.addFinding(s, "passed", "low", "Security.txt Found",
            "Security.txt exists — good security practice")
        }
      }
    } catch {
      this.addFinding(s, "info", "low", "Security.txt",
        "No security.txt policy found — consider adding one")
    }

    s.score = this.calculateSectionScore(s)
  }

  private async followRedirects(url: string, maxRedirects = 10): Promise<{ chain: string[]; finalUrl: string }> {
    const chain: string[] = [url]
    let currentUrl = url

    for (let i = 0; i < maxRedirects; i++) {
      const ssrCheck = await this.validateSsrTarget(currentUrl)
      if (!ssrCheck.safe) break

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(currentUrl, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; UrlChecker/1.0)" },
      })
      clearTimeout(timeout)

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) break
        currentUrl = new URL(location, currentUrl).href
        chain.push(currentUrl)
      } else {
        break
      }
    }

    return { chain, finalUrl: currentUrl }
  }

  private getCertificate(hostname: string): Promise<any> {
    return new Promise((resolve, reject) => {
      let settled = false
      const socket = tls.connect(443, hostname, {
        servername: hostname,
        rejectUnauthorized: false,
        timeout: 8000,
      }, () => {
        if (settled) return
        settled = true
        const cert = socket.getPeerCertificate()
        socket.end()
        if (cert && Object.keys(cert).length > 0) {
          resolve(cert)
        } else {
          reject(new Error("No certificate returned"))
        }
      })
      socket.on("error", (err) => { if (settled) return; settled = true; socket.destroy(); reject(err) })
      socket.on("timeout", () => { if (settled) return; settled = true; socket.destroy(); reject(new Error("TLS connection timed out")) })
    })
  }

  private verifyCertificateTrust(hostname: string): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false
      const socket = tls.connect(443, hostname, {
        servername: hostname,
        rejectUnauthorized: true,
        timeout: 5000,
      }, () => {
        if (settled) return
        settled = true
        socket.end()
        resolve(true)
      })
      socket.on("error", () => { if (settled) return; settled = true; socket.destroy(); resolve(false) })
      socket.on("timeout", () => { if (settled) return; settled = true; socket.destroy(); resolve(false) })
    })
  }

  private checkTyposquatting(name: string, s: SectionResult): void {
    for (const brand of BRAND_NAMES) {
      const dist = this.levenshtein(name.toLowerCase(), brand)
      if (dist > 0 && dist <= 2 && name.toLowerCase() !== brand) {
        this.addFinding(s, "failed", "critical", "Typosquatting Detected",
          `"${name}" closely resembles "${brand}" (edit distance: ${dist}) — likely impersonation`,
          `The genuine ${brand} website uses a different domain — verify before interacting`)
        return
      }
    }
  }

  private async resolveHostname(hostname: string): Promise<string[]> {
    const ips: string[] = []
    try { ips.push(...(await dnsResolve4(hostname))) } catch {}
    try { ips.push(...(await dnsResolve6(hostname))) } catch {}
    return ips
  }

  private isPrivateIpv6(ip: string): boolean {
    const lower = ip.toLowerCase()
    return lower.startsWith("fc") || lower.startsWith("fd") || lower === "::1" || lower === "127.0.0.1" || lower.startsWith("fe80")
  }

  private isPrivateIp(ip: string): boolean {
    if (ip.includes(":")) return this.isPrivateIpv6(ip)
    const parts = ip.split(".").map(Number)
    if (parts.length !== 4) return false
    for (const range of MALICIOUS_IP_RANGES) {
      const startParts = range.start.split(".").map(Number)
      const endParts = range.end.split(".").map(Number)
      let match = true
      for (let i = 0; i < 4; i++) {
        if (parts[i] < startParts[i] || parts[i] > endParts[i]) { match = false; break }
      }
      if (match) return true
    }
    return false
  }

  private async validateSsrTarget(urlString: string): Promise<{ safe: boolean; reason?: string }> {
    try {
      const parsed = new URL(urlString)
      if (parsed.protocol === "data:" || parsed.protocol === "javascript:") {
        return { safe: false, reason: "URL uses disallowed protocol" }
      }
      const ips = await this.resolveHostname(parsed.hostname)
      for (const ip of ips) {
        if (this.isPrivateIp(ip)) {
          return { safe: false, reason: `Resolves to private IP ${ip}` }
        }
      }
      return { safe: true }
    } catch {
      return { safe: true }
    }
  }

  private addFinding(s: SectionResult, type: Finding["type"], severity: Finding["severity"], category: string, detail: string, recommendation?: string): void {
    s.findings.push({ type, severity, category, detail, recommendation })
  }

  private calculateSectionScore(s: SectionResult): number {
    let score = s.maxScore
    for (const f of s.findings) {
      if (f.type === "failed") {
        const penalty = f.severity === "critical" ? 35 : f.severity === "high" ? 25 : f.severity === "medium" ? 15 : 10
        score -= penalty
      } else if (f.type === "warning") {
        const penalty = f.severity === "high" ? 15 : f.severity === "medium" ? 10 : 5
        score -= penalty
      }
    }
    return Math.max(0, score)
  }

  private getRiskLevel(score: number): UrlCheckResult["riskLevel"] {
    if (score <= 5) return "safe"
    if (score <= 20) return "low"
    if (score <= 45) return "medium"
    if (score <= 70) return "high"
    return "critical"
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
    return dp[m][n]
  }
}
