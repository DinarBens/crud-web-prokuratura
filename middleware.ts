import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)

  const isLoginPage = pathname === "/login"
  const isAuthApi = pathname.startsWith("/api/auth")
  const isApi = pathname.startsWith("/api/")

  if (!session && !isLoginPage && !isAuthApi) {
    // API отвечает 401, а не редиректом — чтобы fetch не получал HTML страницы входа
    if (isApi) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL("/login", request.url))
    response.cookies.delete(SESSION_COOKIE)
    return response
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

// Все маршруты, кроме статики. Старое исключение `pathname.includes(".")` убрано —
// оно пропускало без проверки любой путь с точкой.
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|data/|login_bg_pattern.png|placeholder.svg).*)"],
}
