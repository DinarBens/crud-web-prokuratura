"use client"

import React, { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { MonitoringSearchForm } from "@/components/monitoring-search-form"
import { StatusBadge } from "@/components/shared/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertCircle } from "lucide-react"
import { SEVERITY_META, severityOf } from "@/lib/sectors"

interface AlarmEvent {
  id: string
  type: string
  cameraName: string
  timestamp: string
  details: string
}

export default function AlarmsPage() {
  const [events, setEvents] = useState<AlarmEvent[]>([])
  const [loading, setLoading] = useState(false)

  const fetchEvents = async (params?: { query: string; type: string; date: Date | undefined }) => {
    setLoading(true)
    try {
      let url = "/api/alarms"
      const urlParams = new URLSearchParams()
      
      if (params) {
        if (params.query) urlParams.append("query", params.query)
        if (params.type && params.type !== "all") urlParams.append("type", params.type)
        if (params.date) urlParams.append("date", params.date.toISOString())
      }

      if (urlParams.toString()) {
        url += `?${urlParams.toString()}`
      }

      const response = await fetch(url)
      if (!response.ok) throw new Error("Ошибка получения событий")
      const data = await response.json()
      setEvents(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (params: { query: string; type: string; date: Date | undefined }) => {
    fetchEvents(params)
  }

  // Get severity badge status based on event type
  const getEventStatus = (type: string) => SEVERITY_META[severityOf(type)].badge

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Мониторинг" },
        { label: "Тревоги", active: true },
      ]}
    >
      <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Журнал тревог</h1>
          <p className="text-sm text-muted-foreground">
            Просмотр и фильтрация зафиксированных событий безопасности на охраняемых объектах
          </p>
        </div>

        {/* Unified filter form */}
        <MonitoringSearchForm onSearch={handleSearch} loading={loading} />

        {/* Alarms Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">Загрузка данных...</div>
          ) : events.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center text-center gap-3">
              <AlertCircle className="size-10 text-muted-foreground" />
              <div className="text-base font-medium text-foreground">События не найдены</div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Попробуйте изменить параметры поиска или сбросить фильтры
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-secondary/25 border-b border-border">
                <TableRow className="hover:bg-transparent border-b border-border/80">
                  <TableHead className="w-[180px] text-xs font-semibold text-muted-foreground uppercase tracking-wider">Время</TableHead>
                  <TableHead className="w-[180px] text-xs font-semibold text-muted-foreground uppercase tracking-wider">Событие</TableHead>
                  <TableHead className="w-[200px] text-xs font-semibold text-muted-foreground uppercase tracking-wider">Источник</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Подробности</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id} className="hover:bg-secondary/15 border-b border-border/40">
                    <TableCell className="font-mono text-xs text-foreground">
                      {new Date(event.timestamp).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={getEventStatus(event.type)} className="text-[9px] uppercase tracking-wider" />
                      <span className="ml-2 text-xs font-medium text-foreground">{event.type}</span>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">{event.cameraName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground leading-relaxed">{event.details}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
