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
  LuMonitor,
  LuVideo,
  LuTv,
  LuSiren,
  LuBuilding2,
} from "react-icons/lu"

// This is sample data.
// Пользователь подставляется из сессии на сервере в следующей итерации; пока — статично
const data = {
  user: {
    name: "Оператор",
    email: "Прокуратура г. Шымкент",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Alatau Vision",
      logo: <LuGalleryVerticalEnd />,
      plan: "Прокуратура г. Шымкент",
    },
  ],
  navMain: [
    {
      title: "Карта города",
      url: "/",
      icon: <LuMap />,
    },
    {
      title: "Инциденты",
      url: "/incidents",
      icon: <LuSiren />,
      isActive: true,
      items: [
        { title: "Все открытые", url: "/incidents" },
        { title: "Школы", url: "/incidents?sector=SCHOOL" },
        { title: "Детские сады", url: "/incidents?sector=KINDERGARTEN" },
        { title: "Медицина", url: "/incidents?sector=MEDICAL" },
        { title: "Камеры ДП", url: "/incidents?sector=POLICE" },
        { title: "Городские камеры", url: "/incidents?sector=CITY" },
      ],
    },
    {
      title: "Объекты",
      url: "/objects",
      icon: <LuBuilding2 />,
      items: [
        { title: "Все объекты", url: "/objects" },
        { title: "Школы", url: "/objects?sector=SCHOOL" },
        { title: "Детские сады", url: "/objects?sector=KINDERGARTEN" },
        { title: "Медицина", url: "/objects?sector=MEDICAL" },
        { title: "Департамент полиции", url: "/objects?sector=POLICE" },
        { title: "Городские камеры", url: "/objects?sector=CITY" },
      ],
    },
    {
      title: "Мониторинг",
      url: "#",
      icon: <LuMonitor />,
      items: [
        { title: "Аналитика", url: "/monitoring/analytics" },
        { title: "Отчет", url: "/monitoring/reports" },
        { title: "Журнал тревог", url: "/monitoring/alarms" },
      ],
    },
    {
      title: "Камеры",
      url: "/cameras",
      icon: <LuVideo />,
    },
    {
      title: "Экраны",
      url: "/screens",
      icon: <LuTv />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
