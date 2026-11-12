import { randomBytes, scryptSync, timingSafeEqual } from "crypto"

// Формат хранения: scrypt$<salt hex>$<hash hex>
export function hashPassword(plain: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(plain, salt, 64)
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`
}

export function isHashed(stored: string): boolean {
  return stored.startsWith("scrypt$")
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!isHashed(stored)) {
    // Старые записи с открытым паролем — сравниваем как есть, при входе перехэшируем
    const a = Buffer.from(plain)
    const b = Buffer.from(stored)
    return a.length === b.length && timingSafeEqual(a, b)
  }
  const [, saltHex, hashHex] = stored.split("$")
  const expected = Buffer.from(hashHex, "hex")
  const actual = scryptSync(plain, Buffer.from(saltHex, "hex"), expected.length)
  return timingSafeEqual(actual, expected)
}
