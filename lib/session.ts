// Подписанная сессия (HMAC-SHA256 через Web Crypto) — работает и в middleware (Edge), и в API (Node).
// Раньше cookie содержал просто id пользователя, а middleware проверял лишь наличие cookie,
// поэтому любой "session-token=x" открывал все API.

export const SESSION_COOKIE = "session-token"
export const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 часов — рабочая смена

export interface SessionPayload {
  uid: string
  role: string
  exp: number // unix seconds
}

const encoder = new TextEncoder()

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.DATABASE_URL
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET не задан")
    }
    return "dev-only-insecure-secret"
  }
  return secret
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4))
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(data)))
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function createSessionToken(uid: string, role: string): Promise<string> {
  const payload: SessionPayload = {
    uid,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)))
  const sig = b64urlEncode(await hmac(body))
  return `${body}.${sig}`
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null
  const [body, sig] = token.split(".")
  if (!body || !sig) return null
  try {
    const expected = await hmac(body)
    if (!timingSafeEqual(expected, b64urlDecode(sig))) return null
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as SessionPayload
    if (!payload.uid || typeof payload.exp !== "number") return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=")
    if (k === name) return decodeURIComponent(v.join("="))
  }
  return undefined
}

// Для API-роутов: достать и проверить сессию из запроса
export async function getSession(request: Request): Promise<SessionPayload | null> {
  return verifySessionToken(readCookie(request.headers.get("cookie"), SESSION_COOKIE))
}
