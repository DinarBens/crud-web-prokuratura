import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { incidentWhere, allowedSectors } from "@/lib/scope"
import { SECTOR_META, SLA_MINUTES, STATUS_META, isSector, type Severity, type IncidentStatus } from "@/lib/sectors"

const TZ_MS = 5 * 3600_000

// Сводная аналитика за период: по секторам, районам, дням, часам, типам и объектам
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const sp = new URL(request.url).searchParams
    const days = Math.min(Math.max(Number(sp.get("days")) || 7, 1), 365)
    sp.set("days", String(days))

    const events = await db.alarmEvent.findMany({
      where: incidentWhere(session, sp),
      select: {
        id: true,
        type: true,
        timestamp: true,
        severity: true,
        status: true,
        isDemo: true,
        source: true,
        facility: { select: { id: true, name: true, sector: true, district: true, city: true } },
        actions: { select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 },
      },
      take: 50000,
    })

    const now = Date.now()
    const sectorParam = sp.get("sector")
    const sectors = allowedSectors(session, sectorParam && sectorParam !== "all" ? sectorParam : null)

    const bySector = Object.fromEntries(
      sectors.map((s) => [s, { sector: s, label: SECTOR_META[s].plural, total: 0, critical: 0, open: 0 }])
    )
    // По городам (а внутри одного города — по районам), список строится из фактических данных
    const byPlace = new Map<string, { district: string; total: number; critical: number; open: number }>()
    const bySource = new Map<string, number>()
    const typeCounts = new Map<string, number>()
    const facilityCounts = new Map<string, { id: string; name: string; sector: string; district: string; city: string; total: number; critical: number }>()
    const cityFilter = sp.get("city")
    const placeOf = (f: { city: string; district: string }) =>
      cityFilter && cityFilter !== "all" ? f.district || f.city || "Не указан" : f.city || "Не указан"
    const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))

    // Дни периода — сутки по времени Алматы (UTC+5)
    const dayKeys: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now + TZ_MS - i * 86400_000)
      dayKeys.push(d.toISOString().slice(0, 10))
    }
    const byDay = Object.fromEntries(dayKeys.map((k) => [k, { date: k, critical: 0, warning: 0, info: 0 }]))

    let critical = 0, warning = 0, info = 0, open = 0, overdue = 0, resolved = 0, falseAlarm = 0
    let reactionSum = 0, reactionN = 0

    for (const e of events) {
      const sev = (e.severity as Severity) || "info"
      if (sev === "critical") critical++
      else if (sev === "warning") warning++
      else info++

      const st = e.status as IncidentStatus
      const isOpen = STATUS_META[st]?.open ?? true
      if (isOpen) {
        open++
        // Просрочена реакция = инцидент не взят в работу дольше норматива
        if (st === "NEW" && now - e.timestamp.getTime() > SLA_MINUTES[sev] * 60_000) overdue++
      }
      if (st === "RESOLVED") resolved++
      if (st === "FALSE_ALARM") falseAlarm++

      const first = e.actions[0]
      if (first) {
        reactionSum += (first.createdAt.getTime() - e.timestamp.getTime()) / 60_000
        reactionN++
      }

      const f = e.facility
      if (f && isSector(f.sector) && bySector[f.sector]) {
        bySector[f.sector].total++
        if (sev === "critical") bySector[f.sector].critical++
        if (isOpen) bySector[f.sector].open++
      }
      if (f) {
        const key = placeOf(f)
        const cur = byPlace.get(key) ?? { district: key, total: 0, critical: 0, open: 0 }
        cur.total++
        if (sev === "critical") cur.critical++
        if (isOpen) cur.open++
        byPlace.set(key, cur)
      }
      bySource.set(e.source, (bySource.get(e.source) ?? 0) + 1)
      if (f) {
        const cur = facilityCounts.get(f.id) ?? { ...f, total: 0, critical: 0 }
        cur.total++
        if (sev === "critical") cur.critical++
        facilityCounts.set(f.id, cur)
      }

      typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1)

      const dk = new Date(e.timestamp.getTime() + TZ_MS).toISOString().slice(0, 10)
      if (byDay[dk]) byDay[dk][sev]++

      // Время Алматы (UTC+5) — для тепловой карты «день недели × час»
      const local = new Date(e.timestamp.getTime() + TZ_MS)
      const wd = (local.getUTCDay() + 6) % 7 // 0 = понедельник
      heat[wd][local.getUTCHours()]++
    }

    // Камеры по секторам
    const cams = await db.camera.findMany({
      where: { facility: { sector: { in: sectors } } },
      select: { status: true, facility: { select: { sector: true } } },
    })
    const camerasBySector = sectors.map((s) => {
      const list = cams.filter((c) => c.facility?.sector === s)
      return {
        sector: s,
        label: SECTOR_META[s].plural,
        total: list.length,
        online: list.filter((c) => c.status === "online").length,
      }
    })

    return NextResponse.json({
      days,
      totals: {
        total: events.length,
        demo: events.filter((e) => e.isDemo).length,
        critical,
        warning,
        info,
        open,
        overdue,
        resolved,
        falseAlarm,
        avgReactionMin: reactionN ? Math.round(reactionSum / reactionN) : null,
        falseAlarmRate: events.length ? Math.round((falseAlarm / events.length) * 100) : 0,
      },
      bySector: Object.values(bySector),
      byDistrict: [...byPlace.values()].sort((a, b) => b.total - a.total),
      placeLevel: cityFilter && cityFilter !== "all" ? "district" : "city",
      bySource: [...bySource.entries()].map(([source, count]) => ({ source, count })),
      byDay: Object.values(byDay),
      heat,
      topTypes: [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([type, count]) => ({ type, count })),
      topFacilities: [...facilityCounts.values()].sort((a, b) => b.total - a.total).slice(0, 10),
      camerasBySector,
    })
  } catch (error) {
    console.error("GET analytics error:", error)
    return NextResponse.json({ error: "Не удалось построить аналитику" }, { status: 500 })
  }
}
