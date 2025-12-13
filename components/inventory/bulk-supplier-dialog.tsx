"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"

interface BulkSupplierDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (supplierId: string, percentage: number) => Promise<void>
}

export function BulkSupplierDialog({
  open,
  onOpenChange,
  onConfirm,
}: BulkSupplierDialogProps) {
  const [percentage, setPercentage] = useState<string>("")
  const [supplierId, setSupplierId] = useState<string>("")
  const [suppliers, setSuppliers] = useState<{id: string, name: string}[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadSuppliers()
    }
  }, [open])

  async function loadSuppliers() {
      const { data } = await supabase.from('suppliers').select('id, name').order('name')
      if (data) setSuppliers(data)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!supplierId) {
        toast.error("Seleccione un proveedor")
        return
    }

    const value = parseFloat(percentage)
    if (isNaN(value) || value <= 0) {
      toast.error("Por favor ingrese un porcentaje válido")
      return
    }

    try {
      setLoading(true)
      await onConfirm(supplierId, value)
      setPercentage("")
      setSupplierId("")
      onOpenChange(false)
    } catch (error) {
      console.log(error)
      toast.error("Hubo un error al actualizar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Actualizar por Proveedor</DialogTitle>
          <DialogDescription>
            Aumentará el precio de todos los productos del proveedor seleccionado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="supplier" className="text-right">
                Proveedor
              </Label>
              <div className="col-span-3">
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                        {suppliers.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="percentage" className="text-right">
                Porcentaje
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id="percentage"
                  type="number"
                  step="0.01"
                  placeholder="15"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  className="col-span-3"
                  autoFocus
                />
                <span className="text-muted-foreground font-bold">%</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Actualizando..." : "Actualizar Precios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
