import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, isHashed, verifyPassword } from "@/lib/password"
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json({ error: "Введите email и пароль" }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })

    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 })
    }

    // Перехэшировать пароль, сохранённый открытым текстом
    if (!isHashed(user.password)) {
      await db.user.update({ where: { id: user.id }, data: { password: hashPassword(password) } })
    }

    const response = NextResponse.json({
      success: true,
      user: { email: user.email, name: user.name, role: user.role },
    })

    response.cookies.set(SESSION_COOKIE, await createSessionToken(user.id, user.role), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Login API error:", error)
    return NextResponse.json({ error: "Произошла внутренняя ошибка сервера" }, { status: 500 })
  }
}
