import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { sectorsForRole } from "@/lib/roles"
import { bucketConfigured, signedMediaUrl } from "@/lib/media"
import { isSector } from "@/lib/sectors"

// Видео или кадр инцидента: проверка доступа → временная ссылка на файл в хранилище
export async function GET(request: Request) {
  const session = await getSession(request)
  const id = new URL(request.url).searchParams.get("incident")
  if (!session || !id) return NextResponse.json({ error: "Нет доступа" }, { status: 401 })
  const incident = await db.alarmEvent.findUnique({
    where: { id },
    select: { mediaKey: true, facility: { select: { sector: true } } },
  })
  const sector = incident?.facility?.sector
  if (!incident?.mediaKey || (isSector(sector) && !sectorsForRole(session.role).includes(sector))) {
    return NextResponse.json({ error: "Файл не найден" }, { status: 404 })
  }
  if (!bucketConfigured()) return NextResponse.json({ error: "Хранилище не настроено" }, { status: 503 })
  return NextResponse.redirect(await signedMediaUrl(incident.mediaKey), 302)
}
