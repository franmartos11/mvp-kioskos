"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { History, ArrowUpCircle, ArrowDownCircle, AlertTriangle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/utils/supabase/client"

interface StockHistoryDialogProps {
  product: {
    id: string
    name: string
  }
}

export function StockHistoryDialog({ product }: StockHistoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [movements, setMovements] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (open) {
      fetchHistory()
    }
  }, [open, product.id])

  async function fetchHistory() {
    setLoading(true)
    const { data } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (data) setMovements(data)
    setLoading(false)
  }

  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'restock': return <ArrowUpCircle className="w-4 h-4 text-green-500" />
          case 'loss': return <ArrowDownCircle className="w-4 h-4 text-red-500" />
          case 'sale': return <ArrowDownCircle className="w-4 h-4 text-blue-500" />
          case 'return': return <ArrowUpCircle className="w-4 h-4 text-blue-500" />
          default: return <AlertTriangle className="w-4 h-4 text-orange-500" />
      }
  }

  const getTypeName = (type: string) => {
    const map: Record<string, string> = {
        restock: 'Reposición',
        loss: 'Pérdida/Robo',
        sale: 'Venta',
        return: 'Devolución',
        correction: 'Corrección'
    }
    return map[type] || type
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Ver Historial">
            <History className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial de Stock: {product.name}</DialogTitle>
          <DialogDescription>
            Últimos movimientos registrados.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead>Notas</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center h-24">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                            </TableCell>
                        </TableRow>
                    ) : movements.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                No hay movimientos registrados
                            </TableCell>
                        </TableRow>
                    ) : (
                        movements.map((move) => (
                            <TableRow key={move.id}>
                                <TableCell className="text-xs text-muted-foreground">
                                    {format(new Date(move.created_at), "dd/MM HH:mm", { locale: es })}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {getTypeIcon(move.type)}
                                        <span className="text-sm">{getTypeName(move.type)}</span>
                                    </div>
                                </TableCell>
                                <TableCell className={`text-right font-medium ${move.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {move.quantity > 0 ? '+' : ''}{move.quantity}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                                    {move.notes || move.reason || "-"}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
