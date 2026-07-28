"use client"

import { useMemo, useState } from "react"
import { Check, Copy } from "lucide-react"

interface MarkdownProps {
  content: string
}

function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border border-border">
      {language && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{language}</span>
          <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>
      )}
      <pre className="p-3 overflow-x-auto bg-muted/20 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function Markdown({ content }: MarkdownProps) {
  const html = useMemo(() => renderMarkdown(content), [content])

  return (
    <div
      className="prose prose-sm max-w-none prose-invert
        prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
        prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-1.5
        prose-strong:text-foreground prose-strong:font-semibold
        prose-code:text-cyber-400 prose-code:bg-muted/30 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-pre:hidden
        prose-ul:my-1.5 prose-li:text-muted-foreground prose-li:my-0.5
        prose-a:text-cyber-400 prose-a:no-underline hover:prose-a:underline"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function sanitizeUrl(url: string): string {
  const lower = url.trim().toLowerCase()
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return "#"
  }
  return url
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text)

  // Code blocks (fenced) — must be done before inline code
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang || "text"
    const displayLang = ["text", "plain"].includes(language) ? "" : language
    return `<div class="relative group my-2 rounded-lg overflow-hidden border border-border"><div class="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border"><span class="text-[10px] text-muted-foreground uppercase tracking-wider">${escapeHtml(displayLang)}</span></div><pre class="p-3 overflow-x-auto bg-muted/20 text-xs leading-relaxed"><code>${escapeHtml(code)}</code></pre></div>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-muted/30 px-1 py-0.5 rounded text-xs text-cyber-400">$1</code>')

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")

  // Italic
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>")

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>")
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc list-inside my-1.5 space-y-0.5">$&</ul>')

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>")

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    return `<a href="${sanitizeUrl(url)}" class="text-cyber-400 no-underline hover:underline" target="_blank" rel="noopener">${text}</a>`
  })

  // Line breaks (double newline = paragraph)
  const paragraphs = html.split("\n\n")
  html = paragraphs
    .map((p) => {
      const trimmed = p.trim()
      if (!trimmed) return ""
      if (trimmed.startsWith("<ul") || trimmed.startsWith("<div") || trimmed.startsWith("<pre")) return trimmed
      return `<p class="text-muted-foreground leading-relaxed my-1.5">${trimmed}</p>`
    })
    .join("\n")

  // Single line breaks within paragraphs
  html = html.replace(/\n(?!\s*<(?:ul|div|pre|li))/g, "<br/>")

  return html
}
