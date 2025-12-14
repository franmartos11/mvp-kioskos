"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PosContainer } from "@/components/pos/pos-container"
import { supabase } from "@/utils/supabase/client"
import { Product } from "@/types/inventory"
import { OpenShiftDialog, CloseShiftDialog } from "@/components/pos/cash-register-dialog"
import { useKiosk } from "@/components/providers/kiosk-provider"

import { useProducts } from "@/hooks/use-products"

export default function PosPage() {
  const { currentKiosk } = useKiosk()
  
  // Use TanStack Query for products
  const { 
    data: products = [], 
    isLoading: userProductsLoading 
  } = useProducts(currentKiosk?.id)

  const [session, setSession] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [currentKiosk])

  async function loadData() {
    if (!currentKiosk) return

    setLoadingSession(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    
    // Check for open session using currentKiosk.id
    const { data: openSession } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('kiosk_id', currentKiosk.id)
        .eq('status', 'open')
        .maybeSingle()
        
    setSession(openSession)
    setLoadingSession(false)
  }

  if (!currentKiosk) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground gap-2">
            <div className="p-4 bg-yellow-500/10 text-yellow-500 rounded-md">
                Por favor selecciona un kiosco para continuar.
            </div>
        </div>
      )
  }

  return (
       (userProductsLoading || loadingSession ? (
         <div className="flex h-full items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando POS...
         </div>
       ) : !session ? (
         <div className="flex h-full w-full items-center justify-center bg-muted/20 p-4">
              <div className="text-center space-y-4 max-w-md mx-auto">
                 <h1 className="text-2xl font-bold">Punto de Venta Cerrado</h1>
                 <p className="text-muted-foreground">
                    Para comenzar a realizar ventas, es necesario realizar la apertura de caja indicando el saldo inicial.
                 </p>
                 {userId && (
                    <OpenShiftDialog 
                        kioskId={currentKiosk.id} 
                        userId={userId} 
                        onSuccess={loadData} 
                    />
                 )}
              </div>
          </div>
       ) : (
         <div className="flex flex-col h-[calc(100vh-4rem)]">
             <div className="m-2 mb-0 border rounded-xl flex items-center justify-between px-6 py-3 bg-background shrink-0 shadow-sm z-10">
                 <div className="flex items-center gap-3">
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-none">Caja Abierta</h1>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            Abierto a las <span className="font-medium text-foreground">{format(new Date(session.opened_at), 'HH:mm')}</span>
                        </p>
                    </div>
                 </div>
                 <CloseShiftDialog 
                    sessionId={session.id}
                    kioskId={currentKiosk.id}
                    initialCash={session.initial_cash}
                    openedAt={session.opened_at}
                    onSuccess={loadData}
                 />
             </div>
             <div className="flex-1 overflow-hidden p-2">
                <PosContainer initialProducts={products} />
             </div>
         </div>
       ))
  )
}
