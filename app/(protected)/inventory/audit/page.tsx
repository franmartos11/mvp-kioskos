"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ClipboardList, Play, CheckCircle, ArrowRight, ArrowLeft, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useKiosk } from "@/components/providers/kiosk-provider"

// Audit Types
type Audit = {
  id: string
  created_at: string
  status: 'in_progress' | 'completed' | 'cancelled'
  completed_at: string | null
  performed_by: string
}

type Product = {
    id: string
    name: string
    barcode: string
}

export default function AuditPage() {
  const router = useRouter()
  const { currentKiosk } = useKiosk()
  const [activeAudit, setActiveAudit] = useState<Audit | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [auditItems, setAuditItems] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  
  // Wizard State
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentProduct = products[currentIndex]
  const [currentQty, setCurrentQty] = useState<string>("")
  const qtyInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  useEffect(() => {
    if (currentKiosk) {
        fetchActiveAudit()
    }
  }, [currentKiosk])

  // Focus input when product changes
  useEffect(() => {
      if (currentProduct && qtyInputRef.current) {
          // Pre-fill value if already entered
          if (auditItems[currentProduct.id] !== undefined) {
              setCurrentQty(auditItems[currentProduct.id].toString())
          } else {
              setCurrentQty("") 
          }
          qtyInputRef.current.focus()
      }
  }, [currentIndex, currentProduct, auditItems])

  async function fetchActiveAudit() {
    if (!currentKiosk) return
    setIsLoading(true)
    try {
        const { data: audits } = await supabase
            .from('stock_audits')
            .select('*')
            .eq('kiosk_id', currentKiosk.id)
            .eq('status', 'in_progress')
            .limit(1)

        if (audits && audits.length > 0) {
            setActiveAudit(audits[0])
            await fetchProducts(audits[0].kiosk_id)
        } else {
            setActiveAudit(null) // Reset if no audit for this kiosk
        }
    } catch (error) {
        console.error("Error fetching audit", error)
    } finally {
        setIsLoading(false)
    }
  }

  async function fetchProducts(kioskId: string) {
      const { data } = await supabase
        .from('products')
        .select('id, name, barcode')
        .eq('kiosk_id', kioskId)
      
      if (data) setProducts(data)
  }

  async function startAudit() {
    if (!currentKiosk) return
    setIsLoading(true)
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No user")

        const { data: newAudit, error } = await supabase
            .from('stock_audits')
            .insert({
                kiosk_id: currentKiosk.id,
                performed_by: user.id,
                status: 'in_progress'
            })
            .select()
            .single()

        if (error) throw error

        setActiveAudit(newAudit)
        await fetchProducts(currentKiosk.id)
        toast.success("Auditoría iniciada")

    } catch (error) {
        console.error(error)
        toast.error("Error al iniciar auditoría")
    } finally {
        setIsLoading(false)
    }
  }

  async function finishAudit() {
      if (!activeAudit) return
      setSubmitting(true)

      try {
          const itemsPayload = Object.entries(auditItems).map(([productId, qty]) => ({
              product_id: productId,
              quantity: qty
          }))

          const { error } = await supabase.rpc('finish_stock_audit', {
              p_audit_id: activeAudit.id,
              p_items: itemsPayload
          })

          if (error) throw error

          toast.success("Auditoría finalizada y stock corregido")
          router.push('/inventory')
          
      } catch (error) {
          console.error(error)
          toast.error("Error al finalizar auditoría")
      } finally {
          setSubmitting(false)
      }
  }

  const handleNext = () => {
      // Save current input
      if (currentQty !== "") {
          setAuditItems(prev => ({
              ...prev,
              [currentProduct.id]: parseInt(currentQty)
          }))
      } else {
        // If empty, user might mean 0 or skipped.
        // Let's assume skipping if empty string, but maybe they want to confirm 0?
        // To force "Control de TODO", we should probably block next if empty?
        // Let's allow skip, but if they explicitly type 0 it's 0.
      }
      
      // Move next
      if (currentIndex < products.length - 1) {
          setCurrentIndex(prev => prev + 1)
      }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          handleNext()
      }
  }
  
  // Progress calc
  const countProgress = (Object.keys(auditItems).length / (products.length || 1)) * 100
  const isLastProduct = currentIndex === products.length - 1

  if (!activeAudit && !isLoading) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
              <ClipboardList className="w-16 h-16 text-muted-foreground" />
              <h1 className="text-2xl font-bold">Control de Stock Ciego</h1>
              <p className="text-muted-foreground text-center max-w-md">
                  Vas a realizar un control físico de tu inventario. 
                  El sistema te mostrará los productos uno por uno para que ingreses la cantidad real.
              </p>
              <Button size="lg" onClick={startAudit}>
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar Auditoría
              </Button>
          </div>
      )
  }
  
  if (products.length === 0 && !isLoading) {
      return <div className="p-8 text-center text-muted-foreground">No hay productos en este kiosco.</div>
  }

  if (activeAudit && currentProduct) {
      return (
        <div className="container max-w-xl mx-auto py-10 space-y-8">
            <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Producto {currentIndex + 1} de {products.length}</span>
                    <span>{Math.round(countProgress)}% completado</span>
                </div>
                <Progress value={countProgress} className="h-2" />
            </div>

            <Card className="border-2 shadow-lg">
                <CardHeader className="text-center pb-2">
                    <Badge variant="outline" className="w-fit mx-auto mb-2">
                        {currentProduct.barcode || "Sin Código"}
                    </Badge>
                    <CardTitle className="text-2xl sm:text-3xl">{currentProduct.name}</CardTitle>
                    <CardDescription>
                        Ingresa la cantidad física que ves
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-4">
                    <div className="flex justify-center">
                        <Input 
                            ref={qtyInputRef}
                            type="number"
                            min="0"
                            placeholder="0"
                            className="text-center text-4xl font-bold h-20 w-40"
                            value={currentQty}
                            onChange={(e) => setCurrentQty(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button 
                            variant="outline" 
                            className="flex-1" 
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Anterior
                        </Button>

                        {isLastProduct ? (
                            <Button 
                                className="flex-1" 
                                size="lg" 
                                variant="default"
                                onClick={() => {
                                    handleNext() // Save last one
                                    finishAudit()
                                }}
                                disabled={submitting}
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Finalizar Todo
                            </Button>
                        ) : (
                            <Button 
                                className="flex-1" 
                                size="lg"
                                onClick={handleNext}
                            >
                                Siguiente
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
            
            <div className="text-center">
                <Button variant="ghost" className="text-muted-foreground" onClick={() => router.push('/inventory')}>
                    Cancelar y salir
                </Button>
            </div>
        </div>
      )
  }

  return <div className="p-8 text-center text-muted-foreground"><RefreshCw className="animate-spin w-8 h-8 mx-auto" /></div>
}
