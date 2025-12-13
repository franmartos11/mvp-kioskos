"use client"

import { useState } from "react"
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
import { toast } from "sonner"

interface BulkPriceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedCount: number
  onConfirm: (percentage: number) => Promise<void>
}

export function BulkPriceDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: BulkPriceDialogProps) {
  const [percentage, setPercentage] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const value = parseFloat(percentage)
    if (isNaN(value) || value <= 0) {
      toast.error("Por favor ingrese un porcentaje válido")
      return
    }

    try {
      setLoading(true)
      await onConfirm(value)
      setPercentage("")
      onOpenChange(false)
    } catch (error) {
           console.log(error)
      toast.error("Hubo un error al actualizar los precios")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Actualización Masiva de Precios</DialogTitle>
          <DialogDescription>
            Aumentará el precio de {selectedCount} productos seleccionados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
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
