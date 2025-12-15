"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.push("/dashboard")
      } else {
        setCheckingAuth(false)
      }
    })
  }, [router])

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
          <CardTitle className="text-3xl font-bold text-primary">Kiosk POS</CardTitle>
          <CardDescription className="text-base">
            {isLogin ? "Inicia sesión para continuar" : "Registra tu negocio y comienza"}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {isLogin ? <LoginForm /> : <RegisterForm />}
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t pt-6 bg-muted/20 rounded-b-lg">
          <div className="text-sm text-center text-muted-foreground w-full flex items-center justify-center gap-2">
            <span>{isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}</span>
            <Button 
                variant="link" 
                className="p-0 h-auto font-semibold"
                onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Regístrate gratis" : "Inicia sesión"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
