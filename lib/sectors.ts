// Общие справочники платформы: сектора объектов, районы, критичность и статусы инцидентов.
// Используются и на сервере (API, сид), и в интерфейсе — держим в одном месте.

export const SECTORS = ["SCHOOL", "KINDERGARTEN", "MEDICAL", "POLICE", "CITY"] as const
export type Sector = (typeof SECTORS)[number]

export const SECTOR_META: Record<
  Sector,
  { label: string; plural: string; owner: string; color: string; short: string }
> = {
  SCHOOL: {
    label: "Школа",
    plural: "Школы",
    owner: "Управление образования г. Шымкент",
    color: "#2563eb",
    short: "Ш",
  },
  KINDERGARTEN: {
    label: "Детский сад",
    plural: "Детские сады",
    owner: "Управление образования г. Шымкент",
    color: "#db2777",
    short: "Д",
  },
  MEDICAL: {
    label: "Медицина",
    plural: "Медицина",
    owner: "Управление здравоохранения г. Шымкент",
    color: "#0891b2",
    short: "М",
  },
  POLICE: {
    label: "Полиция",
    plural: "Камеры ДП",
    owner: "Департамент полиции г. Шымкент",
    color: "#7c3aed",
    short: "П",
  },
  CITY: {
    label: "Городская камера",
    plural: "Город",
    owner: "Акимат г. Шымкент",
    color: "#ea580c",
    short: "Г",
  },
}

export function isSector(v: string | null | undefined): v is Sector {
  return !!v && (SECTORS as readonly string[]).includes(v)
}

export const DISTRICTS = [
  "Абайский",
  "Аль-Фарабийский",
  "Енбекшинский",
  "Каратауский",
  "Туранский",
] as const

// ---- Критичность ----

export const CRITICAL_TYPES = [
  "Драка",
  "Огонь",
  "Дым",
  "Оружие",
  "ДТП",
  "Вандализм",
  "Упавший человек",
  "Лежащий человек",
  "Хулиганство",
  "Газовый баллон",
]

export const WARNING_TYPES = [
  "Курение",
  "Нарушитель",
  "Пересечение линии",
  "Длительное нахождение в зоне",
  "Оставленный предмет",
  "Избыточное количество людей",
  "Распознанное лицо неизвестно",
  "Видеосигнал потерян",
  "Видеосигнал ослеплён",
  "Бегущий человек",
]

export type Severity = "critical" | "warning" | "info"

export function severityOf(type: string): Severity {
  if (CRITICAL_TYPES.includes(type)) return "critical"
  if (WARNING_TYPES.includes(type)) return "warning"
  return "info"
}

export const SEVERITY_META: Record<Severity, { label: string; badge: string }> = {
  critical: { label: "Критично", badge: "critical" },
  warning: { label: "Предупреждение", badge: "warning" },
  info: { label: "Информация", badge: "stable" },
}

// Ситуации, характерные для каждого сектора — для генерации демо-данных и быстрых фильтров
export const SECTOR_SITUATIONS: Record<Sector, string[]> = {
  SCHOOL: [
    "Драка",
    "Нарушитель",
    "Курение",
    "Оставленный предмет",
    "Оружие",
    "Избыточное количество людей",
    "Распознанное лицо неизвестно",
    "Бегущий человек",
    "Видеосигнал потерян",
  ],
  KINDERGARTEN: [
    "Нарушитель",
    "Распознанное лицо неизвестно",
    "Выход из зоны",
    "Упавший человек",
    "Длительное нахождение в зоне",
    "Видеосигнал потерян",
  ],
  MEDICAL: [
    "Драка",
    "Упавший человек",
    "Лежащий человек",
    "Курение",
    "Хулиганство",
    "Избыточное количество людей",
    "Видеосигнал ослеплён",
  ],
  POLICE: [
    "Вандализм",
    "Оружие",
    "Драка",
    "Распознанное лицо известно",
    "Оставленный предмет",
    "Видеосигнал потерян",
  ],
  CITY: [
    "ДТП",
    "Переход в неположенном месте",
    "Переход на красный",
    "Скопление транспортных средств",
    "Драка",
    "Вандализм",
    "Огонь",
    "Хулиганство",
  ],
}

// ---- Статусы инцидентов ----

export const INCIDENT_STATUSES = ["NEW", "IN_REVIEW", "FORWARDED", "RESOLVED", "FALSE_ALARM"] as const
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

export const STATUS_META: Record<IncidentStatus, { label: string; className: string; open: boolean }> = {
  NEW: { label: "Новый", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", open: true },
  IN_REVIEW: { label: "На проверке", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", open: true },
  FORWARDED: { label: "Передан", className: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20", open: true },
  RESOLVED: { label: "Отработан", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", open: false },
  FALSE_ALARM: { label: "Ложное срабатывание", className: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20", open: false },
}

export const OPEN_STATUSES = INCIDENT_STATUSES.filter((s) => STATUS_META[s].open)

export function isIncidentStatus(v: string | null | undefined): v is IncidentStatus {
  return !!v && (INCIDENT_STATUSES as readonly string[]).includes(v)
}

// Куда можно передать инцидент
export const FORWARD_TARGETS = [
  "Департамент полиции г. Шымкент",
  "УП Абайского района",
  "УП Аль-Фарабийского района",
  "УП Енбекшинского района",
  "УП Каратауского района",
  "УП Туранского района",
  "Управление образования",
  "Управление здравоохранения",
  "ДЧС г. Шымкент",
  "Скорая помощь (103)",
]

// Норматив реакции на критичный инцидент, минут — для контроля просрочки
export const SLA_MINUTES: Record<Severity, number> = {
  critical: 15,
  warning: 60,
  info: 24 * 60,
}
