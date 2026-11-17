// Выполняется один раз при запуске сервера.
// 1) Создаёт администратора из ADMIN_EMAIL / ADMIN_PASSWORD, если его ещё нет.
// 2) Если база пустая и задан SOURCE_DATABASE_URL — один раз импортирует данные qoz-vision (AUTO_IMPORT=0 отключает).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrap } = await import("./lib/bootstrap")
    await bootstrap()
  }
}
