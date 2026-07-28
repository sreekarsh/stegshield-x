import Link from "next/link"
import { Shield } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyber-500/5 p-4">
      <div className="text-center max-w-md">
        <Shield className="h-16 w-16 text-cyber-500 mx-auto mb-6" />
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-xl text-muted-foreground mb-6">Page not found</p>
        <Link href="/">
          <Button variant="cyber">Go home</Button>
        </Link>
      </div>
    </div>
  )
}
