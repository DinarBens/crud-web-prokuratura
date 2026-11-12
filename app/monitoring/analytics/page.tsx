"use client"

import React, { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { SectorTabs, NativeSelect, DISTRICT_OPTIONS, PERIOD_OPTIONS, SectorDot } from "@/components/shared/filters"
import { ChartTooltipProvider, ChartCard, HBarList, DailyStacked, WeekHourHeatmap } from "@/components/analytics/charts"
import { SECTOR_META, type Sector } from "@/lib/sectors"
import { Activity, ShieldAlert, Clock, AlertTriangle, Timer, Ban, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Analytics {
  days: number
  totals: {
    total: number
    critical: number
    warning: number
    info: number
    open: number
    overdue: number
    resolved: number
    falseAlarm: number
    avgReactionMin: number | null
    falseAlarmRate: number
    demo: number
  }
  bySector: { sector: Sector; label: string; total: number; critical: number; open: number }[]
  byDistrict: { district: string; total: number; critical: number; open: number }[]
  byDay: { date: string; critical: number; warning: number; info: number }[]
  heat: number[][]
  topTypes: { type: string; count: number }[]
  topFacilities: { id: string; name: string; sector: string; district: string; total: number; critical: number }[]
  camerasBySector: { sector: Sector; label: string; total: number; online: number }[]
}

export default function AnalyticsPage() {
  const [sector, setSector] = useState<Sector | "all">("all")
  const [district, setDistrict] = useState("all")
  const [days, setDays] = useState("7")
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Район и сектор из адреса (переход с карты: ?district=Абайский)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const dist = sp.get("district")
    if (dist) setDistrict(dist)
    const s = sp.get("sector")
    if (s) setSector(s as Sector)
  }, [])

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/analytics?${new URLSearchParams({ sector, district, days })}`)
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || "Ошибка")
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setLoading(false)
    }
  }, [sector, district, days])

  useEffect(() => {
    load()
  }, [load])

  const t = data?.totals
  const [demoBusy, setDemoBusy] = useState(false)
  const [demoMsg, setDemoMsg] = useState<string | null>(null)

  // Демо-данные (имитация): загрузить или убрать. Реальные записи не затрагиваются.
  const toggleDemo = async (enable: boolean) => {
    if (!enable && !window.confirm("Убрать все демонстрационные объекты, камеры и инциденты? Реальные данные не затрагиваются.")) return
    setDemoBusy(true)
    setDemoMsg(null)
    try {
      const r = await fetch("/api/admin/demo", { method: enable ? "POST" : "DELETE" })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || "Ошибка")
      setDemoMsg(enable ? `Загружено: ${json.facilities} объектов, ${json.incidents} инцидентов` : "Демо-данные убраны")
      await load()
    } catch (e) {
      setDemoMsg(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setDemoBusy(false)
    }
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: "Мониторинг" }, { label: "Аналитика", active: true }]}>
      <ChartTooltipProvider>
        <div className="p-6 flex flex-col gap-5 max-w-7xl mx-auto w-full">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Аналитика инцидентов г. Шымкент</h1>
              <p className="text-sm text-muted-foreground">
                Сводка по секторам, районам и времени суток, контроль сроков реагирования
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load} className="gap-1.5 text-xs cursor-pointer w-fit">
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Обновить
            </Button>
          </div>

          {/* Фильтры в одну строку над графиками */}
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <SectorTabs value={sector} onChange={setSector} />
            <div className="flex gap-3 lg:ml-auto">
              <NativeSelect label="Район" value={district} onChange={setDistrict} options={DISTRICT_OPTIONS} className="min-w-[180px]" />
              <NativeSelect label="Период" value={days} onChange={setDays} options={PERIOD_OPTIONS} className="min-w-[120px]" />
            </div>
          </div>

          {error && <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">{error}</div>}

          {t && (t.demo > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              <span>
                Включены демонстрационные данные (имитация): {t.demo} из {t.total} событий за период. Реальные записи не изменены.
                {demoMsg && <span className="ml-2 font-medium">{demoMsg}</span>}
              </span>
              <button type="button" disabled={demoBusy} onClick={() => toggleDemo(false)} className="w-fit cursor-pointer font-medium underline disabled:opacity-50">
                Убрать демо-данные
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
              {demoMsg && <span>{demoMsg}</span>}
              <button type="button" disabled={demoBusy} onClick={() => toggleDemo(true)} className="cursor-pointer underline disabled:opacity-50">
                {demoBusy ? "Загружаем…" : "Загрузить демо-данные для показа"}
              </button>
            </div>
          ))}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <Kpi icon={<Activity className="size-5" />} label="Всего событий" value={t?.total} />
            <Kpi icon={<ShieldAlert className="size-5" />} label="Критичные" value={t?.critical} tone="red" />
            <Kpi icon={<Clock className="size-5" />} label="Открытые" value={t?.open} tone="amber" href="/incidents" />
            <Kpi icon={<AlertTriangle className="size-5" />} label="Просрочена реакция" value={t?.overdue} tone="red" href="/incidents" />
            <Kpi icon={<Timer className="size-5" />} label="Среднее время реакции" value={t?.avgReactionMin != null ? `${t.avgReactionMin} мин` : "—"} />
            <Kpi icon={<Ban className="size-5" />} label="Ложные срабатывания" value={t ? `${t.falseAlarmRate}%` : undefined} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <ChartCard title="Динамика по дням" subtitle="Количество событий по критичности" className="lg:col-span-3">
              {data && <DailyStacked days={data.byDay} />}
            </ChartCard>
            <ChartCard title="По секторам" subtitle="Где происходят события" className="lg:col-span-2">
              {data && (
                <HBarList
                  rows={data.bySector.map((s) => ({
                    key: s.sector,
                    label: s.label,
                    value: s.total,
                    color: SECTOR_META[s.sector].color,
                    extra: `Критичных: ${s.critical} · открытых: ${s.open}`,
                    href: `/incidents?sector=${s.sector}`,
                  }))}
                />
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <ChartCard title="Когда происходят события" subtitle="День недели × час — для планирования патрулей и дежурств" className="lg:col-span-3">
              {data && <WeekHourHeatmap heat={data.heat} />}
            </ChartCard>
            <ChartCard title="По районам" subtitle="Всего событий за период" className="lg:col-span-2">
              {data && (
                <HBarList
                  rows={data.byDistrict.map((d) => ({
                    key: d.district,
                    label: `${d.district} район`,
                    value: d.total,
                    extra: `Критичных: ${d.critical} · открытых: ${d.open}`,
                  }))}
                />
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Частые типы событий">
              {data && <HBarList rows={data.topTypes.map((x) => ({ key: x.type, label: x.type, value: x.count }))} />}
            </ChartCard>
            <ChartCard title="Объекты с наибольшим числом событий">
              {data && data.topFacilities.length > 0 ? (
                <ol className="flex flex-col gap-2">
                  {data.topFacilities.map((f, i) => (
                    <li key={f.id} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground w-4">{i + 1}</span>
                      <SectorDot sector={f.sector} />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-foreground">{f.name}</span>
                        <span className="text-[10px] text-muted-foreground">{f.district} р-н · критичных {f.critical}</span>
                      </span>
                      <span className="font-mono text-foreground">{f.total}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="text-xs text-muted-foreground py-6 text-center">Нет данных</div>
              )}
            </ChartCard>
            <ChartCard title="Доступность камер" subtitle="Доля камер в сети по секторам">
              {data && (
                <HBarList
                  unit="%"
                  rows={data.camerasBySector.map((c) => ({
                    key: c.sector,
                    label: c.label,
                    value: c.total ? Math.round((c.online / c.total) * 100) : 0,
                    color: SECTOR_META[c.sector].color,
                    extra: `${c.online} из ${c.total} в сети`,
                  }))}
                />
              )}
            </ChartCard>
          </div>
        </div>
      </ChartTooltipProvider>
    </DashboardLayout>
  )
}

function Kpi({ icon, label, value, tone, href }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone?: "red" | "amber"; href?: string }) {
  const toneCls = tone === "red" ? "bg-red-500/10 text-red-500" : tone === "amber" ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"
  const body = (
    <div className="bg-card border border-border p-4 rounded-2xl flex items-center gap-3 shadow-sm h-full hover:border-primary/40 transition-colors">
      <div className={`p-2.5 rounded-xl ${toneCls}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
        <div className="text-xl font-bold text-foreground">{value ?? "…"}</div>
      </div>
    </div>
  )
  return href ? <a href={href}>{body}</a> : body
}
