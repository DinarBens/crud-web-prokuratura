"use client"

import React, { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { NativeSelect, PERIOD_OPTIONS, SectorDot } from "@/components/shared/filters"
import { SECTOR_META, type Sector } from "@/lib/sectors"
import { AlertTriangle, Building2, ChevronRight, ShieldAlert, Video } from "lucide-react"
import type { CityPoint } from "@/components/overview/overview-map"

const OverviewMap = dynamic(() => import("@/components/overview/overview-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[360px] w-full rounded-2xl" />,
})

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}

interface FacilityItem {
  id: string
  name: string
  sector: string
  district: string
  incidents: number
  open: number
  critical: number
  cameras: number
  camerasOnline: number
}
interface CityNode {
  name: string
  lat: number | null
  lng: number | null
  incidents: number
  open: number
  critical: number
  cameras: number
  camerasOnline: number
  facilities: number
  items: FacilityItem[]
}
interface RegionNode {
  name: string
  incidents: number
  open: number
  critical: number
  cameras: number
  camerasOnline: number
  facilities: number
  cities: CityNode[]
}

// Обзор: где происходят события — регион → город → объект, с картой и переходами в журнал
export default function OverviewPage() {
  const [days, setDays] = useState("30")
  const [regions, setRegions] = useState<RegionNode[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    setRegions(null)
    fetch(`/api/locations?days=${days}`)
      .then((r) => r.json())
      .then((j) => setRegions(j.regions ?? []))
      .catch(() => setRegions([]))
  }, [days])

  const totals = useMemo(() => {
    const t = { facilities: 0, incidents: 0, open: 0, critical: 0, cameras: 0, camerasOnline: 0 }
    regions?.forEach((r) => {
      t.facilities += r.facilities
      t.incidents += r.incidents
      t.open += r.open
      t.critical += r.critical
      t.cameras += r.cameras
      t.camerasOnline += r.camerasOnline
    })
    return t
  }, [regions])

  const points: CityPoint[] = useMemo(
    () =>
      (regions ?? []).flatMap((r) =>
        r.cities
          .filter((c) => c.lat != null && c.lng != null)
          .map((c) => ({ name: c.name, region: r.name, lat: c.lat!, lng: c.lng!, incidents: c.incidents, open: c.open, critical: c.critical, facilities: c.facilities }))
      ),
    [regions]
  )

  const selectedCity = regions?.flatMap((r) => r.cities.map((c) => ({ ...c, region: r.name }))).find((c) => c.name === selected)

  return (
    <DashboardLayout breadcrumbs={[{ label: "Обзор", active: true }]}>
      <div className="p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Обзор</h1>
            <p className="text-sm text-muted-foreground">Где происходят события: регионы, города и объекты. Нажмите на город, чтобы увидеть его объекты.</p>
          </div>
          <NativeSelect label="Период" value={days} onChange={setDays} options={PERIOD_OPTIONS} className="min-w-[140px]" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={<Building2 className="size-5" />} label="Объектов" value={regions ? totals.facilities : "…"} />
          <Kpi icon={<ShieldAlert className="size-5" />} label="Событий за период" value={regions ? totals.incidents : "…"} sub={regions ? `критичных: ${totals.critical}` : undefined} />
          <Kpi icon={<AlertTriangle className="size-5" />} label="Ждут реакции" value={regions ? totals.open : "…"} sub="за всё время" tone="red" href="/incidents?status=open" />
          <Kpi icon={<Video className="size-5" />} label="Камер в сети" value={regions ? `${totals.camerasOnline} из ${totals.cameras}` : "…"} href="/cameras" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 h-[460px] bg-card border border-border rounded-2xl shadow-sm p-1">
            <OverviewMap points={points} selected={selected} onSelect={(c) => setSelected(c === selected ? null : c)} />
          </div>

          <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-sm flex flex-col max-h-[460px]">
            <div className="px-5 pt-4 pb-3 border-b border-border/60 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-foreground">{selectedCity ? selectedCity.name : "Регионы и города"}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedCity ? `${selectedCity.region} · ${plural(selectedCity.facilities, "объект", "объекта", "объектов")}` : "Отсортировано по числу событий"}
                </div>
              </div>
              {selectedCity && (
                <button type="button" onClick={() => setSelected(null)} className="text-xs text-primary hover:underline cursor-pointer">
                  Все города
                </button>
              )}
            </div>
            <div className="overflow-y-auto p-2">
              {!regions ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Загрузка…</div>
              ) : regions.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Объектов пока нет. Администратор может загрузить данные в разделе «Импорт данных».
                </div>
              ) : selectedCity ? (
                selectedCity.items
                  .slice()
                  .sort((a, b) => b.open - a.open || b.incidents - a.incidents)
                  .map((f) => (
                    <a key={f.id} href={`/incidents?facilityId=${f.id}&status=all&days=${days}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary/40">
                      <SectorDot sector={f.sector} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-foreground truncate">{f.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {SECTOR_META[f.sector as Sector]?.label ?? "Объект"} · камер в сети {f.camerasOnline}/{f.cameras}
                        </div>
                      </div>
                      <Counts incidents={f.incidents} open={f.open} />
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </a>
                  ))
              ) : (
                regions.map((r) => (
                  <div key={r.name} className="mb-2">
                    <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{r.name}</div>
                    {r.cities.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => setSelected(c.name)}
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary/40 text-left cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {plural(c.facilities, "объект", "объекта", "объектов")} · камер в сети {c.camerasOnline}/{c.cameras}
                          </div>
                        </div>
                        <Counts incidents={c.incidents} open={c.open} />
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

function Counts({ incidents, open }: { incidents: number; open: number }) {
  return (
    <div className="text-right shrink-0">
      <div className="text-sm font-semibold text-foreground">{incidents}</div>
      <div className={`text-[10px] ${open ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>{open ? `${open} ждут` : "событий"}</div>
    </div>
  )
}

function Kpi({ icon, label, value, sub, tone, href }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: "red"; href?: string }) {
  const body = (
    <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-3 shadow-sm h-full hover:border-primary/40 transition-colors">
      <div className={`p-2.5 rounded-xl ${tone === "red" ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold text-foreground">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  )
  return href ? <a href={href}>{body}</a> : body
}
