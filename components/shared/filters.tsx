"use client"

import React from "react"
import { SECTORS, SECTOR_META, DISTRICTS, STATUS_META, type Sector, type IncidentStatus } from "@/lib/sectors"
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

export const DISTRICT_OPTIONS = [{ value: "all", label: "Все районы" }, ...DISTRICTS.map((d) => ({ value: d, label: `${d} район` }))]

export const PERIOD_OPTIONS = [
  { value: "1", label: "Сутки" },
  { value: "7", label: "7 дней" },
  { value: "30", label: "30 дней" },
  { value: "90", label: "90 дней" },
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
