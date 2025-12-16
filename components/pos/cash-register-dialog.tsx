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

    const form = useForm<z.infer<typeof closeShiftSchema>>({
        resolver: zodResolver(closeShiftSchema) as any,
        defaultValues: {
            final_cash: 0,
            notes: "",
        },
    })

    async function onSubmit(values: z.infer<typeof closeShiftSchema>) {
        setLoading(true)
        try {
            // Using RPC
            const { error } = await supabase.rpc('close_shift', {
                p_shift_id: sessionId,
                p_final_cash: values.final_cash,
                p_notes: values.notes
            })

            if (error) throw error

            toast.success("Caja cerrada correctamente. Revise el reporte para ver diferencias.")
            setOpen(false)
            onSuccess()
        } catch (error: any) {
            console.error(error)
            toast.error("Error al cerrar caja: " + error.message)
        } finally {
            setLoading(false)
        }
    }

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

                <div className="grid gap-4 py-4">
                    <Alert className="bg-muted/50 border-none">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Cierre Ciego</AlertTitle>
                        <AlertDescription>
                            Por seguridad, no se muestra el saldo esperado. Por favor cuenta todo el efectivo en caja.
                        </AlertDescription>
                    </Alert>

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
            </DialogContent>
        </Dialog>
    )
}
