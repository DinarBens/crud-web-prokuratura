// Категории видеоаналитики qoz-vision → русские названия и критичность для журнала инцидентов.
import type { Severity } from "./sectors"
import { severityOf } from "./sectors"

export const CATEGORY_META: Record<string, { label: string; severity: Severity }> = {
  fight: { label: "Драка", severity: "critical" },
  weapon: { label: "Оружие", severity: "critical" },
  fall: { label: "Падение", severity: "critical" },
  fire: { label: "Огонь", severity: "critical" },
  smoke: { label: "Дым", severity: "critical" },
  fire_smoke: { label: "Огонь / дым", severity: "critical" },
  wanted_person: { label: "Лицо из розыска", severity: "critical" },
  intruder: { label: "Посторонний", severity: "warning" },
  fence_climbing: { label: "Перелаз через ограждение", severity: "warning" },
  smoking: { label: "Курение", severity: "warning" },
  crowd: { label: "Скопление людей", severity: "warning" },
  lost_property: { label: "Забытые вещи", severity: "info" },
  phone_usage: { label: "Телефон на уроке", severity: "info" },
  sleep: { label: "Сон на уроке", severity: "info" },
  anpr: { label: "Распознавание номера", severity: "info" },
  pending: { label: "На анализе", severity: "info" },
}

// Код или произвольный текст типа события → подпись и критичность
export function describeCategory(raw: string | null | undefined): { code: string; label: string; severity: Severity } {
  const value = (raw ?? "").trim()
  const code = value.toLowerCase().replace(/[\s-]+/g, "_")
  const meta = CATEGORY_META[code]
  if (meta) return { code, ...meta }
  // Текст из живого мониторинга может прийти уже по-русски
  const label = value ? value.charAt(0).toUpperCase() + value.slice(1) : "Событие"
  const bySynonym = Object.entries(CATEGORY_META).find(([, m]) => m.label.toLowerCase() === value.toLowerCase())
  if (bySynonym) return { code: bySynonym[0], ...bySynonym[1] }
  return { code: code || "other", label, severity: severityOf(label) }
}

export const SOURCE_META: Record<string, string> = {
  manual: "Вручную",
  journal: "Видеожурнал",
  live: "Живой мониторинг",
}
