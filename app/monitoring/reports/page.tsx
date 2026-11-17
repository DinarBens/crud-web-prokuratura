"use client"

import React, { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { CitySelect, IncidentStatusBadge, NativeSelect, PERIOD_OPTIONS, SOURCE_OPTIONS, formatDateTime } from "@/components/shared/filters"
import { SECTORS, SECTOR_META } from "@/lib/sectors"
import { Download, FileSpreadsheet } from "lucide-react"

interface Row {
  id: string
  timestamp: string
  type: string
  title: string | null
  cameraName: string
  status: string
  facility: { name: string; city: string } | null
}

const STATUS_OPTIONS = [
  { value: "all", label: "Все статусы" },
  { value: "open", label: "Открытые" },
  { value: "RESOLVED", label: "Решённые" },
  { value: "FALSE_ALARM", label: "Ложные" },
]

// Отчёты: выбор среза и выгрузка в Excel (CSV)
export default function ReportsPage() {
  const [days, setDays] = useState("30")
  const [city, setCity] = useState("all")
  const [sector, setSector] = useState("all")
  const [status, setStatus] = useState("all")
  const [source, setSource] = useState("all")
  const [rows, setRows] = useState<Row[] | null>(null)
  const [total, setTotal] = useState(0)

  const qs = useMemo(() => {
    const p = new URLSearchParams({ days })
    if (city !== "all") p.set("city", city)
    if (sector !== "all") p.set("sector", sector)
    if (status !== "all") p.set("status", status)
    if (source !== "all") p.set("source", source)
    return p.toString()
  }, [days, city, sector, status, source])

  useEffect(() => {
    setRows(null)
    fetch(`/api/incidents?${qs}&limit=15`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.items ?? [])
        setTotal(j.total ?? 0)
      })
      .catch(() => setRows([]))
  }, [qs])

  return (
    <DashboardLayout breadcrumbs={[{ label: "Отчёты", active: true }]}>
      <div className="p-6 flex flex-col gap-5 max-w-6xl mx-auto w-full">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Отчёты</h1>
          <p className="text-sm text-muted-foreground">Выберите срез и выгрузите инциденты в таблицу Excel.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <NativeSelect label="Период" value={days} onChange={setDays} options={PERIOD_OPTIONS} />
            <CitySelect value={city} onChange={setCity} />
            <NativeSelect
              label="Сфера"
              value={sector}
              onChange={setSector}
              options={[{ value: "all", label: "Все сферы" }, ...SECTORS.map((s) => ({ value: s, label: SECTOR_META[s].label }))]}
            />
            <NativeSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            <NativeSelect label="Источник" value={source} onChange={setSource} options={SOURCE_OPTIONS} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60 pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{rows ? `${total} записей в отчёте` : "Подсчёт…"}</div>
                <div className="text-xs text-muted-foreground">Файл CSV открывается в Excel; колонки: дата, город, объект, камера, событие, статус, описание</div>
              </div>
            </div>
            <Button disabled={!total} className="gap-2" onClick={() => (window.location.href = `/api/incidents/export?${qs}`)}>
              <Download className="size-4" /> Скачать для Excel
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60 text-sm font-semibold text-foreground">Предпросмотр (последние 15)</div>
          {!rows ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Загрузка…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Нет событий по выбранным условиям</div>
          ) : (
            <div className="divide-y divide-border/60">
              {rows.map((r) => (
                <div key={r.id} className="px-5 py-2.5 grid grid-cols-[130px_1fr_auto] gap-3 items-center text-sm">
                  <span className="text-xs text-muted-foreground">{formatDateTime(r.timestamp)}</span>
                  <div className="min-w-0">
                    <div className="truncate text-foreground">{r.title || r.type}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {[r.facility?.city, r.facility?.name, r.cameraName].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <IncidentStatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
