"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { getPriceHistory, revertPriceChange } from "@/app/actions/bulk-actions"
import { format } from "date-fns"
import { RotateCcw, History } from "lucide-react"

interface PriceHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PriceHistoryDialog({ open, onOpenChange }: PriceHistoryDialogProps) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [revertingId, setRevertingId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      loadHistory()
    }
  }, [open])

  async function loadHistory() {
      setLoading(true)
      const data = await getPriceHistory()
      setHistory(data)
      setLoading(false)
  }

  async function handleRevert(id: string) {
      if (!confirm("¿Estás seguro de querer revertir este cambio? Los precios volverán al estado anterior.")) return;
      
      setRevertingId(id)
      const res = await revertPriceChange(id)
      setRevertingId(null)

      if (res.error) {
          toast.error(res.error)
      } else {
          toast.success("Cambios revertidos correctamente")
          loadHistory() // Reload to see the revert action
      }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Historial de Cambios
          </DialogTitle>
          <DialogDescription>
            Registro de los últimos aumentos de precios y reversiones.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
            {loading ? (
                <div className="text-center py-8 text-muted-foreground">Cargando historial...</div>
            ) : history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No hay cambios registrados.</div>
            ) : (
                <div className="space-y-4">
                    {history.map((item) => (
                        <div key={item.id} className="border rounded-lg p-4 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-medium">{item.description}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {format(new Date(item.created_at), "dd/MM/yyyy HH:mm")} • por <span className="font-medium text-foreground">{item.user_name}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {item.affected_products?.length || 0} productos afectados
                                    </p>
                                </div>
                                {item.action_type !== 'REVERT' && (
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => handleRevert(item.id)}
                                        disabled={revertingId === item.id}
                                    >
                                        <RotateCcw className="h-3 w-3 mr-2" />
                                        {revertingId === item.id ? "Revirtiendo..." : "Revertir"}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
