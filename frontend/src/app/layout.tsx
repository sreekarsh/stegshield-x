import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

export const metadata: Metadata = {
  title: "StegShield X - AI-Powered Zero-Trust Security Platform",
  description:
    "Enterprise-grade cybersecurity platform combining cryptography, steganography, AI forensics, and zero-trust architecture.",
  keywords: [
    "cybersecurity",
    "steganography",
    "encryption",
    "digital forensics",
    "AI security",
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
