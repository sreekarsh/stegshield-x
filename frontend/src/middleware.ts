import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/mfa", "/auth/callback", "/invitations", "/share", "/proxy"]
const authApiRoutes = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/forgot-password", "/api/auth/reset-password"]

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get("access_token")?.value

  if (publicRoutes.some((r) => pathname === r || pathname.startsWith(r + "/")) || authApiRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
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

  // RBAC Enforcement for Admin Routes
  if (pathname.startsWith("/admin-panel") || pathname.startsWith("/admin")) {
    const userRole = request.cookies.get("user_role")?.value || ""
    if (userRole !== "ADMIN" && userRole !== "OWNER") {
      return NextResponse.redirect(new URL("/home", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|proxy|_next/static|_next/image|favicon.ico).*)"],
}
