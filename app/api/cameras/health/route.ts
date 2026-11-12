import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkStreams } from "@/lib/stream-health"

// Проверить все камеры (или камеры объекта) и записать фактический статус: online / offline.
// Ничего не удаляет — меняются только поля status, lastSeenAt и lastCheckedAt.
export async function POST(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const facilityId = sp.get("facilityId")
    const cameras = await db.camera.findMany({
      where: facilityId ? { facilityId } : undefined,
      select: { id: true, streamUrl: true },
    })

    const started = Date.now()
    const alive = await checkStreams(cameras)
    const now = new Date()
    const onlineIds = cameras.filter((c) => alive.get(c.id)).map((c) => c.id)
    const offlineIds = cameras.filter((c) => !alive.get(c.id)).map((c) => c.id)

    // Если не ответила ни одна камера — скорее всего, проблема со связью у сервера, а не у камер.
    // В этом случае статусы не трогаем, чтобы рабочие камеры не «пропали» из списка.
    if (cameras.length > 0 && onlineIds.length === 0) {
      return NextResponse.json(
        { total: cameras.length, online: 0, offline: offlineIds.length, skipped: true, error: "Ни одна камера не ответила — статусы не изменены" },
        { status: 502 }
      )
    }

    await db.$transaction([
      db.camera.updateMany({
        where: { id: { in: onlineIds } },
        data: { status: "online", lastSeenAt: now, lastCheckedAt: now },
      }),
      db.camera.updateMany({
        where: { id: { in: offlineIds } },
        data: { status: "offline", lastCheckedAt: now },
      }),
    ])

    return NextResponse.json({
      total: cameras.length,
      online: onlineIds.length,
      offline: offlineIds.length,
      checkedAt: now,
      tookMs: Date.now() - started,
    })
  } catch (error) {
    console.error("Camera health check error:", error)
    return NextResponse.json({ error: "Не удалось проверить камеры" }, { status: 500 })
  }
}
