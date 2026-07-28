"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShareResultDialog } from "@/components/sharing/share-result-dialog"

/**
 * Demo/Test page for ShareResultDialog
 * Access at: /demo/share-dialog
 * 
 * Use this to test different scenarios without creating actual shares
 */
export default function ShareDialogDemoPage() {
  const [scenario, setScenario] = useState<string | null>(null)

  const scenarios = {
    basic: {
      shareUrl: "https://stegshield.example.com/share/abc123xyz",
      fileName: "financial-report.pdf",
      fileSize: 2_450_000, // 2.45 MB
      hasPassword: false,
      maxDownloads: null,
      expiresAt: null,
    },
    password: {
      shareUrl: "https://stegshield.example.com/share/def456uvw",
      fileName: "confidential-contract.docx",
      fileSize: 156_000, // 156 KB
      hasPassword: true,
      maxDownloads: 5,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h from now
    },
    largeFile: {
      shareUrl: "https://stegshield.example.com/share/ghi789rst",
      fileName: "presentation-video-4k.mp4",
      fileSize: 450_000_000, // 450 MB
      hasPassword: true,
      maxDownloads: 3,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    },
    shortExpiry: {
      shareUrl: "https://stegshield.example.com/share/jkl012mno",
      fileName: "quick-note.txt",
      fileSize: 1_200, // 1.2 KB
      hasPassword: false,
      maxDownloads: 1,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
    },
    image: {
      shareUrl: "https://stegshield.example.com/share/pqr345stu",
      fileName: "screenshot-2026-07-27.png",
      fileSize: 3_800_000, // 3.8 MB
      hasPassword: true,
      maxDownloads: 10,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2h
    },
  }

  return (
    <div className="container max-w-4xl mx-auto py-12 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">ShareResultDialog Demo</h1>
        <p className="text-muted-foreground">
          Test different scenarios to see how the share dialog looks and behaves
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        
        {/* Basic Share */}
        <Card className="cursor-pointer hover:border-cyber-500/50 transition-colors" onClick={() => setScenario("basic")}>
          <CardHeader>
            <CardTitle>Basic Share</CardTitle>
            <CardDescription>No password, no limits, no expiry</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• PDF file (2.45 MB)</li>
              <li>• No password protection</li>
              <li>• Unlimited downloads</li>
              <li>• Never expires</li>
            </ul>
          </CardContent>
        </Card>

        {/* Password Protected */}
        <Card className="cursor-pointer hover:border-cyber-500/50 transition-colors" onClick={() => setScenario("password")}>
          <CardHeader>
            <CardTitle>Password Protected</CardTitle>
            <CardDescription>Secure share with all restrictions</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Word document (156 KB)</li>
              <li>• 🔒 Password protected</li>
              <li>• 5 downloads max</li>
              <li>• Expires in 24 hours</li>
            </ul>
          </CardContent>
        </Card>

        {/* Large File */}
        <Card className="cursor-pointer hover:border-cyber-500/50 transition-colors" onClick={() => setScenario("largeFile")}>
          <CardHeader>
            <CardTitle>Large File</CardTitle>
            <CardDescription>Test with 450MB video file</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Video file (450 MB)</li>
              <li>• 🔒 Password protected</li>
              <li>• 3 downloads max</li>
              <li>• Expires in 7 days</li>
            </ul>
          </CardContent>
        </Card>

        {/* Short Expiry */}
        <Card className="cursor-pointer hover:border-cyber-500/50 transition-colors" onClick={() => setScenario("shortExpiry")}>
          <CardHeader>
            <CardTitle>Short Expiry</CardTitle>
            <CardDescription>Quick one-time share</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• Text file (1.2 KB)</li>
              <li>• No password</li>
              <li>• 1 download only</li>
              <li>• Expires in 30 minutes</li>
            </ul>
          </CardContent>
        </Card>

        {/* Image Share */}
        <Card className="cursor-pointer hover:border-cyber-500/50 transition-colors" onClick={() => setScenario("image")}>
          <CardHeader>
            <CardTitle>Image Share</CardTitle>
            <CardDescription>Screenshot with moderate limits</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• PNG image (3.8 MB)</li>
              <li>• 🔒 Password protected</li>
              <li>• 10 downloads max</li>
              <li>• Expires in 2 hours</li>
            </ul>
          </CardContent>
        </Card>

        {/* Custom Test */}
        <Card className="cursor-pointer hover:border-cyan-500/50 transition-colors bg-cyan-500/5" onClick={() => {
          // Allow custom testing
          alert("Open browser devtools and use:\nwindow.testShareDialog({ shareUrl: '...', ... })")
        }}>
          <CardHeader>
            <CardTitle>Custom Test</CardTitle>
            <CardDescription>Use browser console to test custom values</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground font-mono">
              window.testShareDialog(&#123; ... &#125;)
            </p>
          </CardContent>
        </Card>

      </div>

      {/* Info */}
      <Card className="bg-muted/20">
        <CardContent className="pt-6">
          <div className="text-sm space-y-2">
            <p className="font-semibold">Instructions:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>1. Click any scenario card above</li>
              <li>2. The ShareResultDialog will open with that configuration</li>
              <li>3. Test all the features: copy, share, download QR</li>
              <li>4. Try on mobile (responsive design)</li>
              <li>5. Check QR codes scan correctly with your phone</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* The Dialog */}
      {scenario && scenarios[scenario as keyof typeof scenarios] && (
        <ShareResultDialog
          open={!!scenario}
          onClose={() => setScenario(null)}
          {...scenarios[scenario as keyof typeof scenarios]}
        />
      )}

      {/* DevTools helper */}
      <script dangerouslySetInnerHTML={{
        __html: `
          window.testShareDialog = function(config) {
            // This would need React ref to work properly
            console.log('Custom test config:', config);
            alert('This feature requires updating the demo page code');
          }
        `
      }} />
    </div>
  )
}
