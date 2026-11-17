// Запуск сервера (только Node.js): администратор из переменных и автоматический импорт.
export async function bootstrap() {
  try {
    const { db } = await import("./db")
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
    const password = process.env.ADMIN_PASSWORD
    if (email && password && !(await db.user.findUnique({ where: { email } }))) {
      const { hashPassword } = await import("./password")
      await db.user.create({ data: { email, password: hashPassword(password), name: "Администратор", role: "ADMIN" } })
      console.log(`[bootstrap] создан администратор ${email}`)
    }
    if (process.env.AUTO_IMPORT !== "0" && process.env.SOURCE_DATABASE_URL) {
      const imported = await db.alarmEvent.count({ where: { source: { in: ["journal", "live"] } } })
      const cameras = await db.camera.count({ where: { externalId: { not: null } } })
      if (imported === 0 && cameras === 0) {
        const { startImport } = await import("./importer")
        startImport({ media: true })
        console.log("[import] запущен автоматический импорт данных qoz-vision")
      }
    }
  } catch (e) {
    console.error("[bootstrap] ошибка:", e)
  }
}
