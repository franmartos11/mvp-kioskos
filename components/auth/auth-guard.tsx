"use client"

import React, { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { LogOut, User, Store } from "lucide-react"
import { Avatar, AvatarFallback } from "../ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { toast } from "sonner"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [kioskName, setKioskName] = useState("")
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.replace("/")
          return
        }

        setUser(user)
        
        // Fetch kiosk info
        const { data: member } = await supabase
            .from('kiosk_members')
            .select('kiosk_id, kiosks(name)')
            .eq('user_id', user.id)
            .maybeSingle()
        
        if (member && member.kiosks) {
            // @ts-ignore
            setKioskName(member.kiosks.name)
        }

      } catch (error) {
        console.error("Auth check error:", error)
        router.replace("/")
      } finally {
        setLoading(false)
      }
    }

    checkUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace("/")
      } else if (session?.user) {
        setUser(session.user)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // NOTE: intentionally empty deps - auth check runs once on mount only.
  // Adding router or pathname here causes re-subscription on every navigation.

  const queryClient = useQueryClient()

  const handleLogout = async () => {
    // 1. Clear local state
    localStorage.removeItem("kiosk_id")
    
    // 2. Clear query cache to avoid mixture of data between users
    queryClient.removeQueries()
    queryClient.clear()

    // 3. Sign out
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error("Error al cerrar sesión")
    } else {
      router.replace("/")
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando aplicación...</div>
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
         <div className="flex items-center gap-2 font-bold text-xl">
            <Store className="w-6 h-6" />
            {kioskName || "Mi Kiosco"}
         </div>
         
         <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarFallback>{user.email?.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Toggle user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-muted-foreground cursor-default">
                    {user.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-500 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
         </div>
      </header>
      <main className="flex-1 flex flex-col p-4 sm:px-6 sm:py-0">
        {children}
      </main>
    </div>
  )
}
