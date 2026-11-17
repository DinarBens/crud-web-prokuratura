"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LuGalleryVerticalEnd,
  LuMap,
  LuVideo,
  LuTv,
  LuSiren,
  LuBuilding2,
  LuChartColumn,
  LuFileSpreadsheet,
  LuDatabase,
  LuInbox,
} from "react-icons/lu"
import { ROLE_META, type Role } from "@/lib/roles"

const teams = [
  {
    name: "Alatau Vision",
    logo: <LuGalleryVerticalEnd />,
    plan: "Единая платформа",
  },
]

const navMain = [
  { title: "Обзор", url: "/", icon: <LuMap /> },
  {
    title: "Инциденты",
    url: "/incidents",
    icon: <LuSiren />,
    isActive: true,
    items: [
      { title: "Ждут реакции", url: "/incidents?status=open" },
      { title: "Все", url: "/incidents?status=all" },
      { title: "Видеожурнал", url: "/incidents?source=journal&status=all" },
      { title: "Критичные", url: "/incidents?severity=critical&status=all" },
    ],
  },
  { title: "Неразобранные", url: "/incidents?source=live&status=NEW", icon: <LuInbox /> },
  { title: "Камеры", url: "/cameras", icon: <LuVideo /> },
  { title: "Объекты", url: "/objects", icon: <LuBuilding2 /> },
  { title: "Аналитика", url: "/monitoring/analytics", icon: <LuChartColumn /> },
  { title: "Отчёты", url: "/monitoring/reports", icon: <LuFileSpreadsheet /> },
  { title: "Экраны", url: "/screens", icon: <LuTv /> },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [me, setMe] = React.useState<{ email: string; name: string | null; role: string } | null>(null)
  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setMe(j?.user ?? null))
      .catch(() => {})
  }, [])
  const items = me?.role === "ADMIN" ? [...navMain, { title: "Импорт данных", url: "/admin/import", icon: <LuDatabase /> }] : navMain
  const user = {
    name: me?.name || me?.email || "Пользователь",
    email: me ? ROLE_META[me.role as Role]?.label ?? me.role : "",
    avatar: "/avatars/shadcn.jpg",
  }
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
