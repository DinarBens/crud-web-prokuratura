"use client"

import React, { useCallback, useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { IncidentDialog } from "@/components/incident-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { SearchInput } from "@/components/shared/search-input"
import {
  SectorTabs,
  SectorLabel,
  IncidentStatusBadge,
  NativeSelect,
  DISTRICT_OPTIONS,
  PERIOD_OPTIONS,
  formatDateTime,
  formatAgo,
} from "@/components/shared/filters"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SEVERITY_META, SLA_MINUTES, STATUS_META, type Sector, type Severity } from "@/lib/sectors"
import { AlertCircle, AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Incident {
  id: string
  type: string
  cameraName: string
  timestamp: string
  severity: string
  status: string
  forwardedTo: string | null
  isDemo?: boolean
  facility: { id: string; name: string; sector: string; district: string; address: string } | null
}

const STATUS_OPTIONS = [
  { value: "open", label: "Открытые" },
  { value: "all", label: "Все статусы" },
  ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label })),
]

const SEVERITY_OPTIONS = [
  { value: "all", label: "Любая" },
  { value: "critical", label: "Критично" },
  { value: "warning", label: "Предупреждение" },
  { value: "info", label: "Информация" },
]

export default function IncidentsPage() {
  const [sector, setSector] = useState<Sector | "all">("all")
  const [district, setDistrict] = useState("all")
  const [status, setStatus] = useState("open")
  const [severity, setSeverity] = useState("all")
  const [days, setDays] = useState("7")
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<Incident[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [facility, setFacility] = useState<{ id: string; name: string } | null>(null)

  // Начальный сектор из ?sector= (переход с карты/реестра)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const s = sp.get("sector")
    if (s) setSector(s as Sector)
    const dist = sp.get("district")
    if (dist) setDistrict(dist)
    const st = sp.get("status")
    if (st) setStatus(st)
    const d = sp.get("days")
    if (d) setDays(d)
    const fid = sp.get("facilityId")
    if (fid) setFacility({ id: fid, name: "" })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ sector, district, status, severity, days, limit: "300" })
      if (query) p.set("query", query)
      if (facility) p.set("facilityId", facility.id)
      const r = await fetch(`/api/incidents?${p}`)
      if (!r.ok) throw new Error()
      const json = await r.json()
      setItems(json.items)
      setTotal(json.total)
      if (facility && !facility.name && json.items[0]?.facility) {
        setFacility({ id: facility.id, name: json.items[0].facility.name })
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [sector, district, status, severity, days, query, facility])

  useEffect(() => {
    const t = setTimeout(load, query ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  // Автообновление каждые 30 секунд — дежурный режим
  useEffect(() => {
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  const isOverdue = (i: Incident) => {
    const sev = (i.severity as Severity) || "info"
    // Реакция просрочена: инцидент так никто и не взял в работу дольше норматива
    return i.status === "NEW" && Date.now() - new Date(i.timestamp).getTime() > SLA_MINUTES[sev] * 60000
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: "Надзор" }, { label: "Инциденты", active: true }]}>
      <div className="p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Инциденты по камерам города</h1>
            <p className="text-sm text-muted-foreground">
              Единый журнал: школы, детские сады, медицина, камеры ДП и городские камеры. Контроль сроков и полноты реагирования.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5 text-xs cursor-pointer w-fit">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Обновить
          </Button>
        </div>

        <SectorTabs value={sector} onChange={setSector} />

        <div className="bg-card border border-border p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 shadow-sm">
          <div className="flex flex-col gap-1.5 lg:col-span-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Поиск</span>
            <SearchInput value={query} onChange={setQuery} placeholder="Объект, адрес, камера..." />
          </div>
          <NativeSelect label="Район" value={district} onChange={setDistrict} options={DISTRICT_OPTIONS} />
          <NativeSelect label="Статус" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <NativeSelect label="Критичность" value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} />
          <NativeSelect label="Период" value={days} onChange={setDays} options={PERIOD_OPTIONS} />
        </div>

        {facility && (
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-foreground">
              Объект: {facility.name || "выбранный"}
            </span>
            <button type="button" onClick={() => setFacility(null)} className="text-primary hover:underline cursor-pointer">
              показать все объекты
            </button>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Найдено: <span className="font-semibold text-foreground">{total}</span>
          {total > items.length && ` (показаны последние ${items.length})`}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {!loading && items.length === 0 ? (
            <div className="p-16 flex flex-col items-center text-center gap-3">
              <AlertCircle className="size-10 text-muted-foreground" />
              <div className="text-base font-medium text-foreground">Инцидентов нет</div>
              <p className="text-sm text-muted-foreground max-w-xs">Измените фильтры или период</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/25">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[150px]">Время</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Событие</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Объект</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Район</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow
                      key={i.id}
                      onClick={() => setSelected(i.id)}
                      className="cursor-pointer hover:bg-secondary/15 border-b border-border/40"
                    >
                      <TableCell className="text-xs">
                        <div className="font-mono text-foreground">{formatDateTime(i.timestamp)}</div>
                        <div className="text-[10px] text-muted-foreground">{formatAgo(i.timestamp)}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={SEVERITY_META[(i.severity as Severity) || "info"].badge} className="text-[9px] uppercase tracking-wider" />
                          <span className="font-medium text-foreground">{i.type}</span>
                          {i.isDemo && <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1 text-[9px] font-medium text-amber-700 dark:text-amber-300">ДЕМО</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[260px]">{i.cameraName}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground">{i.facility?.name ?? "—"}</div>
                        {i.facility && <SectorLabel sector={i.facility.sector} />}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.facility?.district ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1 items-start">
                          <IncidentStatusBadge status={i.status} />
                          {isOverdue(i) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
                              <AlertTriangle className="size-3" /> просрочено
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <IncidentDialog incidentId={selected} onClose={() => setSelected(null)} onChanged={load} />
    </DashboardLayout>
  )
}
