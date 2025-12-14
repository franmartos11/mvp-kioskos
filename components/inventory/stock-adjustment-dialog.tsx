"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Box, ArrowUpCircle, ArrowDownCircle, RotateCcw, AlertTriangle } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

const adjustmentSchema = z.object({
  type: z.enum(["restock", "loss", "correction", "return"]),
  quantity: z.coerce.number().min(1, "La cantidad debe ser mayor a 0"),
  reason: z.string().optional(),
  notes: z.string().optional(),
})

interface StockAdjustmentDialogProps {
  product: {
    id: string
    name: string
    stock: number
    kiosk_id: string | null
  }
  onSuccess?: () => void
  trigger?: React.ReactNode
}

export function StockAdjustmentDialog({
  product,
  onSuccess,
  trigger
}: StockAdjustmentDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const form = useForm<z.infer<typeof adjustmentSchema>>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      type: "restock",
      quantity: 0,
      reason: "",
      notes: "",
    },
  })

  // Extract type for easier usage
  type AdjustmentFormValues = z.infer<typeof adjustmentSchema>

  const type = form.watch("type")

  async function onSubmit(values: AdjustmentFormValues) {
    setIsLoading(true)
    
    if (!product.kiosk_id) {
        toast.error("Error: Producto sin kiosco asignado")
        return
    }

    try {
        const { error } = await supabase.rpc('register_stock_adjustment', {
            p_product_id: product.id,
            p_kiosk_id: product.kiosk_id,
            p_type: values.type,
            p_quantity: values.quantity, // Send absolute value, RPC handles sign logic based on type
            p_reason: values.reason || values.type,
            p_notes: values.notes
        })

      if (error) throw error

      toast.success("Stock actualizado correctamente")
      setOpen(false)
      form.reset()
      onSuccess?.()
    } catch (error) {
      console.error(error)
      toast.error("Error al actualizar stock")
    } finally {
      setIsLoading(false)
    }
  }

  const getTypeIcon = () => {
      switch(type) {
          case 'restock': return <ArrowUpCircle className="w-4 h-4 text-green-500" />
          case 'loss': return <ArrowDownCircle className="w-4 h-4 text-red-500" />
          case 'return': return <RotateCcw className="w-4 h-4 text-blue-500" />
          case 'correction': return <AlertTriangle className="w-4 h-4 text-orange-500" />
      }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
            <Button variant="outline" size="sm" className="h-8">
                <Box className="w-4 h-4 mr-2" />
                Ajustar
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ajustar Stock: {product.name}</DialogTitle>
          <DialogDescription>
            Registra una entrada o salida de mercadería. Stock actual: <span className="font-bold">{product.stock}</span>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField<AdjustmentFormValues, "type">
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Movimiento</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <div className="flex items-center gap-2">
                            {getTypeIcon()}
                            <SelectValue placeholder="Seleccionar tipo" />
                        </div>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="restock">📥 Reposición (Entrada)</SelectItem>
                      <SelectItem value="loss">🗑️ Pérdida / Robo (Salida)</SelectItem>
                      <SelectItem value="return">↩️ Devolución (Entrada)</SelectItem>
                      <SelectItem value="correction">⚠️ Corrección (Manual)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField<AdjustmentFormValues, "quantity">
                control={form.control}
                name="quantity"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Cantidad</FormLabel>
                    <FormControl>
                        <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 
                 {/* Show new stock preview */}
                 <div className="flex flex-col justify-center p-3 bg-muted/50 rounded-lg text-sm">
                    <span className="text-muted-foreground">Nuevo Stock:</span>
                    <span className="font-bold text-lg">
                        {type === 'loss' 
                            ? product.stock - (Number(form.watch('quantity')) || 0)
                            : type === 'restock' || type === 'return'
                            ? product.stock + (Number(form.watch('quantity')) || 0)
                            : product.stock /* Correction logic varies */ 
                        }
                    </span>
                 </div>
            </div>

            <FormField<AdjustmentFormValues, "notes">
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea 
                        placeholder="Detalles adicionales..." 
                        className="resize-none" 
                        {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Guardando..." : "Confirmar Movimiento"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
