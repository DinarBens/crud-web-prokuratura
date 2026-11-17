import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

// Текущий пользователь — для меню (имя, роль)
export async function GET(request: Request) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ user: null }, { status: 401 })
  const user = await db.user.findUnique({ where: { id: session.uid }, select: { email: true, name: true, role: true } })
  return NextResponse.json({ user })
}
