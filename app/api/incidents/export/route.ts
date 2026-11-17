import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { incidentWhere } from "@/lib/scope"
import { STATUS_META, SECTOR_META, SEVERITY_META, isIncidentStatus, type Sector, type Severity } from "@/lib/sectors"
import { SOURCE_META, describeCategory } from "@/lib/categories"

// Выгрузка инцидентов в CSV для Excel (UTF-8 с BOM, разделитель «;»)
export async function GET(request: Request) {
  const session = await getSession(request)
  if (!session) return new Response("Требуется вход", { status: 401 })
  const { searchParams } = new URL(request.url)
  const where = incidentWhere(session, searchParams)
  const rows = await db.alarmEvent.findMany({
    where,
    include: { facility: { select: { name: true, sector: true, region: true, city: true, district: true } } },
    orderBy: { timestamp: "desc" },
    take: 20000,
  })

  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v)
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const header = ["Дата и время", "Область", "Город", "Район", "Объект", "Сфера", "Камера", "Событие", "Категория", "Важность", "Статус", "Источник", "Уверенность ИИ", "Описание", "Передано"]
  const lines = [header.join(";")]
  for (const r of rows) {
    const status = isIncidentStatus(r.status) ? STATUS_META[r.status].label : r.status
    lines.push(
      [
        new Date(r.timestamp).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" }),
        r.facility?.region,
        r.facility?.city,
        r.facility?.district,
        r.facility?.name,
        r.facility ? SECTOR_META[r.facility.sector as Sector]?.label ?? r.facility.sector : "",
        r.cameraName,
        r.title || r.type,
        r.category ? describeCategory(r.category).label : "",
        SEVERITY_META[r.severity as Severity]?.label ?? r.severity,
        status,
        SOURCE_META[r.source] ?? r.source,
        r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "",
        r.details,
        r.forwardedTo,
      ]
        .map(esc)
        .join(";")
    )
  }
  const body = "﻿" + lines.join("\r\n")
  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="incidents-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
