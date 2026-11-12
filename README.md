This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Alatau Vision — платформа для прокуратуры г. Шымкент

### Что добавлено
- **Единый реестр объектов** (`/objects`): школы, детские сады, медицина, подразделения ДП, городские камеры; камеры онлайн/всего, открытые инциденты, ответственные.
- **Инциденты** (`/incidents`): единый журнал по всем секторам, статусы (Новый → На проверке → Передан → Отработан / Ложное срабатывание), передача в УП района / ДП / управления, журнал действий, контроль нормативов реакции (критичные — 15 мин), автообновление 30 с.
- **Аналитика** (`/monitoring/analytics`): KPI, динамика по дням, сектора, районы, тепловая карта «день недели × час», частые типы, проблемные объекты, доступность камер.
- **Карта**: весь город, слои по секторам, подсветка объектов с открытыми инцидентами.
- **Роли**: ADMIN, PROSECUTOR, POLICE, EDUCATION (школы+сады), HEALTH (медицина) — доступ к данным фильтруется на сервере.
- **Безопасность**: подписанная сессия (HMAC), хэширование паролей (scrypt), API отвечает 401 без сессии, демо-логин скрыт на странице входа.

### Деплой (Railway)
1. Переменные: `SESSION_SECRET` (длинная случайная строка), опционально `DEMO_PASSWORD`, `NEXT_PUBLIC_DEMO_LOGIN`, `CAMERAS_JSON_PATH`.
2. Схема БД: `npx prisma db push` (добавляет таблицы `Facility`, `IncidentAction` и новые поля).
3. Демо-данные: `npx prisma db seed` — **удаляет** текущие камеры/экраны/события и создаёт 76 объектов, ~340 камер, ~600 инцидентов за 30 дней.
   Демо-пользователи: admin@edtech.kz, prokuratura@demo.kz, police@demo.kz, education@demo.kz, health@demo.kz (пароль — `DEMO_PASSWORD`, по умолчанию admin123).
