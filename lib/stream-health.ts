// Проверка, отдаёт ли камера живое видео: HLS-плейлист должен отвечать 200 и содержать сегменты.
// Работает и на сервере, и в браузере. Основная проверка идёт из браузера оператора:
// сервер платформы находится за рубежом, и сервер видео (v-guard.kz) отвечает ему нестабильно —
// из-за этого рабочие камеры ошибочно помечались «нет сигнала».
// Статус "online" в базе раньше был просто значением по умолчанию — из-за этого нерабочие камеры
// показывались «в сети». Теперь статус выставляется по факту проверки потока.

const TIMEOUT_MS = 6000

// "ok" — видео идёт, "dead" — сервер ответил, но потока нет (404 и т.п.), "timeout" — не дождались ответа
export type StreamCheck = "ok" | "dead" | "timeout"

async function fetchText(url: string, timeoutMs = TIMEOUT_MS): Promise<{ ok: boolean; status: number; text: string }> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-store" })
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : "" }
  } catch {
    return { ok: false, status: 0, text: "" }
  } finally {
    clearTimeout(t)
  }
}

// Подробная проверка с явным таймаутом — для проверки из браузера порциями (см. страницу камер)
export async function checkStream(url: string, timeoutMs: number): Promise<StreamCheck> {
  if (!/^https?:\/\//i.test(url)) return "dead"
  const r = await fetchText(url, timeoutMs)
  if (r.status === 0) return "timeout"
  if (!r.ok) return "dead"
  if (!url.includes(".m3u8") || r.text.includes("#EXTINF")) return "ok"
  const variant = r.text.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"))
  if (!variant || !r.text.includes("#EXT-X-STREAM-INF")) return "dead"
  const child = await fetchText(new URL(variant, url).toString(), timeoutMs)
  if (child.status === 0) return "timeout"
  return child.ok && child.text.includes("#EXTINF") ? "ok" : "dead"
}

export async function isStreamAlive(url: string): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false
  // MP4 и прочие файлы — достаточно, что сервер отвечает
  if (!url.includes(".m3u8")) {
    const { ok } = await fetchText(url)
    return ok
  }
  const { ok, text } = await fetchText(url)
  if (!ok) return false
  if (text.includes("#EXTINF")) return true
  // Мастер-плейлист — проверяем первый вариант качества
  const variant = text.split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("#"))
  if (!variant || !text.includes("#EXT-X-STREAM-INF")) return false
  const child = await fetchText(new URL(variant, url).toString())
  return child.ok && child.text.includes("#EXTINF")
}

// Проверка списка с ограничением параллельности
export async function checkStreams<T extends { id: string; streamUrl: string }>(
  items: T[],
  concurrency = 25
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>()
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const item = items[i++]
      result.set(item.id, await isStreamAlive(item.streamUrl))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return result
}
