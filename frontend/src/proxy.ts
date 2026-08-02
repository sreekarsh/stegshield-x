import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/mfa", "/auth/callback", "/invitations", "/share"]

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return NextResponse.redirect(new URL("/home", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
