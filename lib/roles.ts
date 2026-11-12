import { SECTORS, type Sector } from "./sectors"

export const ROLES = ["ADMIN", "PROSECUTOR", "POLICE", "EDUCATION", "HEALTH"] as const
export type Role = (typeof ROLES)[number]

export const ROLE_META: Record<Role, { label: string; sectors: readonly Sector[]; canChangeStatus: boolean }> = {
  ADMIN: { label: "Администратор", sectors: SECTORS, canChangeStatus: true },
  // Прокуратура видит всё и фиксирует оценку реагирования
  PROSECUTOR: { label: "Прокуратура г. Шымкент", sectors: SECTORS, canChangeStatus: true },
  POLICE: { label: "Департамент полиции", sectors: SECTORS, canChangeStatus: true },
  EDUCATION: { label: "Управление образования", sectors: ["SCHOOL", "KINDERGARTEN"], canChangeStatus: true },
  HEALTH: { label: "Управление здравоохранения", sectors: ["MEDICAL"], canChangeStatus: true },
}

export function sectorsForRole(role: string | undefined): readonly Sector[] {
  return ROLE_META[(role as Role) ?? "ADMIN"]?.sectors ?? []
}
