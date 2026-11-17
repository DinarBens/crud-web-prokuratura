// Однократный импорт данных из qoz-vision (Supabase/Postgres) в базу платформы.
// Источник только читается. Повторный запуск безопасен: записи сопоставляются по externalId / externalKey.
//
// Переменные: SOURCE_DATABASE_URL — строка подключения к базе qoz-vision;
// SOURCE_SUPABASE_URL + SOURCE_SUPABASE_SERVICE_ROLE_KEY — для копирования видео и кадров из хранилища;
// IMPORT_ADMIN_EMAILS — кому дать роль администратора (через запятую), по умолчанию admin@gmail.com.

import postgres from "postgres"
import type { Prisma } from "@prisma/client"
import { db } from "./db"
import { CITIES, KNOWN_ORGANIZATIONS, UNKNOWN_CITY, cityByName, guessCity } from "./locations"
import { describeCategory } from "./categories"
import { SECTOR_META, type Sector } from "./sectors"
import { bucketConfigured, objectExists, uploadStream } from "./media"

type Row = Record<string, unknown>

export interface ImportState {
  phase: "idle" | "rows" | "media" | "done" | "error"
  startedAt: string | null
  finishedAt: string | null
  message: string
  counts: Record<string, number>
  media: { total: number; done: number; copied: number; skipped: number; failed: number }
  errors: string[]
}

const g = globalThis as unknown as { __importState?: ImportState }
export const importState: ImportState = (g.__importState ??= {
  phase: "idle",
  startedAt: null,
  finishedAt: null,
  message: "",
  counts: {},
  media: { total: 0, done: 0, copied: 0, skipped: 0, failed: 0 },
  errors: [],
})

export function sourceConfigured() {
  return !!process.env.SOURCE_DATABASE_URL
}

function connectSource() {
  const url = process.env.SOURCE_DATABASE_URL!
  return postgres(url, {
    max: 2,
    prepare: false,
    connect_timeout: 20,
    ssl: /supabase|sslmode=require/.test(url) ? "require" : undefined,
  })
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim()
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v))
const date = (v: unknown) => (v instanceof Date ? v : v ? new Date(String(v)) : new Date())

async function tryRows(sql: postgres.Sql, query: string): Promise<Row[]> {
  try {
    return (await sql.unsafe(query)) as unknown as Row[]
  } catch (e) {
    importState.errors.push(`${query.slice(0, 60)}…: ${e instanceof Error ? e.message : e}`)
    return []
  }
}

function sectorFor(org: string, placement?: string): Sector {
  const s = org.toLowerCase()
  if (/сад|ясли|kindergarten/.test(s)) return "KINDERGARTEN"
  if (/больниц|поликлиник|интернат|медиц|hospital/.test(s)) return "MEDICAL"
  if (/полици|уп |дп /.test(s)) return "POLICE"
  if (placement === "street" && !/школ|лицей|гимназ/.test(s)) return "CITY"
  return "SCHOOL"
}

const NVR_LIKE = /^(DS-N316|XVR)/i
const IPC_EQUIPMENT_CHANNEL = /^(IPC325|IPC2123)/i

// Тот же способ построения адреса HLS, что в qoz-vision (lib/cameras/cameras-registry.ts)
function streamUrlFor(c: Row): string {
  const url = str(c.stream_url)
  if (url && str(c.stream_type) === "hls") return url
  const base = (process.env.CAMERA_HLS_BASE || "https://v-guard.kz/hls").replace(/\/$/, "")
  const deviceType = str(c.device_type)
  if (NVR_LIKE.test(deviceType) || IPC_EQUIPMENT_CHANNEL.test(deviceType)) {
    return `${base}/camera_${str(c.equipment_id)}_sub_${num(c.unique_channel) ?? 1}/video1_stream.m3u8`
  }
  const id = str(c.legacy_vms_id) || str(c.id)
  return url && !url.startsWith("rtsp") ? url : `${base}/camera_${id}_sub_1/video1_stream.m3u8`
}

// Объект (организация) — создаётся один раз на название
async function ensureFacility(org: string, address: string | null, placement?: string): Promise<string> {
  const name = org || "Организация не указана"
  const key = `org:${name}`
  const existing = await db.facility.findUnique({ where: { externalKey: key }, select: { id: true } })
  if (existing) return existing.id
  const city = cityByName(KNOWN_ORGANIZATIONS[name]) ?? guessCity(name, address)
  const sector = sectorFor(name, placement)
  let facilityName = name
  if (await db.facility.findUnique({ where: { name: facilityName } })) facilityName = `${name} (${city?.name ?? "импорт"})`
  const f = await db.facility.create({
    data: {
      name: facilityName,
      externalKey: key,
      sector,
      region: city?.region ?? UNKNOWN_CITY,
      city: city?.name ?? UNKNOWN_CITY,
      district: "",
      address: address || (city ? `г. ${city.name}` : "Адрес не указан"),
      latitude: city?.lat ?? 48.0196,
      longitude: city?.lng ?? 66.9237,
      owner: SECTOR_META[sector].owner.replace(/ г\. Шымкент$/, ""),
    },
  })
  return f.id
}

export async function importRows() {
  const sql = connectSource()
  const counts: Record<string, number> = {}
  try {
    // ---- пользователи ----
    const admins = (process.env.IMPORT_ADMIN_EMAILS || "admin@gmail.com").split(",").map((e) => e.trim().toLowerCase())
    const users = await tryRows(sql, "select email, password_hash from public.app_users")
    for (const u of users) {
      const email = str(u.email).toLowerCase()
      if (!email || !str(u.password_hash)) continue
      await db.user.upsert({
        where: { email },
        update: {},
        create: { email, password: str(u.password_hash), name: email.split("@")[0], role: admins.includes(email) ? "ADMIN" : "PROSECUTOR" },
      })
    }
    counts.users = users.length

    // ---- камеры ----
    const groups = await tryRows(sql, "select id, name from public.camera_groups")
    const groupName = new Map(groups.map((r) => [str(r.id), str(r.name)]))
    const cameras = await tryRows(sql, "select * from public.cameras")
    const cameraByKey = new Map<string, { id: string; facilityId: string; name: string }>()
    const usedNames = new Set((await db.camera.findMany({ select: { name: true } })).map((c) => c.name))
    for (const c of cameras) {
      const externalId = `qoz:${str(c.id)}`
      const org = str(c.organization_name)
      const facilityId = await ensureFacility(org, str(c.address) || null, str(c.category))
      const existing = await db.camera.findUnique({ where: { externalId }, select: { id: true, name: true } })
      let id = existing?.id
      let camName = existing?.name ?? ""
      if (!id) {
        let name = str(c.name) || str(c.device_key)
        if (usedNames.has(name)) name = `${name} · ${org || "без организации"}`
        if (usedNames.has(name)) name = `${name} · ${str(c.id).slice(0, 6)}`
        usedNames.add(name)
        const created = await db.camera.create({
          data: {
            externalId,
            name,
            info: [str(c.device_type) || "Камера", org].filter(Boolean).join(" | "),
            streamUrl: streamUrlFor(c),
            facilityId,
            organization: org || null,
            deviceType: str(c.device_type) || null,
            equipmentId: str(c.equipment_id) || null,
            channel: num(c.unique_channel),
            placement: str(c.category) || null,
            groupName: groupName.get(str(c.group_id)) || null,
            status: c.is_enabled === false ? "offline" : "online",
          },
        })
        id = created.id
        camName = created.name
      }
      for (const k of [str(c.device_key), str(c.id), str(c.name)]) if (k) cameraByKey.set(k, { id, facilityId, name: camName })
    }
    counts.cameras = cameras.length

    const resolveCamera = async (label: string) => {
      const hit = cameraByKey.get(label)
      if (hit) return hit
      // Название камеры/организации из журнала: «Школа №1, Жезказган» и т.п.
      const facilityId = await ensureFacility(label || "Организация не указана", null)
      return { id: null as string | null, facilityId, name: "" }
    }

    // ---- видеожурнал инцидентов ----
    const incidents = await tryRows(sql, "select * from public.incidents where coalesce(hidden, false) = false order by created_at")
    let batch: Prisma.AlarmEventCreateManyInput[] = []
    const flush = async () => {
      if (batch.length) await db.alarmEvent.createMany({ data: batch, skipDuplicates: true })
      batch = []
    }
    for (const r of incidents) {
      const cat = describeCategory(str(r.category))
      const label = str(r.camera_label)
      const cam = await resolveCamera(label)
      const analysis = (r.analysis ?? null) as Prisma.InputJsonValue | null
      const summary =
        str(r.description) ||
        (analysis && typeof analysis === "object" && "summary" in analysis ? str((analysis as Row).summary) : "") ||
        `Видеоаналитика: «${cat.label}»`
      batch.push({
        externalId: `journal:${str(r.id)}`,
        source: "journal",
        type: cat.label,
        category: cat.code,
        severity: cat.severity,
        title: str(r.title) || null,
        cameraName: cam.name || label || "Камера не указана",
        cameraId: cam.id,
        facilityId: cam.facilityId,
        timestamp: date(r.created_at),
        details: summary,
        confidence: num(r.confidence),
        status: "NEW",
        sourceMediaPath: str(r.storage_path) || null,
        mediaType: "video",
        analysis: analysis ?? undefined,
      })
      if (batch.length >= 200) await flush()
    }
    await flush()
    counts.journal = incidents.length

    // ---- живой мониторинг (неразобранные события) ----
    const live = await tryRows(
      sql,
      `select e.*, s.camera_id as session_camera_id, s.hls_url
         from public.live_incident_events e
         left join public.live_monitor_sessions s on s.id = e.session_id
        order by e.captured_at`
    )
    for (const r of live) {
      const cat = describeCategory(str(r.incident_type))
      const deviceKey = str(r.device_id)
      const cam = cameraByKey.get(deviceKey) ?? cameraByKey.get(str(r.session_camera_id)) ?? (await resolveCamera(deviceKey))
      const details = [str(r.description), str(r.location_context) && `Место: ${str(r.location_context)}`].filter(Boolean).join(". ")
      const evidence = str(r.evidence_storage_path)
      batch.push({
        externalId: `live:${str(r.id)}`,
        source: "live",
        type: cat.label,
        category: cat.code,
        severity: cat.severity,
        cameraName: cam.name || deviceKey || "Камера не указана",
        cameraId: cam.id,
        facilityId: cam.facilityId,
        timestamp: date(r.captured_at),
        details: details || `Живой мониторинг: «${cat.label}»`,
        confidence: { high: 0.9, medium: 0.7, low: 0.5 }[str(r.confidence).toLowerCase()] ?? num(r.confidence),
        status: "NEW",
        sourceMediaPath: evidence || null,
        mediaType: evidence ? (/\.(mp4|webm|mov)$/i.test(evidence) ? "video" : "image") : null,
      })
      if (batch.length >= 200) await flush()
    }
    await flush()
    counts.live = live.length
    counts.facilities = await db.facility.count({ where: { isDemo: false } })
    return counts
  } finally {
    await sql.end({ timeout: 5 })
  }
}

// Копирование видео и кадров из хранилища qoz-vision в бакет платформы
export async function copyMedia() {
  const base = (process.env.SOURCE_SUPABASE_URL || "").replace(/\/$/, "")
  const key = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY || ""
  const bucket = process.env.SOURCE_STORAGE_BUCKET || "records"
  const maxBytes = (Number(process.env.MEDIA_MAX_MB) || 2048) * 1024 * 1024
  if (!base || !key || !bucketConfigured()) {
    importState.errors.push("Медиа не копировались: не заданы SOURCE_SUPABASE_URL / SOURCE_SUPABASE_SERVICE_ROLE_KEY или бакет")
    return
  }
  const pending = await db.alarmEvent.findMany({
    where: { sourceMediaPath: { not: null }, mediaKey: null },
    select: { id: true, sourceMediaPath: true },
  })
  importState.media = { total: pending.length, done: 0, copied: 0, skipped: 0, failed: 0 }
  let next = 0
  const worker = async () => {
    while (next < pending.length) {
      const item = pending[next++]
      const path = item.sourceMediaPath!.replace(/^\/+/, "")
      const objectKey = `media/${path}`
      try {
        if (!(await objectExists(objectKey))) {
          const r = await fetch(`${base}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
            headers: { Authorization: `Bearer ${key}`, apikey: key },
          })
          if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`)
          const size = Number(r.headers.get("content-length") || 0)
          if (size > maxBytes) {
            importState.media.skipped++
            await r.body.cancel()
            continue
          }
          await uploadStream(objectKey, r.body, r.headers.get("content-type"))
          importState.media.copied++
        }
        await db.alarmEvent.update({ where: { id: item.id }, data: { mediaKey: objectKey } })
      } catch (e) {
        importState.media.failed++
        if (importState.errors.length < 50) importState.errors.push(`${path}: ${e instanceof Error ? e.message : e}`)
      } finally {
        importState.media.done++
      }
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
}

let running: Promise<void> | null = null

export function startImport(opts: { media: boolean }) {
  if (running) return false
  importState.phase = "rows"
  importState.startedAt = new Date().toISOString()
  importState.finishedAt = null
  importState.errors = []
  importState.message = "Копируем записи…"
  running = (async () => {
    try {
      importState.counts = await importRows()
      console.log("[import] записи загружены:", JSON.stringify(importState.counts), importState.errors.length ? `предупреждения: ${importState.errors.join(" | ")}` : "")
      if (opts.media) {
        importState.phase = "media"
        importState.message = "Копируем видео и кадры…"
        await copyMedia()
      }
      importState.phase = "done"
      importState.message = "Импорт завершён"
      console.log("[import] завершён; медиа:", JSON.stringify(importState.media))
    } catch (e) {
      importState.phase = "error"
      importState.message = e instanceof Error ? e.message : String(e)
      console.error("[import] ошибка:", importState.message)
    } finally {
      importState.finishedAt = new Date().toISOString()
      running = null
    }
  })()
  return true
}

export { CITIES }
