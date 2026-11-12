"use client"

import React, { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { SearchInput } from "@/components/shared/search-input"
import { StreamViewer } from "@/components/shared/stream-viewer"
import { SectorTabs, SectorLabel, NativeSelect, DISTRICT_OPTIONS } from "@/components/shared/filters"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SECTOR_META, type Sector } from "@/lib/sectors"
import { Building2, Video, AlertTriangle, Phone, ChevronDown, ChevronRight, Play } from "lucide-react"

interface FacilityCamera {
  id: string
  name: string
  status: string
  streamUrl: string
  info: string
}

interface Facility {
  id: string
  name: string
  sector: string
  district: string
  address: string
  owner: string | null
  responsibleName: string | null
  responsiblePhone: string | null
  camerasTotal: number
  camerasOnline: number
  openIncidents: number
  cameras?: FacilityCamera[]
}

export default function ObjectsPage() {
  const [sector, setSector] = useState<Sector | "all">("all")
  const [district, setDistrict] = useState("all")
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<Facility[]>([])
  const [summary, setSummary] = useState<{ sector: Sector; facilities: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [watch, setWatch] = useState<FacilityCamera | null>(null)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const s = sp.get("sector")
    if (s) setSector(s as Sector)
    const dist = sp.get("district")
    if (dist) setDistrict(dist)
    const q = sp.get("query")
    if (q) setQuery(q)
  }, [])

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const p = new URLSearchParams({ sector, district, withCameras: "1" })
        if (query) p.set("query", query)
        const r = await fetch(`/api/facilities?${p}`)
        const json = await r.json()
        setItems(json.items ?? [])
        setSummary(json.summary ?? [])
      } finally {
        setLoading(false)
      }
    }, query ? 300 : 0)
    return () => clearTimeout(t)
  }, [sector, district, query])

  const counts = useMemo(() => {
    const c: Partial<Record<Sector | "all", number>> = { all: summary.reduce((a, s) => a + s.facilities, 0) }
    summary.forEach((s) => (c[s.sector] = s.facilities))
    return c
  }, [summary])

  const totals = useMemo(
    () => ({
      facilities: items.length,
      cameras: items.reduce((a, f) => a + f.camerasTotal, 0),
      online: items.reduce((a, f) => a + f.camerasOnline, 0),
      open: items.reduce((a, f) => a + f.openIncidents, 0),
    }),
    [items]
  )

  return (
    <DashboardLayout breadcrumbs={[{ label: "Объекты" }, { label: sector === "all" ? "Все объекты" : SECTOR_META[sector].plural, active: true }]}>
      <div className="p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Реестр объектов и камер</h1>
          <p className="text-sm text-muted-foreground">
            Школы, детские сады, медицинские организации, камеры Департамента полиции и городские камеры г. Шымкент — в одном месте
          </p>
        </div>

        <SectorTabs value={sector} onChange={setSector} counts={counts} />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={<Building2 className="size-5" />} label="Объектов" value={totals.facilities} />
          <Kpi icon={<Video className="size-5" />} label="Камер подключено" value={totals.cameras} />
          <Kpi
            icon={<Video className="size-5" />}
            label="Камер онлайн"
            value={totals.cameras ? `${Math.round((totals.online / totals.cameras) * 100)}%` : "—"}
            sub={`${totals.cameras - totals.online} не в сети`}
          />
          <Kpi icon={<AlertTriangle className="size-5" />} label="Открытых инцидентов" value={totals.open} tone="red" />
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Поиск</span>
            <SearchInput value={query} onChange={setQuery} placeholder="Название или адрес..." />
          </div>
          <NativeSelect label="Район" value={district} onChange={setDistrict} options={DISTRICT_OPTIONS} />
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {loading && items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Загрузка...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Объекты не найдены</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/25">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8" />
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Объект</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Район / адрес</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Камеры</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Инциденты</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ответственный</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((f) => (
                    <React.Fragment key={f.id}>
                      <TableRow onClick={() => setExpanded(expanded === f.id ? null : f.id)} className="cursor-pointer hover:bg-secondary/15 border-b border-border/40">
                        <TableCell className="text-muted-foreground">
                          {expanded === f.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium text-foreground">{f.name}</div>
                          <SectorLabel sector={f.sector} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="text-foreground">{f.district}</div>
                          {f.address}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          <span className={f.camerasOnline < f.camerasTotal ? "text-amber-600 dark:text-amber-400" : "text-foreground"}>
                            {f.camerasOnline}/{f.camerasTotal}
                          </span>{" "}
                          <span className="text-muted-foreground">онлайн</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {f.openIncidents > 0 ? (
                            <a
                              href={`/incidents?facilityId=${f.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-red-600 dark:text-red-400 hover:underline"
                            >
                              {f.openIncidents} открыто
                            </a>
                          ) : (
                            <span className="text-muted-foreground">нет</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="text-foreground">{f.responsibleName ?? "—"}</div>
                          {f.responsiblePhone && (
                            <a href={`tel:${f.responsiblePhone}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-primary hover:underline">
                              <Phone className="size-3" /> {f.responsiblePhone}
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                      {expanded === f.id && (
                        <TableRow className="bg-secondary/10 hover:bg-secondary/10">
                          <TableCell colSpan={6} className="p-4">
                            <div className="text-[11px] text-muted-foreground mb-2">Владелец камер: {f.owner ?? SECTOR_META[f.sector as Sector]?.owner}</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {(f.cameras ?? []).map((c) => (
                                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-foreground truncate">{c.name}</div>
                                    <div className={`text-[10px] ${c.status === "online" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                                      {c.status === "online" ? "● в сети" : "● не в сети"}
                                    </div>
                                  </div>
                                  {!c.streamUrl.startsWith("demo://") && <Button size="sm" onClick={() => setWatch(c)} className="h-7 text-[11px] gap-1 cursor-pointer bg-primary text-primary-foreground">
                                    <Play className="size-3 fill-current" /> Смотреть
                                  </Button>}
                                </div>
                              ))}
                              {(f.cameras ?? []).length === 0 && <div className="text-xs text-muted-foreground">Камеры не привязаны</div>}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={watch !== null} onOpenChange={(o) => !o && setWatch(null)}>
        <DialogContent className="bg-card border border-border text-foreground rounded-2xl max-w-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Трансляция: {watch?.name}</DialogTitle>
          </DialogHeader>
          {watch && <StreamViewer streamUrl={watch.streamUrl} cameraName={watch.name} isActive={watch.status === "online"} />}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

function Kpi({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: "red" }) {
  return (
    <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-3 shadow-sm">
      <div className={`p-2.5 rounded-xl ${tone === "red" ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary"}`}>{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold text-foreground">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  )
}
