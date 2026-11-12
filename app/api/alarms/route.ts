import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { incidentWhere } from "@/lib/scope"

// Журнал тревог (совместим со старыми страницами: query, type, date) + новые фильтры sector, district, status
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const { searchParams } = new URL(request.url)
    if (!searchParams.get("days") && !searchParams.get("date") && !searchParams.get("from")) {
      searchParams.set("days", "30")
    }

    const events = await db.alarmEvent.findMany({
      where: incidentWhere(session, searchParams),
      include: { facility: { select: { id: true, name: true, sector: true, district: true } } },
      orderBy: { timestamp: "desc" },
      take: 1000,
    })

    return NextResponse.json(events)
  } catch (error) {
    console.error("GET alarms error:", error)
    return NextResponse.json({ error: "Не удалось получить список тревог" }, { status: 500 })
  }
}
