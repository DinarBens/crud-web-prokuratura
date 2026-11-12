// Проверка, отдаёт ли камера живое видео: HLS-плейлист должен отвечать 200 и содержать сегменты.
// Статус "online" в базе раньше был просто значением по умолчанию — из-за этого нерабочие камеры
// показывались «в сети». Теперь статус выставляется по факту проверки потока.

const TIMEOUT_MS = 5000

async function fetchText(url: string): Promise<{ ok: boolean; text: string }> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-store" })
    return { ok: r.ok, text: r.ok ? await r.text() : "" }
  } catch {
    return { ok: false, text: "" }
  } finally {
    clearTimeout(t)
  }
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
