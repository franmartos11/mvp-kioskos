"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

export function RegisterForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [kioskName, setKioskName] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Sign Up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) {
        toast.error("Error al registrarse: " + authError.message)
        setLoading(false)
        return
      }

      if (!authData.user) {
        toast.error("No se pudo crear el usuario")
        setLoading(false)
        return
      }

      const userId = authData.user.id

      // 2. Create Kiosk (via RPC to bypass RLS/Session issues)
      const { data: kioskData, error: kioskError } = await supabase
        .rpc('create_initial_kiosk', {
          p_kiosk_name: kioskName,
          p_owner_id: userId
        })

      if (kioskError) {
        console.error("Kiosk Error:", kioskError)
        toast.error("Usuario creado, pero hubo error al crear el Kiosco. " + kioskError.message)
        setLoading(false)
        return
      }

      toast.success("¡Cuenta y Kiosco creados con éxito!")
      router.push("/dashboard")
      router.refresh()

    } catch (error) {
      toast.error("Ocurrió un error inesperado")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleRegister} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="kioskName">Nombre del Kiosco / Negocio</Label>
        <Input
          id="kioskName"
          type="text"
          placeholder="Ej. Kiosco Pepe"
          value={kioskName}
          onChange={(e) => setKioskName(e.target.value)}
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
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </div>
      <Button className="w-full" type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Registrarse y Comenzar
      </Button>
    </form>
  )
}
