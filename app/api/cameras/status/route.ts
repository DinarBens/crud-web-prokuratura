import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// Сохранить результаты проверки потоков, выполненной в браузере оператора.
// body: { results: [{ id: string, alive: boolean }] }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const results: { id: string; alive: boolean }[] = Array.isArray(body?.results)
      ? body.results.filter(
          (r: unknown): r is { id: string; alive: boolean } =>
            !!r &&
            typeof (r as { id: unknown }).id === "string" &&
            typeof (r as { alive: unknown }).alive === "boolean"
        )
      : []
    if (!results.length) return NextResponse.json({ error: "Нет результатов проверки" }, { status: 400 })

    const onlineIds = results.filter((r) => r.alive).map((r) => r.id)
    const offlineIds = results.filter((r) => !r.alive).map((r) => r.id)

    // Большая порция, где не ответила ни одна камера, — вероятнее проблема со связью у оператора; статусы не трогаем
    if (onlineIds.length === 0 && results.length >= 100) {
      return NextResponse.json(
        { skipped: true, error: "Ни одна камера не ответила — проверьте интернет, статусы не изменены" },
        { status: 409 }
      )
    }

    const now = new Date()
    await db.$transaction([
      db.camera.updateMany({
        where: { id: { in: onlineIds }, isDemo: false },
        data: { status: "online", lastSeenAt: now, lastCheckedAt: now },
      }),
      db.camera.updateMany({
        where: { id: { in: offlineIds }, isDemo: false },
        data: { status: "offline", lastCheckedAt: now },
      }),
    ])
    return NextResponse.json({ online: onlineIds.length, offline: offlineIds.length, checkedAt: now })
  } catch (error) {
    console.error("Camera status save error:", error)
    return NextResponse.json({ error: "Не удалось сохранить статусы камер" }, { status: 500 })
  }
}
