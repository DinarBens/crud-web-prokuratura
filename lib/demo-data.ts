// Демонстрационные данные (имитация) для показа аналитики и журнала инцидентов.
// Все записи помечаются isDemo = true: реальные камеры, объекты и тревоги не изменяются и не удаляются.
// Повторная загрузка сначала убирает только прежние демо-записи.

import { randomUUID } from "crypto"
import * as fs from "fs"
import * as path from "path"
import type { PrismaClient } from "@prisma/client"
import {
  DISTRICTS,
  FORWARD_TARGETS,
  SECTOR_META,
  SECTOR_SITUATIONS,
  SLA_MINUTES,
  severityOf,
  type IncidentStatus,
  type Sector,
} from "./sectors"

// ---------- случайности (детерминированно, чтобы демо выглядело одинаково) ----------
function makeRng(seed: number) {
  let s = seed
  const rnd = () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  return { rnd, pick, int }
}

// ---------- география ----------
type DistrictGeo = { properties: { district: string }; bbox: number[]; geometry: { coordinates: number[][][] } }

function loadDistricts(): DistrictGeo[] {
  const file = path.join(process.cwd(), "public", "data", "shymkent-districts.geojson")
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { features: DistrictGeo[] }).features
}

function insideRing(pt: [number, number], ring: number[][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const CITY_CENTER: [number, number] = [69.596, 42.317]

// ---------- справочники для правдоподобных текстов ----------
const STREETS = ["пр. Тауке хана", "ул. Байтурсынова", "пр. Республики", "ул. Казыбек би", "ул. Толе би", "пр. Кунаева", "ул. Жибек жолы", "ул. Рыскулова", "ул. Абая", "пр. Аль-Фараби", "ул. Момышулы", "ул. Елшибек батыра"]

const ZONES: Record<Sector, string[]> = {
  SCHOOL: ["главный вход", "коридор 2 этажа", "школьный двор", "спортивная площадка", "столовая", "гардероб", "лестница блока Б"],
  KINDERGARTEN: ["вход и калитка", "игровая площадка", "периметр", "холл", "прогулочная веранда"],
  MEDICAL: ["приёмный покой", "регистратура", "коридор отделения", "парковка", "вход в стационар"],
  POLICE: ["вход в здание", "периметр", "служебная парковка", "дежурная часть"],
  CITY: ["перекрёсток", "пешеходный переход", "остановка", "сквер", "подземный переход"],
}

// Подробные пояснения к событиям — особенно для критичных
const DETAILS: Record<string, string[]> = {
  "Драка": [
    "Видеоаналитика зафиксировала конфликт с применением физической силы между {n} лицами в зоне «{zone}». Продолжительность около {d} мин. Сотрудник охраны прибыл через {r} мин, участники разведены.",
    "Потасовка группы подростков ({n} чел.) в зоне «{zone}». Один участник упал на землю. Требуется установить личности и проверить, вызывались ли медики.",
  ],
  "Оружие": [
    "Обнаружен предмет, похожий на нож, в руках посетителя в зоне «{zone}». Уверенность распознавания {p}%. Требуется немедленная проверка нарядом полиции.",
    "Система распознала предмет, похожий на травматический пистолет, у мужчины в зоне «{zone}». Человек покинул кадр через {d} мин в направлении выхода.",
  ],
  "Огонь": [
    "Открытое пламя в зоне «{zone}». Площадь возгорания по кадру — около 1 м². Оповещён ДЧС, проверено срабатывание пожарной сигнализации.",
  ],
  "Дым": [
    "Задымление в зоне «{zone}». Источник не виден в кадре. Требуется проверка на месте и сверка с датчиками пожарной сигнализации.",
  ],
  "Упавший человек": [
    "Человек упал в зоне «{zone}» и не поднимался {d} мин. Возможна необходимость медицинской помощи. Проверено, вызвана ли скорая.",
    "Падение пожилого человека в зоне «{zone}». Персонал подошёл через {r} мин.",
  ],
  "Лежащий человек": [
    "Человек длительно ({d} мин) находится в лежачем положении в зоне «{zone}» без движения. Требуется проверка состояния.",
  ],
  "ДТП": [
    "Столкновение двух легковых автомобилей в зоне «{zone}». Пострадавшие по кадру не установлены, движение затруднено. Передано в дорожную полицию.",
    "Наезд на пешехода в зоне «{zone}». Пешеход поднялся самостоятельно, водитель остановился. Требуется проверка регистрации факта в КУИ.",
  ],
  "Вандализм": [
    "Повреждение имущества в зоне «{zone}»: {n} лица ломают ограждение / наносят надписи. Продолжительность около {d} мин.",
  ],
  "Хулиганство": [
    "Агрессивное поведение посетителя в зоне «{zone}»: крики, угрозы персоналу. Длительность около {d} мин.",
  ],
  "Газовый баллон": [
    "Газовый баллон оставлен без присмотра в зоне «{zone}». Требуется проверка и при необходимости эвакуация.",
  ],
  "Нарушитель": [
    "Посторонний человек проник на территорию через «{zone}» в учебное время, минуя пост охраны.",
    "Вход постороннего лица без регистрации на посту охраны. Находился на территории {d} мин.",
  ],
  "Распознанное лицо неизвестно": [
    "Неизвестное лицо длительно находится у зоны «{zone}» ({d} мин), не относится к персоналу и родителям.",
  ],
  "Распознанное лицо известно": [
    "Распознано лицо из списка розыска / ограничений у зоны «{zone}». Совпадение {p}%. Требуется проверка.",
  ],
  "Курение": ["Курение на территории в зоне «{zone}», {n} чел."],
  "Оставленный предмет": ["Сумка оставлена без присмотра в зоне «{zone}» более {d} мин."],
  "Избыточное количество людей": ["Скопление более {k} человек в зоне «{zone}»."],
  "Бегущий человек": ["Человек бегом покинул территорию через «{zone}»."],
  "Видеосигнал потерян": ["Камера перестала передавать видео. Возможна неисправность или умышленное отключение."],
  "Видеосигнал ослеплён": ["Камера закрыта или засвечена — изображение отсутствует."],
  "Выход из зоны": ["Ребёнок вышел за пределы прогулочной зоны через «{zone}» без сопровождения воспитателя."],
  "Длительное нахождение в зоне": ["Посторонний находится у ограждения детского сада ({zone}) более {d} мин."],
  "Переход в неположенном месте": ["Переход проезжей части вне пешеходного перехода в зоне «{zone}»."],
  "Переход на красный": ["Пешеход перешёл дорогу на запрещающий сигнал светофора."],
  "Скопление транспортных средств": ["Затор в зоне «{zone}», движение остановлено более {d} мин."],
}

const REVIEW_NOTES = [
  "Видеозапись просмотрена, факт подтверждён. Запрошены объяснения у охраны объекта.",
  "Проверяем: запрошена информация у руководителя объекта.",
  "Ожидаем рапорт участкового инспектора.",
]
const FORWARD_NOTES = [
  "Направлено для принятия мер, срок ответа — 1 рабочий день.",
  "Выехал наряд, ожидаем результат.",
  "Передано ответственному ведомству, контроль исполнения.",
]
const RESOLVE_NOTES = [
  "Наряд прибыл на место, участники установлены, составлен протокол.",
  "Меры приняты, руководителю объекта направлено представление.",
  "Факт зарегистрирован в КУИ, проводится проверка.",
  "Конфликт урегулирован на месте, проведена профилактическая беседа.",
  "Медицинская помощь оказана, угрозы жизни нет.",
]

function fill(tpl: string, r: ReturnType<typeof makeRng>, zone: string) {
  return tpl
    .replace("{zone}", zone)
    .replace("{n}", String(r.int(2, 5)))
    .replace("{d}", String(r.int(2, 15)))
    .replace("{r}", String(r.int(3, 18)))
    .replace("{p}", String(r.int(82, 97)))
    .replace("{k}", String(r.int(25, 60)))
}

// Объектов на район по секторам
const PER_DISTRICT: Record<Sector, number> = { SCHOOL: 4, KINDERGARTEN: 3, MEDICAL: 2, POLICE: 1, CITY: 2 }
const CAMERAS: Record<Sector, [number, number]> = { SCHOOL: [4, 7], KINDERGARTEN: [3, 5], MEDICAL: [3, 6], POLICE: [2, 4], CITY: [1, 3] }
// Среднее число событий на объект за 30 дней
const RATE: Record<Sector, number> = { SCHOOL: 9, KINDERGARTEN: 4, MEDICAL: 7, POLICE: 3, CITY: 12 }

export async function clearDemo(db: PrismaClient) {
  const incidents = await db.alarmEvent.deleteMany({ where: { isDemo: true } })
  const cameras = await db.camera.deleteMany({ where: { isDemo: true } })
  const facilities = await db.facility.deleteMany({ where: { isDemo: true } })
  return { incidents: incidents.count, cameras: cameras.count, facilities: facilities.count }
}

export async function loadDemo(db: PrismaClient, days = 30) {
  await clearDemo(db)
  const r = makeRng(20261112)
  const geo = loadDistricts()
  const now = Date.now()

  const pointIn = (district: string): [number, number] => {
    const f = geo.find((x) => x.properties.district === district)
    if (!f) return [CITY_CENTER[1], CITY_CENTER[0]]
    const [minX, minY, maxX, maxY] = f.bbox
    const ring = f.geometry.coordinates[0]
    for (const radiusKm of [9, 14, 1000]) {
      for (let i = 0; i < 400; i++) {
        const pt: [number, number] = [minX + r.rnd() * (maxX - minX), minY + r.rnd() * (maxY - minY)]
        const dist = Math.hypot((pt[0] - CITY_CENTER[0]) * 82, (pt[1] - CITY_CENTER[1]) * 111)
        if (dist <= radiusKm && insideRing(pt, ring)) return [pt[1], pt[0]]
      }
    }
    return [(minY + maxY) / 2, (minX + maxX) / 2]
  }

  // ----- объекты -----
  const counters: Record<Sector, number> = { SCHOOL: 3, KINDERGARTEN: 5, MEDICAL: 1, POLICE: 0, CITY: 0 }
  const usedNames = new Set<string>()
  const facilityRows: {
    id: string; name: string; sector: Sector; district: string; address: string
    latitude: number; longitude: number; owner: string; responsibleName: string; isDemo: boolean
  }[] = []

  const nameFor = (sector: Sector, district: string): string => {
    for (;;) {
      let name: string
      if (sector === "SCHOOL") name = `Школа-гимназия №${(counters.SCHOOL += r.int(2, 5))}`
      else if (sector === "KINDERGARTEN") name = `Детский сад №${(counters.KINDERGARTEN += r.int(2, 6))}`
      else if (sector === "MEDICAL") name = r.rnd() < 0.5 ? `Городская поликлиника №${(counters.MEDICAL += r.int(1, 3))}` : `Городская больница №${(counters.MEDICAL += r.int(1, 3))}`
      else if (sector === "POLICE") name = `УП ${district.replace(/ий$/, "ого")} района`
      else {
        const a = r.pick(STREETS)
        let b = r.pick(STREETS)
        while (b === a) b = r.pick(STREETS)
        name = `Перекрёсток ${a} / ${b}`
      }
      if (!usedNames.has(name)) {
        usedNames.add(name)
        return name
      }
    }
  }

  const addFacility = (sector: Sector, district: string, name?: string) => {
    const [lat, lng] = pointIn(district)
    facilityRows.push({
      id: randomUUID(),
      name: (name ?? nameFor(sector, district)) + " (демо)",
      sector,
      district,
      address: `${r.pick(STREETS)}, ${r.int(1, 220)}`,
      latitude: lat,
      longitude: lng,
      owner: SECTOR_META[sector].owner,
      responsibleName: sector === "CITY" ? "Ситуационный центр акимата" : "Дежурный администратор",
      isDemo: true,
    })
  }

  addFacility("POLICE", "Аль-Фарабийский", "Департамент полиции г. Шымкент")
  for (const district of DISTRICTS) {
    for (const sector of Object.keys(PER_DISTRICT) as Sector[]) {
      for (let i = 0; i < PER_DISTRICT[sector]; i++) addFacility(sector, district)
    }
  }

  // ----- камеры -----
  const cameraRows: {
    id: string; name: string; info: string; streamUrl: string; facilityId: string
    latitude: number; longitude: number; status: string; isDemo: boolean
  }[] = []
  const camsByFacility = new Map<string, { id: string; name: string; zone: string }[]>()
  for (const f of facilityRows) {
    const [a, b] = CAMERAS[f.sector]
    const list: { id: string; name: string; zone: string }[] = []
    for (let c = 1; c <= r.int(a, b); c++) {
      const zone = r.pick(ZONES[f.sector])
      const row = {
        id: randomUUID(),
        name: `${f.name} — камера ${c} (${zone})`,
        info: `${f.owner} | ${f.district} р-н`,
        streamUrl: "demo://no-stream",
        facilityId: f.id,
        latitude: f.latitude + (r.rnd() - 0.5) * 0.001,
        longitude: f.longitude + (r.rnd() - 0.5) * 0.001,
        status: r.rnd() < 0.9 ? "online" : "offline",
        isDemo: true,
      }
      cameraRows.push(row)
      list.push({ id: row.id, name: row.name, zone })
    }
    camsByFacility.set(f.id, list)
  }

  // ----- инциденты и журнал -----
  const incidentRows: {
    id: string; type: string; cameraName: string; cameraId: string; facilityId: string; timestamp: Date
    details: string; severity: string; status: string; forwardedTo: string | null; resolvedAt: Date | null; isDemo: boolean
  }[] = []
  const actionRows: {
    id: string; incidentId: string; action: string; fromStatus: string | null; toStatus: string | null
    comment: string | null; createdAt: Date
  }[] = []

  const hoursFor = (s: Sector): [number, number] =>
    s === "SCHOOL" || s === "KINDERGARTEN" ? [8, 18] : s === "CITY" ? [7, 23] : [0, 23]

  for (const f of facilityRows) {
    const cams = camsByFacility.get(f.id) ?? []
    if (!cams.length) continue
    const count = r.int(Math.ceil(RATE[f.sector] * 0.4), Math.ceil(RATE[f.sector] * 1.4))
    for (let i = 0; i < count; i++) {
      // Критичные события реже обычных: примерно каждое четвёртое
      const pool = SECTOR_SITUATIONS[f.sector]
      const crit = pool.filter((x) => severityOf(x) === "critical")
      const rest = pool.filter((x) => severityOf(x) !== "critical")
      const type = crit.length && (r.rnd() < 0.25 || !rest.length) ? r.pick(crit) : r.pick(rest)
      const severity = severityOf(type)
      const ageDays = Math.pow(r.rnd(), 1.4) * days
      const t = new Date(now - ageDays * 86400_000)
      const [h0, h1] = hoursFor(f.sector)
      t.setUTCHours(r.int(h0, h1) - 5, r.int(0, 59), r.int(0, 59)) // час по Алматы → UTC
      if (t.getTime() > now) t.setTime(now - r.int(5, 240) * 60_000)
      const cam = r.pick(cams)
      const tpl = DETAILS[type] ? r.pick(DETAILS[type]) : `Зафиксировано событие «${type}» в зоне «{zone}».`

      const ageMin = (now - t.getTime()) / 60_000
      const x = r.rnd()
      let status: IncidentStatus
      if (ageMin < SLA_MINUTES[severity]) status = x < 0.75 ? "NEW" : "IN_REVIEW"
      else if (ageDays < 1) status = x < 0.1 ? "NEW" : x < 0.3 ? "IN_REVIEW" : x < 0.55 ? "FORWARDED" : x < 0.93 ? "RESOLVED" : "FALSE_ALARM"
      else if (ageDays < 4) status = x < 0.02 ? "NEW" : x < 0.07 ? "IN_REVIEW" : x < 0.16 ? "FORWARDED" : x < 0.9 ? "RESOLVED" : "FALSE_ALARM"
      else status = x < 0.01 ? "FORWARDED" : x < 0.9 ? "RESOLVED" : "FALSE_ALARM"

      const forwardTarget =
        f.sector === "POLICE" || f.sector === "CITY" ? r.pick(FORWARD_TARGETS.slice(0, 6))
        : severity === "critical" ? (type === "Огонь" || type === "Дым" ? "ДЧС г. Шымкент" : type.includes("человек") ? "Скорая помощь (103)" : r.pick(FORWARD_TARGETS.slice(1, 6)))
        : f.sector === "MEDICAL" ? "Управление здравоохранения" : "Управление образования"
      const forwarded = status === "FORWARDED" || (status === "RESOLVED" && (severity === "critical" || r.rnd() < 0.4))
      const reaction = severity === "critical" ? r.int(2, 22) : severity === "warning" ? r.int(5, 75) : r.int(20, 240)

      const id = randomUUID()
      const firstAt = new Date(Math.min(now - 60_000, t.getTime() + reaction * 60_000))
      const closeAt = new Date(Math.min(now - 30_000, firstAt.getTime() + r.int(20, 240) * 60_000))
      incidentRows.push({
        id,
        type,
        cameraName: cam.name,
        cameraId: cam.id,
        facilityId: f.id,
        timestamp: t,
        details: fill(tpl, r, cam.zone),
        severity,
        status,
        forwardedTo: forwarded ? forwardTarget : null,
        resolvedAt: status === "RESOLVED" || status === "FALSE_ALARM" ? closeAt : null,
        isDemo: true,
      })

      if (status === "NEW") continue
      // Первое действие: взято на проверку
      actionRows.push({
        id: randomUUID(), incidentId: id, action: "STATUS_CHANGE", fromStatus: "NEW", toStatus: "IN_REVIEW",
        comment: `Оператор ${f.sector === "CITY" ? "ситуационного центра" : "дежурной части"}: ${r.pick(REVIEW_NOTES)}`, createdAt: firstAt,
      })
      if (status === "FALSE_ALARM") {
        actionRows.push({
          id: randomUUID(), incidentId: id, action: "STATUS_CHANGE", fromStatus: "IN_REVIEW", toStatus: "FALSE_ALARM",
          comment: "Проверено по видео: события не было, срабатывание ложное.", createdAt: closeAt,
        })
        continue
      }
      if (forwarded) {
        actionRows.push({
          id: randomUUID(), incidentId: id, action: "FORWARD", fromStatus: "IN_REVIEW", toStatus: "FORWARDED",
          comment: `Передано: ${forwardTarget}. ${r.pick(FORWARD_NOTES)}`,
          createdAt: new Date(Math.min(now - 45_000, firstAt.getTime() + r.int(2, 15) * 60_000)),
        })
      }
      if (status === "RESOLVED") {
        actionRows.push({
          id: randomUUID(), incidentId: id, action: "STATUS_CHANGE", fromStatus: forwarded ? "FORWARDED" : "IN_REVIEW", toStatus: "RESOLVED",
          comment: r.pick(RESOLVE_NOTES), createdAt: closeAt,
        })
      }
    }
  }

  await db.facility.createMany({ data: facilityRows })
  await db.camera.createMany({ data: cameraRows })
  for (let i = 0; i < incidentRows.length; i += 500) await db.alarmEvent.createMany({ data: incidentRows.slice(i, i + 500) })
  for (let i = 0; i < actionRows.length; i += 500) await db.incidentAction.createMany({ data: actionRows.slice(i, i + 500) })

  const open = incidentRows.filter((x) => x.status === "NEW" || x.status === "IN_REVIEW" || x.status === "FORWARDED")
  return {
    facilities: facilityRows.length,
    cameras: cameraRows.length,
    incidents: incidentRows.length,
    critical: incidentRows.filter((x) => x.severity === "critical").length,
    open: open.length,
    actions: actionRows.length,
  }
}
