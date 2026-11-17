import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { allowedSectors } from "@/lib/scope"
import { OPEN_STATUSES } from "@/lib/sectors"
import { CITIES, cityByName } from "@/lib/locations"

// Дерево «область → город → объекты» с показателями — для обзора и фильтров
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const sp = new URL(request.url).searchParams
    const days = Math.min(Math.max(Number(sp.get("days")) || 30, 1), 365)
    const since = new Date(Date.now() - days * 86400_000)
    const sectors = allowedSectors(session, null)

    const facilities = await db.facility.findMany({
      where: { sector: { in: sectors }, isDemo: false },
      select: {
        id: true,
        name: true,
        sector: true,
        region: true,
        city: true,
        district: true,
        cameras: { select: { status: true } },
      },
      orderBy: { name: "asc" },
    })
    const ids = facilities.map((f) => f.id)
    const [periodCounts, openCounts, criticalCounts] = await Promise.all([
      db.alarmEvent.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids }, timestamp: { gte: since } }, _count: { _all: true } }),
      db.alarmEvent.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids }, status: { in: [...OPEN_STATUSES] } }, _count: { _all: true } }),
      db.alarmEvent.groupBy({ by: ["facilityId"], where: { facilityId: { in: ids }, severity: "critical", timestamp: { gte: since } }, _count: { _all: true } }),
    ])
    const pick = (rows: { facilityId: string | null; _count: { _all: number } }[]) =>
      new Map(rows.map((r) => [r.facilityId, r._count._all]))
    const period = pick(periodCounts)
    const open = pick(openCounts)
    const critical = pick(criticalCounts)

    type Node = { name: string; incidents: number; open: number; critical: number; cameras: number; camerasOnline: number; facilities: number }
    const regions = new Map<string, Node & { cities: Map<string, Node & { lat: number | null; lng: number | null; items: unknown[] }> }>()
    const blank = (name: string): Node => ({ name, incidents: 0, open: 0, critical: 0, cameras: 0, camerasOnline: 0, facilities: 0 })

    for (const f of facilities) {
      const rName = f.region || "Не указано"
      const cName = f.city || "Не указан"
      if (!regions.has(rName)) regions.set(rName, { ...blank(rName), cities: new Map() })
      const r = regions.get(rName)!
      if (!r.cities.has(cName)) {
        const ref = cityByName(cName)
        r.cities.set(cName, { ...blank(cName), lat: ref?.lat ?? null, lng: ref?.lng ?? null, items: [] })
      }
      const c = r.cities.get(cName)!
      const item = {
        id: f.id,
        name: f.name,
        sector: f.sector,
        district: f.district,
        incidents: period.get(f.id) ?? 0,
        open: open.get(f.id) ?? 0,
        critical: critical.get(f.id) ?? 0,
        cameras: f.cameras.length,
        camerasOnline: f.cameras.filter((x) => x.status === "online").length,
      }
      c.items.push(item)
      for (const n of [r, c] as Node[]) {
        n.incidents += item.incidents
        n.open += item.open
        n.critical += item.critical
        n.cameras += item.cameras
        n.camerasOnline += item.camerasOnline
        n.facilities++
      }
    }

    const tree = [...regions.values()]
      .map((r) => ({ ...r, cities: [...r.cities.values()].sort((a, b) => b.incidents - a.incidents) }))
      .sort((a, b) => b.incidents - a.incidents || a.name.localeCompare(b.name, "ru"))

    return NextResponse.json({ days, regions: tree, knownCities: CITIES.map((c) => c.name) })
  } catch (error) {
    console.error("GET locations error:", error)
    return NextResponse.json({ error: "Не удалось получить список местоположений" }, { status: 500 })
  }
}
