"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, ShoppingCart } from "lucide-react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ForgotPasswordDialog } from "@/components/auth/forgot-password-dialog"

function LoginPageContent() {
  const searchParams = useSearchParams()
  const defaultEmail = searchParams.get("email") || ""
  const redirectTo = searchParams.get("redirect") || "/dashboard"

  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const redirectTo = searchParams.get("redirect") || "/dashboard"
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.push(redirectTo)
      } else {
        setCheckingAuth(false)
      }
    })
  }, [router, searchParams])

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <Link
        href="/"
        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Volver al inicio</span>
      </Link>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <ShoppingCart className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">KioskApp</CardTitle>
          <CardDescription className="text-base">
            Inicia sesión para continuar
          </CardDescription>
        </CardHeader>

        <CardContent>
          <LoginForm defaultEmail={defaultEmail} redirectTo={redirectTo} />
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t pt-6 bg-muted/20 rounded-b-lg">
          <div className="text-sm text-center text-muted-foreground w-full flex items-center justify-center gap-2">
            <span>¿No tienes cuenta?</span>
            <Link
              href="/auth/register"
              className="font-semibold text-primary hover:underline hover:text-primary transition-colors"
            >
              Regístrate gratis
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

// --- Login Form (with optional pre-filled email) ---
function LoginForm({ defaultEmail = "", redirectTo = "/dashboard" }: { defaultEmail?: string; redirectTo?: string }) {
  const [email, setEmail] = useState(defaultEmail)
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error("Error al iniciar sesión: " + error.message)
        return
      }
      toast.success("¡Bienvenido!")
      router.push(redirectTo)
      router.refresh()
    } catch (error) {
      toast.error("Ocurrió un error inesperado")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          name="email"
          id="email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          name="password"
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="flex justify-end">
        <ForgotPasswordDialog />
      </div>
      <Button className="w-full" type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Ingresar
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}
