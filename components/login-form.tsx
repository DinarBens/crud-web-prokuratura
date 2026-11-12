"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Lock, Mail } from "lucide-react"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Ошибка авторизации")
      }

      // Refresh page context and redirect
      router.refresh()
      router.push("/")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось войти"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 w-full", className)} {...props}>
      <Card className="w-full overflow-hidden p-0 border border-border bg-card shadow-2xl rounded-2xl max-w-[920px] mx-auto">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={handleSubmit} className="p-8 flex flex-col justify-center gap-6">
            <FieldGroup>
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Alatau Vision</h1>
                <p className="text-sm text-muted-foreground">
                  Войдите в систему для доступа к панели управления
                </p>
              </div>

              {error && (
                <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 rounded-lg">
                  {error}
                </div>
              )}

              <Field className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Email адрес
                </FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@prokuratura.kz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10 bg-secondary/20 border-border rounded-lg text-foreground focus-visible:ring-primary focus-visible:ring-1"
                  />
                </div>
              </Field>

              <Field className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Пароль
                  </FieldLabel>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 bg-secondary/20 border-border rounded-lg text-foreground focus-visible:ring-primary focus-visible:ring-1"
                  />
                </div>
              </Field>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-medium py-2 rounded-lg cursor-pointer transition-colors shadow-lg shadow-primary/10 mt-2"
              >
                {loading ? "Вход..." : "Войти"}
              </Button>

              {/* Демо-доступ показывается только если явно включён переменной окружения (не для боевого стенда) */}
              {process.env.NEXT_PUBLIC_DEMO_LOGIN && (
                <div className="text-center text-xs text-muted-foreground border-t border-border/40 pt-4 mt-2">
                  Демо доступ: <span className="font-semibold text-foreground">{process.env.NEXT_PUBLIC_DEMO_LOGIN}</span>
                </div>
              )}
            </FieldGroup>
          </form>
          <div className="relative hidden bg-muted md:block overflow-hidden border-l border-border/80">
            <Image
              src="/login_bg_pattern.png"
              alt="Alatau Vision"
              fill
              className="object-cover dark:brightness-[0.7] transition-all duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
