"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PosContainer } from "@/components/pos/pos-container"
import { supabase } from "@/utils/supabase/client"
import { Product } from "@/types/inventory"
import { OpenShiftDialog, CloseShiftDialog } from "@/components/pos/cash-register-dialog"

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  
  const [session, setSession] = useState<any>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [kioskId, setKioskId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoadingSession(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    
    // Get Kiosk ID
    const { data: member } = await supabase.from('kiosk_members').select('kiosk_id').eq('user_id', user.id).maybeSingle()
    if (member) {
        setKioskId(member.kiosk_id)
        
        // Check for open session
        const { data: openSession } = await supabase
            .from('cash_sessions')
            .select('*')
            .eq('kiosk_id', member.kiosk_id)
            .eq('status', 'open')
            .maybeSingle()
            
        setSession(openSession)
    }

    // Load products
    const { data, error } = await supabase.from('products').select('*').order('name').limit(50)
    if (data) {
        setProducts(data as Product[])
    }
    
    setLoading(false)
    setLoadingSession(false)
  }

  return (
       (loading || loadingSession ? (
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
                 {kioskId && userId && (
                    <OpenShiftDialog 
                        kioskId={kioskId} 
                        userId={userId} 
                        onSuccess={loadData} 
                    />
                 )}
                 {!kioskId && (
                    <div className="p-4 bg-destructive/10 text-destructive rounded-md">
                        No tienes un kiosco asignado. Contacta al administrador.
                    </div>
                 )}
              </div>
          </div>
       ) : (
         <div className="flex flex-col h-[calc(100vh-4rem)]">
             <div className="h-14 border-b flex items-center justify-between px-4 bg-background shrink-0">
                 <div className="flex items-center gap-2">
                    <span className="font-semibold">Caja Abierta</span>
                    <span className="text-muted-foreground text-sm">
                        {format(new Date(session.opened_at), 'HH:mm')}
                    </span>
                 </div>
                 {kioskId && (
                     <CloseShiftDialog 
                        sessionId={session.id}
                        kioskId={kioskId}
                        initialCash={session.initial_cash}
                        openedAt={session.opened_at}
                        onSuccess={loadData}
                     />
                 )}
             </div>
             <div className="flex-1 overflow-hidden p-4">
                <PosContainer initialProducts={products} />
             </div>
         </div>
       ))
  )
}
