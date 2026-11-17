// Справочник местоположений: области / города республиканского значения → города с координатами центра.
// Координаты — центры городов (для карты обзора). У объектов без точного адреса точка = центр города.

export interface CityRef {
  id: string
  name: string
  region: string
  lat: number
  lng: number
  // Слова, по которым город узнаётся в названии организации или адресе
  aliases: string[]
}

export const CITIES: CityRef[] = [
  { id: "shymkent", name: "Шымкент", region: "г. Шымкент", lat: 42.3417, lng: 69.5901, aliases: ["шымкент", "shymkent"] },
  { id: "almaty", name: "Алматы", region: "г. Алматы", lat: 43.2389, lng: 76.8897, aliases: ["алматы", "almaty"] },
  { id: "astana", name: "Астана", region: "г. Астана", lat: 51.1694, lng: 71.4491, aliases: ["астана", "astana"] },
  { id: "zhezkazgan", name: "Жезказган", region: "Улытауская область", lat: 47.7833, lng: 67.7144, aliases: ["жезказган", "zhezkazgan"] },
  { id: "satpayev", name: "Сатпаев", region: "Улытауская область", lat: 47.9035, lng: 67.5331, aliases: ["сатпаев", "satpayev", "сәтбаев"] },
]

export const UNKNOWN_CITY = "Не указан"

export function cityByName(name: string | null | undefined): CityRef | undefined {
  if (!name) return undefined
  const n = name.trim().toLowerCase()
  return CITIES.find((c) => c.name.toLowerCase() === n || c.id === n)
}

// Узнать город по тексту (название организации, адрес)
export function guessCity(...texts: (string | null | undefined)[]): CityRef | undefined {
  const hay = texts.filter(Boolean).join(" ").toLowerCase()
  if (!hay) return undefined
  return CITIES.find((c) => c.aliases.some((a) => hay.includes(a)))
}

// Известные организации из qoz-vision без города в названии
export const KNOWN_ORGANIZATIONS: Record<string, string> = {
  "Школа 21": "Шымкент",
  "Общеобразовательная школа №24": "Шымкент",
  "Дом-интернат для престарелых и инвалидов": "Шымкент",
}
