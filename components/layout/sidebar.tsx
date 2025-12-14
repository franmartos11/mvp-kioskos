"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Package, ShoppingCart, Settings, Menu, DollarSign, Receipt, Users, Truck, Wallet, TrendingDown, ClipboardList } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
const navItems = [
  { href: "/dashboard", label: "Inicio", icon: Home },
  { href: "/pos", label: "Punto de Venta", icon: ShoppingCart },
  { href: "/inventory", label: "Inventario", icon: Package },
  { href: "/suppliers", label: "Proveedores", icon: Truck },
  { href: "/sales", label: "Ventas", icon: DollarSign },
  { href: "/cash", label: "Caja", icon: Wallet },
  { href: "/expenses", label: "Gastos", icon: TrendingDown },
  { href: "/employees", label: "Empleados", icon: Users },
  { href: "/settings", label: "Configuración", icon: Settings },
]

export function MainNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname()
  const [isOwner, setIsOwner] = useState(false)

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
      }
    }
    checkRole()
  }, [])

  return (
    <nav
      className={cn("flex flex-col space-y-2 p-4", className)}
      {...props}
    >
      {navItems.map((item) => {
        // Hide Settings if not owner
        if (item.href === "/settings" && !isOwner) {
            return null
        }

        const Icon = item.icon
        const isActive = pathname === item.href
        
        // Hide "Inicio" in MainNav if we want specific behavior, but for now just show all items.
// ... existing logic ...
        if (item.href === "/" && pathname !== "/") {
             // Maybe we don't want a "Back to Login" button if we are logged in? 
             // But let's leave as is for now, the main request is hiding the whole bar.
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            setIsAuthenticated(!!session)
            setIsLoading(false)
        }

        checkAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsAuthenticated(!!session)
            setIsLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    return { isAuthenticated, isLoading }
}

export function Sidebar() {
  const { isAuthenticated, isLoading } = useAuth()

  // Don't show sidebar on loading to prevent flash, or if not authenticated
  if (isLoading || !isAuthenticated) return null

  return (
    <aside className="hidden w-64 border-r bg-card md:block h-screen sticky top-0">
      <div className="flex h-14 items-center border-b px-6">
        <Link href="/pos" className="flex items-center gap-2 font-semibold text-lg">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <span>KioskApp</span>
        </Link>
      </div>
      <MainNav />
    </aside>
  )
}

export function MobileNav() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading || !isAuthenticated) return null

  return (
    <div className="md:hidden flex items-center p-4 border-b bg-background sticky top-0 z-10 justify-between">
      <div className="flex items-center gap-2 font-bold text-lg">
          <ShoppingCart className="h-6 w-6 text-primary" />
          <span>KioskApp</span>
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] sm:w-[300px] p-0">
          <SheetTitle className="sr-only">Menu de Navegación</SheetTitle>
          <div className="flex h-14 items-center border-b px-6">
            <span className="font-bold text-lg">Menú</span>
          </div>
          <MainNav />
        </SheetContent>
      </Sheet>
    </div>
  )
}
