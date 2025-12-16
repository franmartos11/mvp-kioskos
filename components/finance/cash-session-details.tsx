"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"
import { ArrowUpCircle, ArrowDownCircle, Banknote, CreditCard } from "lucide-react"

interface CashSessionDetailsProps {
    session: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CashSessionDetails({ session, open, onOpenChange }: CashSessionDetailsProps) {
    const [movements, setMovements] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (session?.id && open) {
            fetchMovements()
        }
    }, [session, open])

    async function fetchMovements() {
        setLoading(true)
        const { data } = await supabase
            .from('cash_movements')
            .select('*')
            .eq('cash_session_id', session.id)
            .order('created_at', { ascending: false })
        
        setMovements(data || [])
        setLoading(false)
    }

    if (!session) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Detalle de Caja</DialogTitle>
                    <DialogDescription>
                        Turno del {format(new Date(session.opened_at), "dd/MM/yyyy", { locale: es })}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-6 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Estado</span>
                            <div className="flex items-center gap-2">
                                <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                                    {session.status === 'open' ? 'Abierto' : 'Cerrado'}
                                </Badge>
                                {session.closed_by && <span className="text-xs text-muted-foreground">por {session.closer?.full_name}</span>}
                            </div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50 space-y-1">
                            <span className="text-xs text-muted-foreground uppercase font-bold">Diferencia</span>
                            <div className={`text-xl font-bold ${
                                session.difference === 0 ? 'text-green-600' :
                                session.difference > 0 ? 'text-blue-600' : 'text-red-600'
                            }`}>
                                {session.difference ? `$${session.difference}` : '-'}
                            </div>
                        </div>
                    </div>

                    {/* Financial Breakdown */}
                    <div className="space-y-3 border rounded-lg p-4">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                            <Banknote className="h-4 w-4" /> Resumen de Efectivo
                        </h3>
                        <Separator />
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Efectivo Inicial</span>
                                <span className="font-medium">${session.initial_cash}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Ventas (Efectivo)</span>
                                <span className="text-green-600 font-medium">+${session.total_sales_cash || 0}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Gastos (Efectivo)</span>
                                <span className="text-red-600 font-medium">-${session.total_expenses_cash || 0}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Ingresos Manuales</span>
                                <span className="text-green-600 font-medium">
                                    +${movements.filter(m => m.type === 'deposit').reduce((acc, m) => acc + m.amount, 0)}
                                </span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Retiros Manuales</span>
                                <span className="text-red-600 font-medium">
                                    -${movements.filter(m => m.type === 'withdrawal').reduce((acc, m) => acc + m.amount, 0)}
                                </span>
                            </div>
                            <Separator />
                            <div className="flex justify-between font-bold pt-1">
                                <span>Esperado en Caja</span>
                                <span>${session.expected_cash || '-'}</span>
                            </div>
                             <div className="flex justify-between font-bold text-lg pt-1">
                                <span>Real en Caja</span>
                                <span>${session.final_cash || '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Movements List */}
                    <div>
                        <h3 className="font-semibold text-sm mb-3">Movimientos Manuales</h3>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Hora</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Motivo</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {movements.map((m) => (
                                    <TableRow key={m.id}>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {format(new Date(m.created_at), "HH:mm")}
                                        </TableCell>
                                        <TableCell>
                                            {m.type === 'deposit' ? (
                                                <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">Ingreso</Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">Retiro</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {m.reason}
                                            {m.description && <span className="block text-xs text-muted-foreground truncate max-w-[150px]">{m.description}</span>}
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${m.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                                            ${m.amount}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {movements.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm h-12">
                                            No hay movimientos manuales.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Notes */}
                    {session.notes && (
                        <div className="bg-yellow-50 p-4 rounded-md border border-yellow-100 text-sm text-yellow-800">
                            <span className="font-bold block mb-1">Notas de Cierre:</span>
                            {session.notes}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
