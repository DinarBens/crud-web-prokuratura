import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { sectorsForRole, ROLE_META, type Role } from "@/lib/roles"
import { SECTORS, STATUS_META, isIncidentStatus, isSector, type IncidentStatus } from "@/lib/sectors"

async function loadAllowed(id: string, role: string | undefined) {
  const incident = await db.alarmEvent.findUnique({
    where: { id },
    include: {
      facility: true,
      camera: { select: { id: true, name: true, streamUrl: true, status: true } },
      actions: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true, email: true, role: true } } },
      },
    },
  })
  if (!incident) return null
  const sectors = sectorsForRole(role)
  const sector = incident.facility?.sector
  const allowed = isSector(sector) ? sectors.includes(sector) : sectors.length === SECTORS.length
  return allowed ? incident : null
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request)
  const { id } = await params
  const incident = await loadAllowed(id, session?.role)
  if (!incident) return NextResponse.json({ error: "Инцидент не найден" }, { status: 404 })
  return NextResponse.json(incident)
}

// Смена статуса / передача / комментарий. Каждое действие пишется в журнал IncidentAction.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 })
    if (!ROLE_META[session.role as Role]?.canChangeStatus) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 })
    }

    const { id } = await params
    const incident = await loadAllowed(id, session.role)
    if (!incident) return NextResponse.json({ error: "Инцидент не найден" }, { status: 404 })

    const body = await request.json()
    if (body.status !== undefined && !isIncidentStatus(body.status)) {
      return NextResponse.json({ error: "Неизвестный статус" }, { status: 400 })
    }
    const status: IncidentStatus | undefined = body.status
    const comment: string | undefined = typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : undefined
    const forwardedTo: string | undefined = typeof body.forwardedTo === "string" ? body.forwardedTo.trim().slice(0, 200) : undefined

    if (status === "FORWARDED" && !forwardedTo) {
      return NextResponse.json({ error: "Укажите, куда передан инцидент" }, { status: 400 })
    }
    if (!status && !comment) {
      return NextResponse.json({ error: "Нет изменений" }, { status: 400 })
    }

    const statusChanged = !!status && status !== incident.status
    const closing = statusChanged && !STATUS_META[status!].open

    await db.$transaction([
      db.alarmEvent.update({
        where: { id },
        data: {
          ...(statusChanged ? { status } : {}),
          ...(status === "FORWARDED" ? { forwardedTo } : {}),
          ...(closing ? { resolvedAt: new Date() } : {}),
          ...(statusChanged && STATUS_META[status!].open ? { resolvedAt: null } : {}),
        },
      }),
      db.incidentAction.create({
        data: {
          incidentId: id,
          userId: session.uid,
          action: status === "FORWARDED" ? "FORWARD" : statusChanged ? "STATUS_CHANGE" : "COMMENT",
          fromStatus: statusChanged ? incident.status : null,
          toStatus: statusChanged ? status : null,
          comment: [status === "FORWARDED" ? `Передано: ${forwardedTo}` : null, comment || null]
            .filter(Boolean)
            .join(". ") || null,
        },
      }),
    ])

    return NextResponse.json(await loadAllowed(id, session.role))
  } catch (error) {
    console.error("PATCH incident error:", error)
    return NextResponse.json({ error: "Не удалось обновить инцидент" }, { status: 500 })
  }
}
