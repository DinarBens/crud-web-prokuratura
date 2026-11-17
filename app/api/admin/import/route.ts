import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { importState, mediaSourceConfigured, sourceConfigured, startImport } from "@/lib/importer"
import { bucketConfigured } from "@/lib/media"

// Статус импорта из qoz-vision
export async function GET(request: Request) {
  const session = await getSession(request)
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "Только для администратора" }, { status: 403 })
  const [journal, live, cameras, facilities, withMedia, mediaPending] = await Promise.all([
    db.alarmEvent.count({ where: { source: "journal" } }),
    db.alarmEvent.count({ where: { source: "live" } }),
    db.camera.count({ where: { externalId: { not: null } } }),
    db.facility.count({ where: { externalKey: { not: null } } }),
    db.alarmEvent.count({ where: { mediaKey: { not: null } } }),
    db.alarmEvent.count({ where: { sourceMediaPath: { not: null }, mediaKey: null } }),
  ])
  return NextResponse.json({
    state: importState,
    sourceConfigured: sourceConfigured(),
    mediaSourceConfigured: mediaSourceConfigured(),
    bucketConfigured: bucketConfigured(),
    inDb: { journal, live, cameras, facilities, withMedia, mediaPending },
  })
}

// Запустить импорт (только администратор). body: { media?: boolean }
export async function POST(request: Request) {
  const session = await getSession(request)
  if (session?.role !== "ADMIN") {
    return NextResponse.json({ error: "Запускать импорт может только администратор" }, { status: 403 })
  }
  if (!sourceConfigured()) {
    return NextResponse.json({ error: "Не задана переменная SOURCE_DATABASE_URL" }, { status: 400 })
  }
  const body = await request.json().catch(() => ({}))
  const started = startImport({ media: body?.media !== false })
  return NextResponse.json({ started, state: importState }, { status: started ? 202 : 409 })
}
