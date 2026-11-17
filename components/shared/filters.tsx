"use client"

import React, { useEffect, useState } from "react"
import { SECTORS, SECTOR_META, STATUS_META, type Sector, type IncidentStatus } from "@/lib/sectors"
import { cn } from "@/lib/utils"

// Вкладки секторов: Все / Школы / Детсады / Медицина / ДП / Город
export function SectorTabs({
  value,
  onChange,
  counts,
}: {
  value: Sector | "all"
  onChange: (v: Sector | "all") => void
  counts?: Partial<Record<Sector | "all", number>>
}) {
  const items: (Sector | "all")[] = ["all", ...SECTORS]
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-border/80 bg-secondary/40 p-1 w-fit" role="tablist">
      {items.map((s) => {
        const active = value === s
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s)}
            className={cn(
              "h-8 cursor-pointer rounded-lg px-3 text-xs font-medium transition-colors flex items-center gap-1.5",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s !== "all" && <SectorDot sector={s} />}
            {s === "all" ? "Все объекты" : SECTOR_META[s].plural}
            {counts?.[s] !== undefined && (
              <span className="font-mono text-[10px] text-muted-foreground">{counts[s]}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function SectorDot({ sector, className }: { sector: string; className?: string }) {
  const color = SECTOR_META[sector as Sector]?.color ?? "#71717a"
  return <span className={cn("inline-block size-2 rounded-full shrink-0", className)} style={{ background: color }} aria-hidden />
}

export function SectorLabel({ sector }: { sector: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
      <SectorDot sector={sector} />
      {SECTOR_META[sector as Sector]?.label ?? "Без объекта"}
    </span>
  )
}

export function IncidentStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as IncidentStatus] ?? STATUS_META.NEW
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap", meta.className)}>
      {meta.label}
    </span>
  )
}

export function NativeSelect({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  label: string
  className?: string
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

// Города и области из реестра объектов (а не фиксированный список) — для фильтров
export interface LocationTree {
  regions: { name: string; incidents: number; cities: { name: string; incidents: number }[] }[]
}

let locationsCache: Promise<LocationTree> | null = null
export function useLocations(): LocationTree | null {
  const [data, setData] = useState<LocationTree | null>(null)
  useEffect(() => {
    locationsCache ??= fetch("/api/locations").then((r) => r.json())
    locationsCache.then(setData).catch(() => setData({ regions: [] }))
  }, [])
  return data
}

// Выбор города с группировкой по областям
export function CitySelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const tree = useLocations()
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Город</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="all">Все города</option>
        {tree?.regions.map((r) => (
          <optgroup key={r.name} label={r.name}>
            {r.cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
        {value !== "all" && !tree?.regions.some((r) => r.cities.some((c) => c.name === value)) && <option value={value}>{value}</option>}
      </select>
    </label>
  )
}

export const SOURCE_OPTIONS = [
  { value: "all", label: "Все источники" },
  { value: "journal", label: "Видеожурнал" },
  { value: "live", label: "Живой мониторинг" },
  { value: "manual", label: "Внесены вручную" },
]

export const PERIOD_OPTIONS = [
  { value: "1", label: "Сутки" },
  { value: "7", label: "7 дней" },
  { value: "30", label: "30 дней" },
  { value: "90", label: "90 дней" },
  { value: "365", label: "Год" },
]

export function formatDateTime(v: string | Date) {
  return new Date(v).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  })
}

export function formatAgo(v: string | Date) {
  const min = Math.round((Date.now() - new Date(v).getTime()) / 60000)
  if (min < 1) return "только что"
  if (min < 60) return `${min} мин назад`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ч назад`
  return `${Math.floor(h / 24)} дн назад`
}
