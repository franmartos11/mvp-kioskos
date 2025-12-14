"use client"

import { useKiosk } from "@/components/providers/kiosk-provider"

import Link from "next/link"
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Search, FileText, CalendarDays, Eye } from "lucide-react"
import { supabase } from "@/utils/supabase/client"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface SupplierOrder {
    id: string
    created_at: string
    date: string
    total_amount: number
    status: 'pending' | 'received' | 'completed' | 'cancelled'
    supplier: {
        name: string
    }
}

export function SupplierOrdersList() {
    const [orders, setOrders] = useState<SupplierOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const { currentKiosk } = useKiosk()
    const isOwner = currentKiosk?.role === 'owner'

    useEffect(() => {
        if (!currentKiosk) return

        const fetchOrders = async () => {
            setLoading(true)
            const { data, error } = await supabase
                .from('supplier_orders')
                .select(`
                    id,
                    created_at,
                    date,
                    total_amount,
                    status,
                    supplier:suppliers(name)
                `)
                .eq('kiosk_id', currentKiosk.id)
                .order('date', { ascending: false })
            
            if (data) {
                // Typings from Supabase joins can be tricky, casting
                setOrders(data as any[])
            }
            setLoading(false)
        }

        fetchOrders()
    }, [currentKiosk])

    const filteredOrders = orders.filter(o => 
        o.supplier.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="flex flex-col gap-4">
             <div className="flex max-w-sm relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar por proveedor..."
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
             </div>

             <div className="border rounded-md">
                 <Table>
                     <TableHeader>
                         <TableRow>
                             <TableHead>Fecha</TableHead>
                             <TableHead>Proveedor</TableHead>
                             <TableHead>Estado</TableHead>
                             {isOwner && <TableHead className="text-right">Total</TableHead>}
                             <TableHead className="text-right w-[100px]">Acciones</TableHead>
                         </TableRow>
                     </TableHeader>
                     <TableBody>
                         {loading ? (
                             <TableRow>
                                 <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                     Cargando historial...
                                 </TableCell>
                             </TableRow>
                         ) : filteredOrders.length === 0 ? (
                             <TableRow>
                                 <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                                     <div className="flex flex-col items-center justify-center gap-2">
                                         <FileText className="h-8 w-8 opacity-20" />
                                         No hay pedidos registrados
                                     </div>
                                 </TableCell>
                             </TableRow>
                         ) : (
                             filteredOrders.map(order => (
                                 <TableRow key={order.id}>
                                     <TableCell>
                                         <div className="flex items-center gap-2">
                                             <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                             {format(new Date(order.date), 'dd/MM/yyyy HH:mm')}
                                         </div>
                                     </TableCell>
                                     <TableCell className="font-medium">
                                         {order.supplier?.name || "Desconocido"}
                                     </TableCell>
                                     <TableCell>
                                         <Badge variant={order.status === 'completed' ? 'default' : order.status === 'received' ? 'secondary' : 'outline'}>
                                             {order.status === 'pending' ? 'Pendiente' : 
                                              order.status === 'received' ? 'Recibido' : 
                                              order.status === 'completed' ? 'Completado' : order.status}
                                         </Badge>
                                     </TableCell>
                                     {isOwner && (
                                         <TableCell className="text-right font-bold">
                                             ${order.total_amount.toFixed(2)}
                                         </TableCell>
                                     )}
                                     <TableCell className="text-right">
                                        <Link href={`/suppliers/orders/${order.id}`}>
                                            <Button size="icon" variant="ghost">
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                     </TableCell>
                                 </TableRow>
                             ))
                         )}
                     </TableBody>
                 </Table>
             </div>
        </div>
    )
}
