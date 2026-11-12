"use client"

import React, { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { SearchInput } from "@/components/shared/search-input"
import { ViewToggle } from "@/components/shared/view-toggle"
import { StreamViewer } from "@/components/shared/stream-viewer"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Play, Calendar, Video, Plus, RefreshCw, VideoOff } from "lucide-react"

interface Camera {
  id: string
  name: string
  info: string
  streamUrl: string
  status?: string
  lastCheckedAt?: string | null
}

const RECHECK_AFTER_MS = 10 * 60 * 1000 // перепроверять потоки, если последняя проверка старше 10 минут

function formatAgo(v: string) {
  const min = Math.round((Date.now() - new Date(v).getTime()) / 60000)
  if (min < 1) return "только что"
  if (min < 60) return `${min} мин назад`
  return `${Math.floor(min / 60)} ч назад`
}

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "card">("table")
  const [loading, setLoading] = useState(false)

  // Selected camera states for modals
  const [activeWatchCam, setActiveWatchCam] = useState<Camera | null>(null)
  const [activeArchiveCam, setActiveArchiveCam] = useState<Camera | null>(null)

  // Add camera states
  const [newCamName, setNewCamName] = useState("")
  const [newCamInfo, setNewCamInfo] = useState("")
  const [newCamUrl, setNewCamUrl] = useState("")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addError, setAddError] = useState("")

  const [checking, setChecking] = useState(false)
  const [showOffline, setShowOffline] = useState(true)
  // Фактический результат воспроизведения в браузере (дополняет серверную проверку)
  const [liveInBrowser, setLiveInBrowser] = useState<Record<string, boolean>>({})

  const fetchCameras = async (quiet = false): Promise<Camera[]> => {
    if (!quiet) setLoading(true)
    try {
      const res = await fetch("/api/cameras")
      if (!res.ok) throw new Error("Ошибка получения камер")
      const data: Camera[] = await res.json()
      setCameras(data)
      return data
    } catch (err) {
      console.error(err)
      return []
    } finally {
      if (!quiet) setLoading(false)
    }
  }

  // Проверка потоков на сервере: какие камеры реально отдают видео
  const checkStreams = async () => {
    setChecking(true)
    try {
      await fetch("/api/cameras/health", { method: "POST" })
      setLiveInBrowser({})
      await fetchCameras(true)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    fetchCameras().then((data) => {
      const checkedTimes = data.map((c) => (c.lastCheckedAt ? new Date(c.lastCheckedAt).getTime() : 0))
      const oldest = checkedTimes.length ? Math.min(...checkedTimes) : 0
      if (data.length && Date.now() - oldest > RECHECK_AFTER_MS) checkStreams()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddCamera = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError("")

    if (!newCamName || !newCamInfo || !newCamUrl) {
      setAddError("Пожалуйста, заполните все поля")
      return
    }

    try {
      const res = await fetch("/api/cameras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCamName,
          info: newCamInfo,
          streamUrl: newCamUrl,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Ошибка сохранения камеры")
      }

      // Success logic
      setNewCamName("")
      setNewCamInfo("")
      setNewCamUrl("")
      setAddDialogOpen(false)
      fetchCameras()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось сохранить камеру"
      setAddError(message)
    }
  }

  const isOnline = (cam: Camera) => liveInBrowser[cam.id] ?? cam.status !== "offline"
  const onlineCount = cameras.filter(isOnline).length
  const lastChecked = cameras.reduce<string | null>(
    (acc, c) => (c.lastCheckedAt && (!acc || c.lastCheckedAt > acc) ? c.lastCheckedAt : acc),
    null
  )

  // Рабочие камеры — наверху. Порядок берём от серверной проверки, чтобы карточки не прыгали во время просмотра.
  const filteredCameras = cameras
    .filter((cam) =>
      cam.name.toLowerCase().includes(search.toLowerCase()) ||
      cam.info.toLowerCase().includes(search.toLowerCase())
    )
    .filter((cam) => showOffline || isOnline(cam))
    .sort((a, b) => Number(b.status !== "offline") - Number(a.status !== "offline"))

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Камеры", active: true },
      ]}
    >
      <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Header section with add button */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Источники видео</h1>
            <p className="text-sm text-muted-foreground">
              Управление подключенными камерами и просмотр трансляций в реальном времени
            </p>
          </div>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger
              render={
                <Button className="bg-primary hover:bg-primary/95 text-primary-foreground font-medium px-4 h-9 cursor-pointer flex items-center gap-1.5 shadow-md shadow-primary/10">
                  <Plus className="size-4" />
                  Добавить камеру
                </Button>
              }
            />
            <DialogContent className="bg-card border border-border text-foreground rounded-2xl max-w-md p-6">
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground">Новый видеоисточник</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddCamera} className="flex flex-col gap-4 mt-2">
                {addError && (
                  <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                    {addError}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Название камеры
                  </label>
                  <Input
                    placeholder="Например, Камера 13 (Астана)"
                    value={newCamName}
                    onChange={(e) => setNewCamName(e.target.value)}
                    required
                    className="bg-secondary/20 border-border text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Описание расположения
                  </label>
                  <Input
                    placeholder="Например, Проходная, турникет 2"
                    value={newCamInfo}
                    onChange={(e) => setNewCamInfo(e.target.value)}
                    required
                    className="bg-secondary/20 border-border text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    URL видеопотока (MP4 / HLS)
                  </label>
                  <Input
                    placeholder="Например, https://example.com/stream.mp4"
                    value={newCamUrl}
                    onChange={(e) => setNewCamUrl(e.target.value)}
                    required
                    className="bg-secondary/20 border-border text-foreground"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-border/40 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddDialogOpen(false)}
                    className="border-border text-foreground cursor-pointer"
                  >
                    Отмена
                  </Button>
                  <Button type="submit" className="bg-primary hover:bg-primary/95 text-primary-foreground cursor-pointer">
                    Сохранить
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters and Toggle section */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card border border-border p-4 rounded-2xl shadow-sm">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Поиск по имени камеры или информации..."
            className="max-w-md"
          />
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>

        {/* Сводка по доступности камер */}
        {cameras.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <span className="size-2 rounded-full bg-emerald-500" />
                Отдают видео: <b>{onlineCount}</b> из {cameras.length}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full bg-zinc-400" />
                Нет сигнала: {cameras.length - onlineCount}
              </span>
              <span className="text-muted-foreground">
                {checking ? "Проверяем потоки…" : lastChecked ? `Проверено ${formatAgo(lastChecked)}` : "Ещё не проверялись"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-foreground cursor-pointer">
                <input type="checkbox" checked={showOffline} onChange={(e) => setShowOffline(e.target.checked)} className="accent-[var(--primary)]" />
                Показывать камеры без сигнала
              </label>
              <Button variant="outline" size="sm" onClick={checkStreams} disabled={checking} className="h-8 gap-1.5 text-xs cursor-pointer">
                <RefreshCw className={`size-3.5 ${checking ? "animate-spin" : ""}`} /> Проверить камеры
              </Button>
            </div>
          </div>
        )}

        {/* Cameras Display */}
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Загрузка видеоисточников...</div>
        ) : filteredCameras.length === 0 ? (
          <div className="p-16 border border-border bg-card rounded-2xl text-center flex flex-col items-center gap-3">
            <Video className="size-10 text-muted-foreground" />
            <div className="text-base font-semibold text-foreground">Источники не найдены</div>
            <p className="text-sm text-muted-foreground max-w-sm">
              Потоки с заданными параметрами отсутствуют в базе данных. Вы можете добавить новую камеру.
            </p>
          </div>
        ) : viewMode === "table" ? (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-secondary/25 border-b border-border">
                <TableRow className="hover:bg-transparent border-b border-border/80">
                  <TableHead className="w-[120px] text-xs font-semibold text-muted-foreground uppercase tracking-wider">Статус</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Имя камеры</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Информация</TableHead>
                  <TableHead className="w-[240px] text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCameras.map((cam) => (
                  <TableRow key={cam.id} className="hover:bg-secondary/15 border-b border-border/40">
                    <TableCell className="text-xs">
                      {isOnline(cam) ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500" />Есть видео</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="size-1.5 rounded-full bg-zinc-400" />Нет сигнала</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground text-xs">{cam.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{cam.info}</TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-2 h-[52px]">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveArchiveCam(cam)}
                        className="h-8 border-border text-foreground hover:bg-accent/20 gap-1 text-xs cursor-pointer"
                      >
                        <Calendar className="size-3.5" />
                        Архив
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setActiveWatchCam(cam)}
                        className="h-8 bg-primary hover:bg-primary/95 text-primary-foreground gap-1 text-xs cursor-pointer"
                      >
                        <Play className="size-3.5 fill-current" />
                        Посмотреть
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCameras.map((cam) => (
              <div key={cam.id} className={`bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col ${isOnline(cam) ? "" : "opacity-70"}`}>
                {cam.status !== "offline" ? (
                  <StreamViewer
                    streamUrl={cam.streamUrl}
                    cameraName={cam.name}
                    onStatus={(alive) => setLiveInBrowser((prev) => (prev[cam.id] === alive ? prev : { ...prev, [cam.id]: alive }))}
                  />
                ) : (
                  // Камеры без сигнала не грузим в сетке — чтобы не тормозить страницу. Открыть можно кнопкой «Посмотреть».
                  <div className="relative aspect-video w-full bg-zinc-950 border-b border-border/80 flex flex-col items-center justify-center gap-1.5 text-zinc-400">
                    <VideoOff className="size-6" />
                    <span className="text-xs font-medium">Нет сигнала</span>
                    <span className="text-[10px] text-zinc-500">
                      {cam.lastCheckedAt ? `проверено ${formatAgo(cam.lastCheckedAt)}` : "поток не отвечает"}
                    </span>
                  </div>
                )}
                <div className="p-4 flex flex-col gap-3 flex-1 justify-between">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-xs font-bold text-foreground">{cam.name}</h4>
                    <p className="text-[11px] text-muted-foreground">{cam.info}</p>
                  </div>
                  <div className="flex gap-2 border-t border-border/40 pt-3 mt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveArchiveCam(cam)}
                      className="flex-1 h-8 border-border text-foreground hover:bg-accent/20 gap-1 text-xs cursor-pointer"
                    >
                      <Calendar className="size-3.5" />
                      Архив
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setActiveWatchCam(cam)}
                      className="flex-1 h-8 bg-primary hover:bg-primary/95 text-primary-foreground gap-1 text-xs cursor-pointer"
                    >
                      <Play className="size-3.5 fill-current" />
                      Посмотреть
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dialog for Live stream viewing */}
        <Dialog open={activeWatchCam !== null} onOpenChange={(open) => !open && setActiveWatchCam(null)}>
          <DialogContent className="bg-card border border-border text-foreground rounded-2xl max-w-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Трансляция: {activeWatchCam?.name}
              </DialogTitle>
            </DialogHeader>
            {activeWatchCam && (
              <div className="mt-3">
                <StreamViewer streamUrl={activeWatchCam.streamUrl} cameraName={activeWatchCam.name} />
                <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                  Поток активен. Расположение: {activeWatchCam.info}. Подключено через защищенный канал к центральному серверу.
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog for Archive viewing */}
        <Dialog open={activeArchiveCam !== null} onOpenChange={(open) => !open && setActiveArchiveCam(null)}>
          <DialogContent className="bg-card border border-border text-foreground rounded-2xl max-w-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-foreground">
                Архив записей: {activeArchiveCam?.name}
              </DialogTitle>
            </DialogHeader>
            {activeArchiveCam && (
              <div className="mt-3 flex flex-col gap-4">
                <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-zinc-950 border border-border/80">
                  {/* Archived feed playback simulated with video starting offset */}
                  <video
                    src={activeArchiveCam.streamUrl}
                    autoPlay
                    muted
                    loop
                    className="w-full h-full object-cover brightness-[0.7] sepia-[0.1]"
                  />
                  <div className="absolute top-3 left-3 bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase">
                    ARCHIVE RECORDING
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/60 text-zinc-300 text-[10px] font-mono px-2 py-0.5 rounded">
                    Дата: {new Date(Date.now() - 24*60*60*1000).toLocaleDateString("ru-RU")} | 14:35:12
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold text-foreground">Выберите архивный фрагмент:</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => alert("Загрузка фрагмента за вчера...")}
                      className="p-2 border border-border bg-secondary/25 hover:bg-secondary/50 rounded-lg text-left text-xs cursor-pointer text-foreground"
                    >
                      <span className="block font-medium">Вчера</span>
                      <span className="text-[10px] text-muted-foreground">14:00 - 15:00</span>
                    </button>
                    <button
                      onClick={() => alert("Загрузка фрагмента за 2 дня назад...")}
                      className="p-2 border border-border bg-secondary/25 hover:bg-secondary/50 rounded-lg text-left text-xs cursor-pointer text-foreground"
                    >
                      <span className="block font-medium">2 дня назад</span>
                      <span className="text-[10px] text-muted-foreground">11:30 - 12:30</span>
                    </button>
                    <button
                      onClick={() => alert("Загрузка фрагмента за 3 дня назад...")}
                      className="p-2 border border-border bg-secondary/25 hover:bg-secondary/50 rounded-lg text-left text-xs cursor-pointer text-foreground"
                    >
                      <span className="block font-medium">3 дня назад</span>
                      <span className="text-[10px] text-muted-foreground">09:15 - 10:15</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
