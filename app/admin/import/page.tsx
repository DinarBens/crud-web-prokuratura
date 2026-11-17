"use client"

import React, { useCallback, useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { CheckCircle2, CircleAlert, Database, Loader2 } from "lucide-react"

interface Status {
  state: {
    phase: "idle" | "rows" | "media" | "done" | "error"
    startedAt: string | null
    finishedAt: string | null
    message: string
    counts: Record<string, number>
    media: { total: number; done: number; copied: number; skipped: number; failed: number }
    errors: string[]
  }
  sourceConfigured: boolean
  mediaSourceConfigured: boolean
  bucketConfigured: boolean
  inDb: { journal: number; live: number; cameras: number; facilities: number; withMedia: number; mediaPending: number }
}

const PHASE: Record<Status["state"]["phase"], string> = {
  idle: "Не запускался после перезапуска сервера",
  rows: "Загружаются объекты, камеры и инциденты…",
  media: "Копируются видео и кадры…",
  done: "Завершён",
  error: "Остановлен с ошибкой",
}

// Импорт данных из qoz-vision: однократная копия (источник только читается)
export default function ImportPage() {
  const [st, setSt] = useState<Status | null>(null)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/import")
    const j = await r.json()
    if (!r.ok) setErr(j.error ?? "Ошибка")
    else setSt(j)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load])

  const run = async (media: boolean) => {
    setBusy(true)
    setErr("")
    const r = await fetch("/api/admin/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok && r.status !== 409) setErr(j.error ?? "Не удалось запустить")
    setBusy(false)
    load()
  }

  const running = st?.state.phase === "rows" || st?.state.phase === "media"
  const m = st?.state.media
  const pct = m && m.total ? Math.round((m.done / m.total) * 100) : 0

  return (
    <DashboardLayout breadcrumbs={[{ label: "Импорт данных", active: true }]}>
      <div className="p-6 flex flex-col gap-5 max-w-4xl mx-auto w-full">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Импорт данных</h1>
          <p className="text-sm text-muted-foreground">
            Однократная копия объектов, камер, инцидентов и записей из qoz-vision. Исходная система только читается и не меняется; повторный запуск добавит лишь новое.
          </p>
        </div>

        {err && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{err}</div>}

        {st && (
          <>
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <Check ok={st.sourceConfigured} label="База qoz-vision" hint="SOURCE_DATABASE_URL" />
              <Check ok={st.mediaSourceConfigured} label="Хранилище записей" hint="SUPABASE_S3_* (как в qoz-vision)" />
              <Check ok={st.bucketConfigured} label="Хранилище платформы" hint="BUCKET_*" />
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  {running ? <Loader2 className="size-5 animate-spin" /> : <Database className="size-5" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-foreground">{PHASE[st.state.phase]}</div>
                  <div className="text-xs text-muted-foreground">{st.state.message}</div>
                </div>
                <Button onClick={() => run(true)} disabled={busy || running || !st.sourceConfigured}>
                  {running ? "Идёт импорт…" : "Запустить импорт"}
                </Button>
              </div>

              {m && m.total > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Записи: {m.done} из {m.total} · скопировано {m.copied} · уже были {m.skipped} · ошибок {m.failed}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Stat label="Объектов" value={st.inDb.facilities} />
                <Stat label="Камер" value={st.inDb.cameras} />
                <Stat label="Инцидентов видеожурнала" value={st.inDb.journal} />
                <Stat label="Событий живого мониторинга" value={st.inDb.live} />
                <Stat label="С видео/кадром" value={st.inDb.withMedia} />
                <Stat label="Записи ждут копирования" value={st.inDb.mediaPending} />
              </div>

              {st.state.errors.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Предупреждения ({st.state.errors.length})</summary>
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    {st.state.errors.slice(-30).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

function Check({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="flex items-start gap-2">
      {ok ? <CheckCircle2 className="size-4 text-green-600 mt-0.5" /> : <CircleAlert className="size-4 text-amber-500 mt-0.5" />}
      <div>
        <div className="text-foreground font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{ok ? "Подключено" : `Нужна переменная ${hint}`}</div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  )
}
