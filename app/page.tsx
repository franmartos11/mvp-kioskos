"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/auth/login-form"
import { RegisterForm } from "@/components/auth/register-form"
import { Button } from "@/components/ui/button"

export default function Home() {
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
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
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
