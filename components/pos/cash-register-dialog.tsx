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

interface SessionSummary {
  totalSales: number
  totalTransactions: number
  byCash: number
  byCard: number
  byTransfer: number
  byFiado: number
  byOther: number
  expectedCash: number   // initialCash + byCash
}

export function CloseShiftDialog({ sessionId, kioskId, initialCash, openedAt, onSuccess }: CloseShiftDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [summary, setSummary] = useState<SessionSummary | null>(null)
    const [loadingSummary, setLoadingSummary] = useState(false)

    const form = useForm<z.infer<typeof closeShiftSchema>>({
        resolver: zodResolver(closeShiftSchema) as any,
        defaultValues: {
            final_cash: 0,
            notes: "",
        },
    })

    const finalCash = form.watch("final_cash") || 0
    const difference = summary ? finalCash - summary.expectedCash : 0

    // Load session summary when dialog opens
    useEffect(() => {
        if (!open) return
        setLoadingSummary(true)
        supabase
            .from('sales')
            .select('total, payment_method')
            .eq('kiosk_id', kioskId)
            .gte('created_at', openedAt)
            .then(({ data }) => {
                const rows = data || []
                const byCash = rows.filter(s => s.payment_method === 'cash').reduce((a, b) => a + b.total, 0)
                const byCard = rows.filter(s => s.payment_method === 'card').reduce((a, b) => a + b.total, 0)
                const byTransfer = rows.filter(s => s.payment_method === 'transfer').reduce((a, b) => a + b.total, 0)
                const byFiado = rows.filter(s => s.payment_method === 'fiado').reduce((a, b) => a + b.total, 0)
                const byOther = rows.filter(s => !['cash','card','transfer','fiado'].includes(s.payment_method)).reduce((a, b) => a + b.total, 0)
                setSummary({
                    totalSales: rows.reduce((a, b) => a + b.total, 0),
                    totalTransactions: rows.length,
                    byCash, byCard, byTransfer, byFiado, byOther,
                    expectedCash: initialCash + byCash,
                })
                setLoadingSummary(false)
            })
    }, [open, kioskId, openedAt, initialCash])

    async function onSubmit(values: z.infer<typeof closeShiftSchema>) {
        setLoading(true)
        try {
            const { error } = await supabase.rpc('close_shift', {
                p_shift_id: sessionId,
                p_final_cash: values.final_cash,
                p_notes: values.notes
            })
            if (error) throw error
            toast.success("Caja cerrada correctamente.")
            setOpen(false)
            onSuccess()
        } catch (error: any) {
            console.error(error)
            toast.error("Error al cerrar caja: " + error.message)
        } finally {
            setLoading(false)
        }
    }

    const fmt = (n: number) => `$${n.toFixed(2)}`

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="ml-auto">
                    Cerrar Caja
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>Cierre de Caja</DialogTitle>
                    <DialogDescription>
                        Revisá el resumen del turno y luego ingresá el efectivo contado.
                    </DialogDescription>
                </DialogHeader>

                {/* ── Session Summary ─────────────────────────────── */}
                {loadingSummary ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : summary && (
                    <div className="space-y-3">
                        {/* Totals row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-primary">{fmt(summary.totalSales)}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Total vendido</p>
                            </div>
                            <div className="bg-muted rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold">{summary.totalTransactions}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Transacciones</p>
                            </div>
                        </div>

                        {/* Breakdown by payment method */}
                        <div className="border rounded-lg divide-y text-sm">
                            <div className="flex justify-between items-center px-4 py-2.5">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Efectivo
                                </span>
                                <span className="font-semibold">{fmt(summary.byCash)}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-2.5">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Tarjeta
                                </span>
                                <span className="font-semibold">{fmt(summary.byCard)}</span>
                            </div>
                            <div className="flex justify-between items-center px-4 py-2.5">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-violet-500 inline-block"/>Transferencia
                                </span>
                                <span className="font-semibold">{fmt(summary.byTransfer)}</span>
                            </div>
                            {summary.byFiado > 0 && (
                            <div className="flex justify-between items-center px-4 py-2.5">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/>Fiado
                                </span>
                                <span className="font-semibold text-orange-600">{fmt(summary.byFiado)}</span>
                            </div>
                            )}
                            {summary.byOther > 0 && (
                            <div className="flex justify-between items-center px-4 py-2.5">
                                <span className="text-muted-foreground flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"/>Otro
                                </span>
                                <span className="font-semibold">{fmt(summary.byOther)}</span>
                            </div>
                            )}
                            <div className="flex justify-between items-center px-4 py-2.5 bg-muted/40 font-semibold rounded-b-lg">
                                <span className="text-xs uppercase tracking-wide">Efectivo esperado en caja</span>
                                <span>{fmt(summary.expectedCash)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Blind close form ────────────────────────────── */}
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

                        {/* Difference indicator */}
                        {summary && finalCash > 0 && (
                            <div className={cn(
                                "flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-semibold",
                                difference === 0 ? "bg-green-50 border-green-200 text-green-700" :
                                Math.abs(difference) < 50 ? "bg-yellow-50 border-yellow-200 text-yellow-700" :
                                "bg-red-50 border-red-200 text-red-700"
                            )}>
                                <span>{difference >= 0 ? "Sobrante" : "Faltante"}</span>
                                <span>{difference >= 0 ? "+" : ""}{fmt(difference)}</span>
                            </div>
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
                            <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={loading}>
                                Cancelar
                            </Button>
                            <Button type="submit" variant="destructive" disabled={loading} className="w-full sm:w-auto">
                                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cerrando...</> : "Confirmar Cierre"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

