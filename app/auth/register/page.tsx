"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

function RegisterAsSellerForm() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get("email") || ""
  const inviteToken = searchParams.get("invite_token") || ""
  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const isInviteFlow = !!initialEmail && !!inviteToken

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      })

      if (authError) {
        toast.error("Error al registrarse: " + authError.message)
        return
      }

      if (!authData.user) {
        toast.error("No se pudo crear el usuario")
        return
      }

      // Duplicated email check (Supabase returns empty identities when email exists)
      if (authData.user.identities && authData.user.identities.length === 0) {
        toast.error("Este email ya está registrado. Por favor inicia sesión.")
        return
      }

      toast.success("¡Cuenta creada! Procesando invitación...")

      // If there's an invite token in the URL, use it directly
      if (isInviteFlow && inviteToken) {
        router.push(`/invite/accept?token=${inviteToken}`)
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error) {
      toast.error("Ocurrió un error inesperado")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <Link
        href="/login"
        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Volver</span>
      </Link>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <ShoppingCart className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Crear cuenta</CardTitle>
          {isInviteFlow ? (
            <CardDescription>
              Creá tu cuenta para aceptar la invitación al kiosco.
            </CardDescription>
          ) : (
            <CardDescription>Registrate para comenzar</CardDescription>
          )}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Juan Pérez"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                // If coming from an invite link, lock the email field
                readOnly={isInviteFlow}
                className={isInviteFlow ? "bg-muted cursor-not-allowed" : ""}
              />
              {isInviteFlow && (
                <p className="text-xs text-muted-foreground">
                  Este email está asociado a tu invitación y no puede cambiarse.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button className="w-full" type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isInviteFlow ? "Crear cuenta y aceptar invitación" : "Crear cuenta"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{" "}
            <Link
              href={isInviteFlow ? `/login?email=${encodeURIComponent(email)}&redirect=/api/invite/accept` : "/login"}
              className="font-semibold text-primary hover:underline"
            >
              Iniciar sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <RegisterAsSellerForm />
    </Suspense>
  )
}
