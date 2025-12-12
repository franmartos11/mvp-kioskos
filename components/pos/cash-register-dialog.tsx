"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, DollarSign, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { supabase } from "@/utils/supabase/client"

const openShiftSchema = z.object({
  initial_cash: z.coerce.number().min(0, "El monto no puede ser negativo"),
  notes: z.string().optional(),
})

interface OpenShiftDialogProps {
  kioskId: string
  userId: string
  onSuccess: () => void
}

export function OpenShiftDialog({ kioskId, userId, onSuccess }: OpenShiftDialogProps) {
  const [loading, setLoading] = useState(false)

  const form = useForm<z.infer<typeof openShiftSchema>>({
    resolver: zodResolver(openShiftSchema) as any,
    defaultValues: {
      initial_cash: 0,
      notes: "",
    },
  })

  async function onSubmit(values: z.infer<typeof openShiftSchema>) {
    setLoading(true)
    try {
      const { error } = await supabase.from("cash_sessions").insert({
        kiosk_id: kioskId,
        user_id: userId,
        initial_cash: values.initial_cash,
        notes: values.notes,
        status: "open",
        opened_at: new Date().toISOString(),
      })

      if (error) throw error

      toast.success("Caja abierta correctamente")
      onSuccess()
    } catch (error) {
      console.error(error)
      toast.error("Error al abrir caja")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Apertura de Caja</DialogTitle>
          <DialogDescription>
            Debes abrir la caja para comenzar a operar. Ingresa el dinero inicial en efectivo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="initial_cash"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Efectivo Inicial</FormLabel>
                  <FormControl>
                    <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="number" step="0.01" className="pl-9" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Observaciones..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Abrir Caja
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

const closeShiftSchema = z.object({
  final_cash: z.coerce.number().min(0, "El monto no puede ser negativo"),
  notes: z.string().optional(),
})

interface CloseShiftDialogProps {
    sessionId: string
    kioskId: string
    initialCash: number
    openedAt: string
    onSuccess: () => void
}

export function CloseShiftDialog({ sessionId, kioskId, initialCash, openedAt, onSuccess }: CloseShiftDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [calculating, setCalculating] = useState(false)
    const [stats, setStats] = useState({
        salesCash: 0,
        salesOther: 0,
        expectedCash: 0
    })

    const form = useForm<z.infer<typeof closeShiftSchema>>({
        resolver: zodResolver(closeShiftSchema) as any,
        defaultValues: {
            final_cash: 0,
            notes: "",
        },
    })

    // Calculate totals when dialog opens
    useEffect(() => {
        if (open) {
            calculateTotals()
        }
    }, [open])

    async function calculateTotals() {
        setCalculating(true)
        // Fetch sales since openedAt
        const { data: sales } = await supabase
            .from('sales')
            .select('total, payment_method')
            .eq('kiosk_id', kioskId)
            .gte('created_at', openedAt)
        
        const salesCash = sales 
            ? sales.filter(s => s.payment_method === 'cash').reduce((acc, s) => acc + s.total, 0)
            : 0
        
        const salesOther = sales
            ? sales.filter(s => s.payment_method !== 'cash').reduce((acc, s) => acc + s.total, 0)
            : 0

        const expectedCash = initialCash + salesCash
        // TODO: Subtract withdrawals if we implement that feature

        setStats({
            salesCash,
            salesOther,
            expectedCash
        })
        setCalculating(false)
    }

    async function onSubmit(values: z.infer<typeof closeShiftSchema>) {
        setLoading(true)
        try {
            const difference = values.final_cash - stats.expectedCash

            const { error } = await supabase
                .from('cash_sessions')
                .update({
                    closed_at: new Date().toISOString(),
                    final_cash: values.final_cash,
                    expected_cash: stats.expectedCash,
                    difference: difference,
                    notes: values.notes,
                    status: 'closed'
                })
                .eq('id', sessionId)

            if (error) throw error

            toast.success("Caja cerrada correctamente")
            setOpen(false)
            onSuccess()
        } catch (error) {
            console.error(error)
            toast.error("Error al cerrar caja")
        } finally {
            setLoading(false)
        }
    }

    const currentDiff = (form.watch('final_cash') || 0) - stats.expectedCash

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="ml-auto">
                    Cerrar Caja
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Cierre de Caja</DialogTitle>
                    <DialogDescription>
                        Verifica los montos y cuenta el efectivo en caja.
                    </DialogDescription>
                </DialogHeader>

                {calculating ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex flex-col gap-1 p-3 bg-muted/50 rounded-md">
                                <span className="text-muted-foreground">Efectivo Inicial</span>
                                <span className="font-bold text-lg">${initialCash}</span>
                            </div>
                            <div className="flex flex-col gap-1 p-3 bg-muted/50 rounded-md">
                                <span className="text-muted-foreground">Ventas Efectivo</span>
                                <span className="font-bold text-lg text-green-600">+${stats.salesCash}</span>
                            </div>
                            <div className="flex flex-col gap-1 p-3 bg-muted/50 rounded-md">
                                <span className="text-muted-foreground">Ventas Otros Medios</span>
                                <span className="font-bold text-lg text-blue-600">${stats.salesOther}</span>
                            </div>
                            <div className="flex flex-col gap-1 p-3 bg-primary/10 rounded-md border border-primary/20">
                                <span className="text-primary font-medium">Esperado en Caja</span>
                                <span className="font-bold text-lg">${stats.expectedCash}</span>
                            </div>
                        </div>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="final_cash"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Efectivo Real (Contado)</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                     <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                                    <Input 
                                                        type="number" 
                                                        step="0.01" 
                                                        className="pl-9 text-lg font-bold" 
                                                        {...field} 
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                
                                <div className="flex items-center justify-between p-3 rounded-md border">
                                    <span className="text-sm font-medium">Diferencia</span>
                                    <span className={cn(
                                        "font-bold",
                                        currentDiff === 0 ? "text-green-600" :
                                        currentDiff > 0 ? "text-blue-600" : "text-red-600"
                                    )}>
                                        {currentDiff > 0 ? "+" : ""}{currentDiff}
                                    </span>
                                </div>
                                {currentDiff !== 0 && (
                                    <Alert variant="destructive" className="py-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle className="text-sm">Atención: Hay diferencias</AlertTitle>
                                        <AlertDescription className="text-xs">
                                            Por favor verifica el conteo. Si es correcto, explica la diferencia en notas.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Notas</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Comentarios sobre el cierre..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter>
                                    <Button type="submit" disabled={loading} className="w-full">
                                        {loading ? "Cerrando..." : "Cerrar Turno"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
