"use client"

import React, { createContext, useContext, useState } from "react"

// Лёгкие графики без внешних библиотек: горизонтальные бары, столбцы по дням, тепловая карта.
// Подсказка при наведении — общая для всех графиков страницы.

type TipState = { x: number; y: number; lines: string[] } | null
const TipCtx = createContext<(t: TipState) => void>(() => {})

export function ChartTooltipProvider({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = useState<TipState>(null)
  return (
    <TipCtx.Provider value={setTip}>
      {children}
      {tip && (
        <div
          className="pointer-events-none fixed z-[2000] rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg"
          style={{ left: tip.x + 12, top: tip.y + 12 }}
        >
          {tip.lines.map((l, i) => (
            <div key={i} className={i === 0 ? "font-semibold" : "text-muted-foreground"}>{l}</div>
          ))}
        </div>
      )}
    </TipCtx.Provider>
  )
}

function useTip(lines: string[]) {
  const set = useContext(TipCtx)
  return {
    onMouseMove: (e: React.MouseEvent) => set({ x: e.clientX, y: e.clientY, lines }),
    onMouseLeave: () => set(null),
  }
}

export function ChartCard({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-4 ${className}`}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

// ---- Горизонтальные бары (одна серия, подпись и значение у каждой строки) ----

export interface BarRow {
  key: string
  label: string
  value: number
  color?: string
  extra?: string // доп. строка для подсказки
  href?: string
}

export function HBarList({ rows, emptyText = "Нет данных", unit = "" }: { rows: BarRow[]; emptyText?: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0 || rows.every((r) => r.value === 0)) {
    return <div className="text-xs text-muted-foreground py-6 text-center">{emptyText}</div>
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <HBar key={r.key} row={r} max={max} unit={unit} />
      ))}
    </ul>
  )
}

function HBar({ row, max, unit }: { row: BarRow; max: number; unit: string }) {
  const tip = useTip([row.label, `${row.value}${unit}`, ...(row.extra ? [row.extra] : [])])
  const content = (
    <>
      <div className="flex items-center justify-between gap-3 text-xs mb-1">
        <span className="text-foreground truncate">{row.label}</span>
        <span className="font-mono text-muted-foreground shrink-0">{row.value}{unit}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-secondary/60">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${(row.value / max) * 100}%`, background: row.color ?? "var(--primary)", minWidth: row.value ? 4 : 0 }}
        />
      </div>
    </>
  )
  return (
    <li {...tip} className="py-0.5">
      {row.href ? <a href={row.href} className="block hover:opacity-80">{content}</a> : content}
    </li>
  )
}

// ---- Столбцы по дням (стек по критичности) ----

export const SEVERITY_COLORS = {
  critical: "#dc2626",
  warning: "#d97706",
  info: "#16a34a",
}

export function DailyStacked({ days }: { days: { date: string; critical: number; warning: number; info: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.critical + d.warning + d.info))
  const showEvery = days.length > 31 ? 7 : days.length > 14 ? 3 : 1
  return (
    <div className="flex flex-col gap-3">
      <Legend
        items={[
          { label: "Критично", color: SEVERITY_COLORS.critical },
          { label: "Предупреждение", color: SEVERITY_COLORS.warning },
          { label: "Информация", color: SEVERITY_COLORS.info },
        ]}
      />
      <div className="flex items-end gap-[3px] h-44 border-b border-border">
        {days.map((d) => (
          <DayColumn key={d.date} d={d} max={max} />
        ))}
      </div>
      <div className="flex gap-[3px] -mt-1">
        {days.map((d, i) => (
          <div key={d.date} className="flex-1 text-center text-[10px] text-muted-foreground font-mono">
            {i % showEvery === 0 ? d.date.slice(8, 10) + "." + d.date.slice(5, 7) : ""}
          </div>
        ))}
      </div>
    </div>
  )
}

function DayColumn({ d, max }: { d: { date: string; critical: number; warning: number; info: number }; max: number }) {
  const total = d.critical + d.warning + d.info
  const label = new Date(d.date + "T00:00:00").toLocaleDateString("ru-RU", { day: "2-digit", month: "long", weekday: "short" })
  const tip = useTip([label, `Всего: ${total}`, `Критично: ${d.critical}`, `Предупреждения: ${d.warning}`, `Информация: ${d.info}`])
  const seg = (v: number, color: string, top: boolean) =>
    v > 0 ? (
      <div style={{ height: `${(v / max) * 100}%`, background: color }} className={top ? "rounded-t-[4px]" : ""} />
    ) : null
  // Порядок сверху вниз: critical (верх), warning, info (у оси). 2px зазор между сегментами.
  const order = [
    { v: d.critical, c: SEVERITY_COLORS.critical },
    { v: d.warning, c: SEVERITY_COLORS.warning },
    { v: d.info, c: SEVERITY_COLORS.info },
  ].filter((s) => s.v > 0)
  return (
    <div {...tip} className="flex-1 h-full flex flex-col justify-end gap-[2px] cursor-default hover:opacity-85">
      {order.map((s, i) => (
        <React.Fragment key={i}>{seg(s.v, s.c, i === 0)}</React.Fragment>
      ))}
    </div>
  )
}

// ---- Тепловая карта день недели × час ----

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

export function WeekHourHeatmap({ heat }: { heat: number[][] }) {
  const max = Math.max(1, ...heat.flat())
  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      <div className="grid gap-[2px] min-w-[560px]" style={{ gridTemplateColumns: "28px repeat(24, minmax(0, 1fr))" }}>
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-[9px] text-center text-muted-foreground font-mono">{h % 3 === 0 ? h : ""}</div>
        ))}
        {heat.map((row, wd) => (
          <React.Fragment key={wd}>
            <div className="text-[10px] text-muted-foreground flex items-center">{WEEKDAYS[wd]}</div>
            {row.map((v, h) => (
              <HeatCell key={h} v={v} max={max} label={`${WEEKDAYS[wd]}, ${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59`} />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        меньше
        <div className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(to right, color-mix(in oklab, var(--primary) 8%, transparent), var(--primary))" }} />
        больше · время Алматы
      </div>
    </div>
  )
}

function HeatCell({ v, max, label }: { v: number; max: number; label: string }) {
  const tip = useTip([label, `Событий: ${v}`])
  const pct = v === 0 ? 4 : 15 + Math.round((v / max) * 85)
  return (
    <div
      {...tip}
      className="aspect-square rounded-[3px]"
      style={{ background: `color-mix(in oklab, var(--primary) ${pct}%, transparent)` }}
    />
  )
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
