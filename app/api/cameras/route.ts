import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams
    const facilityId = sp.get("facilityId")
    const cameras = await db.camera.findMany({
      where: facilityId ? { facilityId } : undefined,
      include: { facility: { select: { id: true, name: true, sector: true, district: true } } },
      orderBy: { createdAt: "desc" },
    })
    // Рабочие камеры — первыми, дальше по имени
    cameras.sort((a, b) =>
      a.status === b.status ? a.name.localeCompare(b.name, "ru", { numeric: true }) : a.status === "online" ? -1 : 1
    )
    return NextResponse.json(cameras)
  } catch (error) {
    console.error("GET cameras error:", error)
    return NextResponse.json(
      { error: "Не удалось получить список камер" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { name, info, streamUrl, facilityId, latitude, longitude } = await request.json()

    if (!name || !info || !streamUrl) {
      return NextResponse.json(
        { error: "Все поля обязательны для заполнения" },
        { status: 400 }
      )
    }

    const camera = await db.camera.create({
      data: {
        name,
        info,
        streamUrl,
        facilityId: facilityId || null,
        latitude: latitude != null && latitude !== "" ? Number(latitude) : null,
        longitude: longitude != null && longitude !== "" ? Number(longitude) : null,
      },
    })

    return NextResponse.json(camera, { status: 201 })
  } catch (error) {
    console.error("POST camera error:", error)
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json(
        { error: "Камера с таким именем уже существует" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Не удалось создать камеру" },
      { status: 500 }
    )
  }
}
