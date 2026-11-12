import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { allowedSectors } from "@/lib/scope"
import { DISTRICTS, OPEN_STATUSES, SECTOR_META, isSector } from "@/lib/sectors"
import { sectorsForRole } from "@/lib/roles"
import { Prisma } from "@prisma/client"

// Реестр объектов с количеством камер (онлайн/всего) и открытых инцидентов
export async function GET(request: Request) {
  try {
    const session = await getSession(request)
    const sp = new URL(request.url).searchParams
    const sectorParam = sp.get("sector")
    const sectors = allowedSectors(session, sectorParam && sectorParam !== "all" ? sectorParam : null)

    const where: Prisma.FacilityWhereInput = { sector: { in: sectors } }
    const district = sp.get("district")
    if (district && (DISTRICTS as readonly string[]).includes(district)) where.district = district
    const q = sp.get("query")
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ]
    }
    const withCameras = sp.get("withCameras") === "1"

    const facilities = await db.facility.findMany({
      where,
      orderBy: [{ sector: "asc" }, { name: "asc" }],
      include: {
        cameras: {
          select: withCameras
            ? { id: true, name: true, status: true, streamUrl: true, info: true }
            : { id: true, status: true },
          orderBy: { name: "asc" },
        },
        _count: { select: { incidents: { where: { status: { in: [...OPEN_STATUSES] } } } } },
      },
    })

    const items = facilities.map(({ cameras, _count, ...f }) => ({
      ...f,
      camerasTotal: cameras.length,
      camerasOnline: cameras.filter((c) => c.status === "online").length,
      openIncidents: _count.incidents,
      cameras: withCameras ? cameras : undefined,
    }))

    // Сводка по секторам (по всем доступным роли, без учёта текущего фильтра сектора) — для вкладок
    const roleSectors = sectorsForRole(session?.role)
    const grouped = await db.facility.groupBy({
      by: ["sector"],
      where: { sector: { in: [...roleSectors] } },
      _count: { _all: true },
    })
    const summary = roleSectors.map((s) => ({
      sector: s,
      label: SECTOR_META[s].plural,
      facilities: grouped.find((g) => g.sector === s)?._count._all ?? 0,
    }))

    return NextResponse.json({ items, summary })
  } catch (error) {
    console.error("GET facilities error:", error)
    return NextResponse.json({ error: "Не удалось получить реестр объектов" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession(request)
    if (session?.role !== "ADMIN") {
      return NextResponse.json({ error: "Добавлять объекты может только администратор" }, { status: 403 })
    }
    const b = await request.json()
    const lat = Number(b.latitude)
    const lng = Number(b.longitude)
    if (!b.name || !isSector(b.sector) || !(DISTRICTS as readonly string[]).includes(b.district) || !b.address || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "Заполните название, сектор, район, адрес и координаты" }, { status: 400 })
    }
    const facility = await db.facility.create({
      data: {
        name: String(b.name),
        sector: b.sector,
        district: b.district,
        address: String(b.address),
        latitude: lat,
        longitude: lng,
        responsibleName: b.responsibleName || null,
        responsiblePhone: b.responsiblePhone || null,
        owner: b.owner || SECTOR_META[b.sector as keyof typeof SECTOR_META].owner,
      },
    })
    return NextResponse.json(facility, { status: 201 })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Объект с таким названием уже существует" }, { status: 400 })
    }
    console.error("POST facility error:", error)
    return NextResponse.json({ error: "Не удалось создать объект" }, { status: 500 })
  }
}
