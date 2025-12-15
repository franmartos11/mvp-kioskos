"use client"

import { usePathname } from "next/navigation"
import { Sidebar, MobileNav } from "@/components/layout/sidebar"

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname()
  const isPublicPage = pathname === "/" || pathname === "/login" || pathname === "/register"

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
