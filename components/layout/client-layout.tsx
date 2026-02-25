"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar, MobileNav } from "@/components/layout/sidebar"
import { supabase } from "@/utils/supabase/client"

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isPublicPage = pathname === "/" || pathname === "/login" || pathname === "/register"

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Capture global recovery events (especially from Supabase Dashboard Implicit flow)
      if (event === 'PASSWORD_RECOVERY') {
        router.push("/update-password")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  if (isPublicPage) {
    return <main className="flex-1 w-full">{children}</main>
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out w-full max-w-[100vw] overflow-x-hidden">
            <MobileNav />
            <main className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    </div>
  )
}
