import * as fs from "fs"
import { PrismaClient } from "@prisma/client"
import { hashPassword } from "../lib/password"
import {
  DISTRICTS,
  SECTOR_META,
  SECTOR_SITUATIONS,
  SLA_MINUTES,
  FORWARD_TARGETS,
  severityOf,
  type Sector,
  type IncidentStatus,
} from "../lib/sectors"

const prisma = new PrismaClient()

// Детерминированный генератор — одинаковые демо-данные при каждом запуске
let seed = 42
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))

const initialCities = [
  { name: "Астана", latitude: 51.1694, longitude: 71.4491, status: "stable", connections: 8, latency: 15, loadPercent: 45 },
  { name: "Алматы", latitude: 43.2220, longitude: 76.8512, status: "stable", connections: 12, latency: 18, loadPercent: 52 },
  { name: "Шымкент", latitude: 42.3417, longitude: 69.5901, status: "stable", connections: 16, latency: 21, loadPercent: 60 },
  { name: "Караганда", latitude: 49.8019, longitude: 73.1021, status: "stable", connections: 20, latency: 24, loadPercent: 47 },
  { name: "Актобе", latitude: 50.2839, longitude: 57.1670, status: "stable", connections: 24, latency: 27, loadPercent: 55 },
  { name: "Павлодар", latitude: 52.2833, longitude: 76.9667, status: "stable", connections: 28, latency: 30, loadPercent: 62 },
  { name: "Атырау", latitude: 47.1167, longitude: 51.8833, status: "stable", connections: 32, latency: 33, loadPercent: 49 },
  { name: "Усть-Каменогорск", latitude: 49.9483, longitude: 82.6278, status: "stable", connections: 36, latency: 36, loadPercent: 58 },
]

// Примерные центры районов Шымкента (для демо-размещения объектов на карте)
const DISTRICT_CENTERS: Record<(typeof DISTRICTS)[number], [number, number]> = {
  "Абайский": [42.345, 69.545],
  "Аль-Фарабийский": [42.318, 69.598],
  "Енбекшинский": [42.355, 69.640],
  "Каратауский": [42.395, 69.590],
  "Туранский": [42.285, 69.560],
}

const STREETS = ["пр. Тауке хана", "ул. Байтурсынова", "пр. Республики", "ул. Казыбек би", "ул. Толе би", "пр. Кунаева", "ул. Жибек жолы", "ул. Рыскулова", "ул. Абая", "пр. Аль-Фараби"]

// Сколько объектов каждого сектора на район
const PER_DISTRICT: Record<Sector, number> = { SCHOOL: 5, KINDERGARTEN: 4, MEDICAL: 2, POLICE: 1, CITY: 3 }
const CAMERAS_PER: Record<Sector, [number, number]> = { SCHOOL: [4, 8], KINDERGARTEN: [3, 5], MEDICAL: [4, 7], POLICE: [2, 4], CITY: [1, 3] }

function facilityName(sector: Sector, district: string, n: number) {
  switch (sector) {
    case "SCHOOL": return `Школа-гимназия №${n}`
    case "KINDERGARTEN": return `Детский сад №${n}`
    case "MEDICAL": return n % 2 ? `Городская поликлиника №${n}` : `Городская больница №${n}`
    case "POLICE": return `УП ${district.replace(/ий$/, "ого")} района`
    case "CITY": {
      const a = pick(STREETS)
      let b = pick(STREETS)
      while (b === a) b = pick(STREETS)
      return `Перекрёсток ${a} / ${b}`
    }
  }
}

interface JSONCameraItem {
  id: string
  uniqueChannel: number
  address: string
  name: string
  deviceType?: string
  equipmentId?: string
  organizationName?: string
}

// Реальные камеры из выгрузки v-guard (если файл доступен) — путь через CAMERAS_JSON_PATH
function loadImportedStreams(): { name: string; info: string; streamUrl: string }[] {
  const jsonPath = process.env.CAMERAS_JSON_PATH || "D:\\edtech\\qoz-vision-demo\\cameras.json"
  if (!fs.existsSync(jsonPath)) {
    console.log(`cameras.json не найден (${jsonPath}) — используются демо-потоки`)
    return []
  }
  const items: JSONCameraItem[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"))
  const HLS = "https://v-guard.kz/hls"
  const NVR = /^(DS-N316|XVR)/i
  return items.map((c) => {
    const nvr = NVR.test(c.deviceType ?? "")
    const pathId = nvr ? c.equipmentId ?? "" : c.id
    const sub = nvr ? c.uniqueChannel : 1
    return {
      name: `${c.name} (${c.address} #${c.uniqueChannel})`,
      info: `${c.deviceType || "Unknown Device"} | ${c.organizationName || "Unknown Org"}`,
      streamUrl: `${HLS}/camera_${pathId}_sub_${sub}/video1_stream.m3u8`,
    }
  })
}

const DEMO_STREAM = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"

async function main() {
  console.log("Seeding map points...")
  for (const city of initialCities) {
    await prisma.mapPoint.upsert({ where: { name: city.name }, update: {}, create: city })
  }

  console.log("Seeding users...")
  const demoPassword = process.env.DEMO_PASSWORD || "admin123"
  const users = [
    { email: "admin@edtech.kz", name: "Администратор", role: "ADMIN" },
    { email: "prokuratura@demo.kz", name: "Прокурор (демо)", role: "PROSECUTOR" },
    { email: "police@demo.kz", name: "Дежурная часть ДП (демо)", role: "POLICE" },
    { email: "education@demo.kz", name: "Управление образования (демо)", role: "EDUCATION" },
    { email: "health@demo.kz", name: "Управление здравоохранения (демо)", role: "HEALTH" },
  ]
  const userIds: string[] = []
  for (const u of users) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: { ...u, password: hashPassword(demoPassword) },
    })
    userIds.push(row.id)
  }

  console.log("Clearing incidents, screens, cameras, facilities...")
  await prisma.incidentAction.deleteMany()
  await prisma.alarmEvent.deleteMany()
  await prisma.screen.deleteMany()
  await prisma.camera.deleteMany()
  await prisma.facility.deleteMany()

  console.log("Seeding facilities...")
  const imported = loadImportedStreams()
  let importedIdx = 0
  const counters: Record<Sector, number> = { SCHOOL: 1, KINDERGARTEN: 1, MEDICAL: 1, POLICE: 1, CITY: 1 }
  const facilities: { id: string; sector: Sector; name: string; cameras: { id: string; name: string }[] }[] = []

  // Головное здание ДП города
  const allSpecs: { sector: Sector; district: (typeof DISTRICTS)[number]; name: string }[] = [
    { sector: "POLICE", district: "Аль-Фарабийский", name: "Департамент полиции г. Шымкент" },
  ]
  for (const district of DISTRICTS) {
    for (const sector of Object.keys(PER_DISTRICT) as Sector[]) {
      for (let i = 0; i < PER_DISTRICT[sector]; i++) {
        // Уникальные номера: шаг 3 со случайным сдвигом
        const n = sector === "POLICE" ? 0 : counters[sector]++ * 3 + int(0, 2)
        allSpecs.push({ sector, district, name: facilityName(sector, district, n) })
      }
    }
  }

  const usedNames = new Set<string>()
  for (const spec of allSpecs) {
    let name = spec.name
    while (usedNames.has(name)) {
      name = spec.sector === "CITY" ? facilityName("CITY", spec.district, 0) : `${spec.name}-${int(1, 9)}`
    }
    usedNames.add(name)

    const [clat, clng] = DISTRICT_CENTERS[spec.district]
    const lat = clat + (rnd() - 0.5) * 0.04
    const lng = clng + (rnd() - 0.5) * 0.05
    const f = await prisma.facility.create({
      data: {
        name,
        sector: spec.sector,
        district: spec.district,
        address: `${pick(STREETS)}, ${int(1, 220)}`,
        latitude: lat,
        longitude: lng,
        owner: SECTOR_META[spec.sector].owner,
        responsibleName: spec.sector === "CITY" ? "Ситуационный центр акимата" : "Дежурный администратор (демо)",
      },
    })

    const [cmin, cmax] = CAMERAS_PER[spec.sector]
    const camCount = int(cmin, cmax)
    const cams: { id: string; name: string }[] = []
    for (let c = 1; c <= camCount; c++) {
      const src = imported.length ? imported[importedIdx++ % imported.length] : null
      const zone = spec.sector === "CITY" ? `обзор ${c}` : pick(["вход", "коридор", "двор", "холл", "периметр", "парковка"])
      const cam = await prisma.camera.create({
        data: {
          name: `${name} — камера ${c} (${zone})`,
          info: src?.info ?? `${SECTOR_META[spec.sector].owner} | ${spec.district} р-н`,
          streamUrl: src?.streamUrl ?? DEMO_STREAM,
          facilityId: f.id,
          latitude: lat + (rnd() - 0.5) * 0.001,
          longitude: lng + (rnd() - 0.5) * 0.001,
          status: rnd() < 0.9 ? "online" : "offline",
          lastSeenAt: new Date(),
        },
      })
      cams.push({ id: cam.id, name: cam.name })
    }
    facilities.push({ id: f.id, sector: spec.sector, name, cameras: cams })
  }
  console.log(`  ${facilities.length} объектов, ${facilities.reduce((a, f) => a + f.cameras.length, 0)} камер`)

  console.log("Seeding incidents...")
  const now = Date.now()
  const DAYS = 30
  let created = 0
  for (const f of facilities) {
    // Интенсивность зависит от сектора: город и школы — чаще
    const rate = { SCHOOL: 14, KINDERGARTEN: 5, MEDICAL: 9, POLICE: 4, CITY: 18 }[f.sector]
    const count = int(Math.floor(rate * 0.5), rate)
    for (let i = 0; i < count; i++) {
      const type = pick(SECTOR_SITUATIONS[f.sector])
      const severity = severityOf(type)
      // Часы активности: школы/садики — днём, город — вечером
      const ageDays = Math.pow(rnd(), 1.3) * DAYS
      const d = new Date(now - ageDays * 86400_000)
      const dayHours = f.sector === "SCHOOL" || f.sector === "KINDERGARTEN" ? [8, 18] : f.sector === "CITY" ? [7, 23] : [0, 23]
      d.setUTCHours(int(dayHours[0], dayHours[1]) - 5, int(0, 59), int(0, 59)) // локальный час Алматы → UTC
      if (d.getTime() > now) d.setTime(now - int(1, 120) * 60_000)
      const cam = pick(f.cameras)

      // Статус: свежие — чаще новые, старые — отработаны
      const ageMin = (now - d.getTime()) / 60_000
      let status: IncidentStatus
      const r = rnd()
      if (ageMin < SLA_MINUTES[severity]) status = r < 0.7 ? "NEW" : "IN_REVIEW"
      else if (ageDays < 2) status = r < 0.12 ? "NEW" : r < 0.25 ? "IN_REVIEW" : r < 0.45 ? "FORWARDED" : r < 0.92 ? "RESOLVED" : "FALSE_ALARM"
      else status = r < 0.01 ? "NEW" : r < 0.04 ? "FORWARDED" : r < 0.88 ? "RESOLVED" : "FALSE_ALARM"

      const forwardedTo = status === "FORWARDED" || (status === "RESOLVED" && rnd() < 0.5) ? pick(FORWARD_TARGETS) : null
      const reaction = severity === "critical" ? int(2, 25) : int(5, 120)
      const actedAt = new Date(Math.min(now, d.getTime() + reaction * 60_000))

      const ev = await prisma.alarmEvent.create({
        data: {
          type,
          cameraName: cam.name,
          cameraId: cam.id,
          facilityId: f.id,
          timestamp: d,
          severity,
          status,
          forwardedTo,
          details: `Видеоаналитика зафиксировала «${type}» на объекте «${f.name}» (${cam.name}).`,
          resolvedAt: status === "RESOLVED" || status === "FALSE_ALARM" ? actedAt : null,
        },
      })

      if (status !== "NEW") {
        await prisma.incidentAction.create({
          data: {
            incidentId: ev.id,
            userId: pick(userIds),
            action: forwardedTo ? "FORWARD" : "STATUS_CHANGE",
            fromStatus: "NEW",
            toStatus: status,
            comment: forwardedTo ? `Передано: ${forwardedTo}` : status === "FALSE_ALARM" ? "Ложное срабатывание, проверено по видео" : null,
            createdAt: actedAt,
          },
        })
      }
      created++
    }
  }
  console.log(`  ${created} инцидентов`)
  console.log("Seeding finished successfully.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
