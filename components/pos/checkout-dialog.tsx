"use client"

import { useState } from "react"
import { CartItem, PaymentMethod } from "@/types/pos"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  onConfirm: (method: PaymentMethod, customerName?: string) => Promise<void>
}

export function CheckoutDialog({ open, onOpenChange, items, onConfirm }: CheckoutDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [loading, setLoading] = useState(false)
  
  const [customerName, setCustomerName] = useState("")
  
  const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)

  async function handleConfirm() {
    try {
        setLoading(true)
        await onConfirm(method, customerName)
    } finally {
        setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar Venta</DialogTitle>
          <DialogDescription>
            Resumen de la transacción
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="flex justify-between items-center text-xl font-bold">
                <span>Total a Pagar</span>
                <span>${total.toFixed(2)}</span>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Método de Pago</label>
                <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="cash">Efectivo</SelectItem>
                        <SelectItem value="card">Tarjeta</SelectItem>
                        <SelectItem value="transfer">Transferencia</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {method === 'transfer' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-sm font-medium">Nombre de quien transfiere</label>
                    <Input 
                        placeholder="Ej: Juan Pérez" 
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                    />
                </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
