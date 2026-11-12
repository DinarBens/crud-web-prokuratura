"use client"

import React, { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { StreamViewer } from "@/components/shared/stream-viewer"
import { StatusBadge } from "@/components/shared/status-badge"
import { IncidentStatusBadge, SectorLabel, formatDateTime } from "@/components/shared/filters"
import { FORWARD_TARGETS, SEVERITY_META, SLA_MINUTES, STATUS_META, type Severity, type IncidentStatus } from "@/lib/sectors"
import { Clock, MapPin, Phone, Send, CheckCircle2, XCircle, Eye, AlertTriangle } from "lucide-react"

interface IncidentDetail {
  id: string
  type: string
  cameraName: string
  timestamp: string
  details: string
  severity: string
  status: string
  forwardedTo: string | null
  resolvedAt: string | null
  facility: {
    name: string
    sector: string
    district: string
    address: string
    responsibleName: string | null
    responsiblePhone: string | null
    owner: string | null
  } | null
  camera: { name: string; streamUrl: string; status: string } | null
  actions: {
    id: string
    action: string
    fromStatus: string | null
    toStatus: string | null
    comment: string | null
    createdAt: string
    user: { name: string | null; email: string } | null
  }[]
}

export function IncidentDialog({
  incidentId,
  onClose,
  onChanged,
}: {
  incidentId: string | null
  onClose: () => void
  onChanged?: () => void
}) {
  const [data, setData] = useState<IncidentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [comment, setComment] = useState("")
  const [forwardTo, setForwardTo] = useState(FORWARD_TARGETS[0])
  const [showVideo, setShowVideo] = useState(false)

  useEffect(() => {
    setData(null)
    setError(null)
    setComment("")
    setShowVideo(false)
    if (!incidentId) return
    fetch(`/api/incidents/${incidentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Не удалось загрузить инцидент"))))
      .then(setData)
      .catch((e) => setError(e.message))
  }, [incidentId])

  const update = async (body: { status?: IncidentStatus; comment?: string; forwardedTo?: string }) => {
    if (!incidentId) return
    setSaving(true)
    setError(null)
    try {
      const r = await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, comment: body.comment ?? (comment || undefined) }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error || "Ошибка")
      setData(json)
      setComment("")
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSaving(false)
    }
  }

  const sev = (data?.severity as Severity) ?? "info"
  const isOpen = data ? STATUS_META[data.status as IncidentStatus]?.open : false
  const ageMin = data ? (Date.now() - new Date(data.timestamp).getTime()) / 60000 : 0
  const overdue = isOpen && ageMin > SLA_MINUTES[sev]

  return (
    <Dialog open={incidentId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border border-border text-foreground rounded-2xl max-w-3xl p-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-lg font-bold text-foreground flex flex-wrap items-center gap-2">
            {data?.type ?? "Инцидент"}
            {data && <StatusBadge status={SEVERITY_META[sev].badge} />}
            {data && <IncidentStatusBadge status={data.status} />}
            {overdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                <AlertTriangle className="size-3" /> Просрочена реакция (норматив {SLA_MINUTES[sev]} мин)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {error && <div className="mx-6 mt-4 p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">{error}</div>}
        {!data && !error && <div className="p-10 text-center text-sm text-muted-foreground">Загрузка...</div>}

        {data && (
          <div className="p-6 flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-muted-foreground"><Clock className="size-3.5" /> {formatDateTime(data.timestamp)}</div>
                {data.facility ? (
                  <>
                    <div className="font-semibold text-sm text-foreground">{data.facility.name}</div>
                    <SectorLabel sector={data.facility.sector} />
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="size-3.5 mt-0.5 shrink-0" /> {data.facility.district} р-н, {data.facility.address}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">Объект не привязан</div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div><span className="text-muted-foreground">Камера: </span>{data.cameraName}</div>
                {data.facility?.owner && <div><span className="text-muted-foreground">Владелец камер: </span>{data.facility.owner}</div>}
                {data.facility?.responsibleName && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5 text-muted-foreground" />
                    {data.facility.responsibleName}
                    {data.facility.responsiblePhone && (
                      <a href={`tel:${data.facility.responsiblePhone}`} className="text-primary hover:underline">{data.facility.responsiblePhone}</a>
                    )}
                  </div>
                )}
                {data.forwardedTo && <div><span className="text-muted-foreground">Передан: </span>{data.forwardedTo}</div>}
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-4">{data.details}</p>

            {data.camera?.streamUrl && (
              showVideo ? (
                <StreamViewer streamUrl={data.camera.streamUrl} cameraName={data.camera.name} />
              ) : (
                <Button variant="outline" onClick={() => setShowVideo(true)} className="w-fit gap-1.5 text-xs cursor-pointer">
                  <Eye className="size-4" /> Открыть видео с камеры
                </Button>
              )
            )}

            {/* Действия */}
            <div className="flex flex-col gap-3 border-t border-border/40 pt-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Реагирование</div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Комментарий: принятые меры, номер КУИ, оценка законности..."
                rows={2}
                className="w-full rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex flex-wrap gap-2">
                {data.status === "NEW" && (
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => update({ status: "IN_REVIEW" })} className="text-xs cursor-pointer gap-1">
                    <Eye className="size-3.5" /> Взять на проверку
                  </Button>
                )}
                <div className="flex gap-1">
                  <select
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                    className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground cursor-pointer"
                    aria-label="Куда передать"
                  >
                    {FORWARD_TARGETS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <Button size="sm" variant="outline" disabled={saving} onClick={() => update({ status: "FORWARDED", forwardedTo: forwardTo })} className="text-xs cursor-pointer gap-1">
                    <Send className="size-3.5" /> Передать
                  </Button>
                </div>
                <Button size="sm" disabled={saving} onClick={() => update({ status: "RESOLVED" })} className="text-xs cursor-pointer gap-1 bg-primary text-primary-foreground">
                  <CheckCircle2 className="size-3.5" /> Отработан
                </Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => update({ status: "FALSE_ALARM" })} className="text-xs cursor-pointer gap-1 text-muted-foreground">
                  <XCircle className="size-3.5" /> Ложное срабатывание
                </Button>
                {comment && (
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => update({})} className="text-xs cursor-pointer">
                    Только комментарий
                  </Button>
                )}
              </div>
            </div>

            {/* Журнал */}
            <div className="flex flex-col gap-2 border-t border-border/40 pt-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Журнал действий</div>
              <ol className="flex flex-col gap-2">
                <li className="text-xs text-muted-foreground">
                  <span className="font-mono">{formatDateTime(data.timestamp)}</span> — событие зафиксировано видеоаналитикой
                </li>
                {data.actions.map((a) => (
                  <li key={a.id} className="text-xs">
                    <span className="font-mono text-muted-foreground">{formatDateTime(a.createdAt)}</span>{" "}
                    <span className="font-medium">{a.user?.name ?? a.user?.email ?? "Система"}</span>
                    {a.toStatus && <> → {STATUS_META[a.toStatus as IncidentStatus]?.label ?? a.toStatus}</>}
                    {a.comment && <span className="text-muted-foreground">. {a.comment}</span>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
