"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, DollarSign, ArrowUpCircle, ArrowDownCircle } from "lucide-react"
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
import { supabase } from "@/utils/supabase/client"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const movementSchema = z.object({
  type: z.enum(["deposit", "withdrawal"]),
  amount: z.coerce.number().min(0.01, "El monto debe ser mayor a 0"),
  reason: z.string().min(3, "La razón es requerida"),
  description: z.string().optional(),
})

interface CashMovementsDialogProps {
  sessionId: string
  kioskId: string
  userId: string
  onSuccess?: () => void
}

export function CashMovementsDialog({ sessionId, kioskId, userId, onSuccess }: CashMovementsDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const form = useForm({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      type: "withdrawal",
      amount: 0,
      reason: "",
      description: ""
    },
  })

  async function onSubmit(values: z.infer<typeof movementSchema>) {
    setLoading(true)
    try {
      const { error } = await supabase.from("cash_movements").insert({
        cash_session_id: sessionId,
        kiosk_id: kioskId,
        user_id: userId,
        type: values.type,
        amount: values.amount,
        reason: values.reason,
        description: values.description
      })

      if (error) throw error

      toast.success(values.type === 'deposit' ? "Ingreso registrado" : "Retiro registrado")
      setOpen(false)
      form.reset()
      onSuccess?.()
    } catch (error: any) {
      console.error(error)
      toast.error("Error al registrar movimiento: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const type = form.watch("type")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
            <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
            Movimientos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Movimiento de Caja</DialogTitle>
          <DialogDescription>
            Registra ingresos o egresos de efectivo manuales.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimiento</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="withdrawal" className="text-red-600 font-medium">
                        <span className="flex items-center gap-2">
                            <ArrowDownCircle className="h-4 w-4" /> Retiro (Egreso)
                        </span>
                      </SelectItem>
                      <SelectItem value="deposit" className="text-emerald-600 font-medium">
                         <span className="flex items-center gap-2">
                            <ArrowUpCircle className="h-4 w-4" /> Ingreso (Depósito)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <div className="relative">
                        <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="number" 
                            step="0.01" 
                            className={cn(
                                "pl-9 font-bold text-lg",
                                type === 'withdrawal' ? "text-red-600" : "text-emerald-600"
                            )} 
                            {...field} 
                            value={field.value as number} 
                        />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Pago a Proveedor, Retiro de Ganancia..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Detalles adicionales..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="submit" 
                disabled={loading} 
                className={cn(
                    "w-full",
                    type === 'withdrawal' ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar {type === 'withdrawal' ? 'Retiro' : 'Ingreso'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
