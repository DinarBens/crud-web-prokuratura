import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { clearDemo, loadDemo } from "@/lib/demo-data"

// Демонстрационные данные: загрузка (POST), удаление (DELETE), сколько есть (GET).
// Затрагиваются только записи с isDemo = true.

async function requireAdmin(request: Request) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 })
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Управлять демо-данными может только администратор" }, { status: 403 })
  }
  return null
}

export async function GET() {
  const [facilities, cameras, incidents] = await Promise.all([
    db.facility.count({ where: { isDemo: true } }),
    db.camera.count({ where: { isDemo: true } }),
    db.alarmEvent.count({ where: { isDemo: true } }),
  ])
  return NextResponse.json({ facilities, cameras, incidents })
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied
  try {
    const result = await loadDemo(db)
    return NextResponse.json({ loaded: true, ...result })
  } catch (error) {
    console.error("Demo load error:", error)
    return NextResponse.json({ error: "Не удалось загрузить демо-данные" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request)
  if (denied) return denied
  try {
    return NextResponse.json({ removed: true, ...(await clearDemo(db)) })
  } catch (error) {
    console.error("Demo clear error:", error)
    return NextResponse.json({ error: "Не удалось удалить демо-данные" }, { status: 500 })
  }
}
