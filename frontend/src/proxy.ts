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

  const token = request.cookies.get("access_token")?.value

  if (publicRoutes.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return NextResponse.next()
  }

  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return NextResponse.redirect(new URL("/home", request.url))
  }

  if (!token) {
    const loginUrl = new URL("/login", request.url)
    const redirectTarget = (pathname === "/dashboard" || pathname === "/login" || pathname === "/register") ? "/home" : pathname
    loginUrl.searchParams.set("redirect", redirectTarget)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith("/admin-panel") || pathname.startsWith("/admin")) {
    const userRole = request.cookies.get("user_role")?.value || ""
    if (userRole !== "ADMIN" && userRole !== "OWNER") {
      return NextResponse.redirect(new URL("/home", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
