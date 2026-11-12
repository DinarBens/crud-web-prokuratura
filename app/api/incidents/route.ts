import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { incidentWhere } from "@/lib/scope"

export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Number(searchParams.get("limit")) || 200, 1000)

    const where = incidentWhere(session, searchParams)
    const [items, total] = await Promise.all([
      db.alarmEvent.findMany({
        where,
        include: {
          facility: { select: { id: true, name: true, sector: true, district: true, address: true } },
          camera: { select: { id: true, name: true, streamUrl: true } },
        },
        orderBy: [{ timestamp: "desc" }],
        take: limit,
      }),
      db.alarmEvent.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (error) {
    console.error("GET incidents error:", error)
    return NextResponse.json({ error: "Не удалось получить инциденты" }, { status: 500 })
  }
}
