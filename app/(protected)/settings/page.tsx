"use client"

import { KioskManager } from "@/components/custom/kiosk-manager"
import { useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const [isOwner, setIsOwner] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('kiosk_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'owner')
        .limit(1)
      
      if (data && data.length > 0) {
        setIsOwner(true)
      } else {
        setIsOwner(false)
        router.push('/pos') // Redirect if not owner
      }
    }
    checkRole()
  }, [router])

  if (isOwner === null) return <div>Verificando permisos...</div>
  if (!isOwner) return null

  return (
      <div className="container mx-auto py-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
          <p className="text-muted-foreground">
            Administra tus kioscos y permisos de empleados.
          </p>
        </div>
        
        <KioskManager />
      </div>
  )
}
