"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, Receipt } from "lucide-react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Payment = {
    id: string
    created_at: string
    amount: number
    status: string
    provider_payment_id: string
}

export function PaymentHistory() {
    const [payments, setPayments] = useState<Payment[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadPayments() {
            try {
                const { data, error } = await supabase
                    .from('payments')
                    .select('*')
                    .order('created_at', { ascending: false })

                if (!error && data) {
                    setPayments(data)
                }
            } catch (error) {
                console.error("Error loading payments", error)
            } finally {
                setLoading(false)
            }
        }
        loadPayments()
    }, [])

    if (loading) {
        return <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground" /></div>
    }

    if (payments.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Historial de Pagos</CardTitle>
                    <CardDescription>Aquí verás tus facturas una vez que realices pagos.</CardDescription>
                </CardHeader>
                <CardContent className="text-center py-8 text-muted-foreground">
                    <Receipt className="mx-auto h-12 w-12 mb-2 opacity-20" />
                    <p>No hay pagos registrados aún.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
             <CardHeader>
                <CardTitle>Historial de Pagos</CardTitle>
                <CardDescription>Detalle de tus transacciones recientes.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>ID Pago</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead className="text-right">Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell>
                                    {format(new Date(payment.created_at), "dd 'de' MMMM, yyyy", { locale: es })}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{payment.provider_payment_id || payment.id.slice(0,8)}</TableCell>
                                <TableCell>
                                    {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(payment.amount)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Badge variant={payment.status === 'approved' ? 'default' : 'secondary'}>
                                        {payment.status === 'approved' ? 'Pagado' : payment.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
