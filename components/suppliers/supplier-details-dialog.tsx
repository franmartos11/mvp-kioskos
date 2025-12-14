"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { supabase } from "@/utils/supabase/client"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, Phone, Mail, MapPin, Package, DollarSign, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Supplier {
    id: string
    name: string
    contact_name: string | null
    phone: string | null
    email: string | null
    address: string | null
    created_at: string
}

interface SupplierDetailsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    supplier: Supplier | null
}

interface SupplierStats {
    totalOrders: number
    totalSpent: number
    lastOrderDate: string | null
}

interface RecentOrder {
    id: string
    created_at: string
    total_amount: number
    status: string
    payment_status: string
}

export function SupplierDetailsDialog({ open, onOpenChange, supplier }: SupplierDetailsDialogProps) {
    const [stats, setStats] = useState<SupplierStats>({ totalOrders: 0, totalSpent: 0, lastOrderDate: null })
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open && supplier) {
            fetchDetails()
        }
    }, [open, supplier])

    const fetchDetails = async () => {
        if (!supplier) return
        setLoading(true)
        try {
            // Fetch orders for this supplier
            const { data: orders, error } = await supabase
                .from('supplier_orders')
                .select('*')
                .eq('supplier_id', supplier.id)
                .order('created_at', { ascending: false })

            if (error) throw error

            const totalOrders = orders?.length || 0
            const totalSpent = orders?.reduce((acc, order) => acc + (Number(order.total_amount) || 0), 0) || 0
            const lastOrderDate = orders && orders.length > 0 ? orders[0].created_at : null

            setStats({
                totalOrders,
                totalSpent,
                lastOrderDate
            })

            setRecentOrders(orders?.slice(0, 5) || [])

        } catch (error) {
            console.error("Error fetching supplier details:", error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
        }).format(amount)
    }

    const translateStatus = (status: string) => {
        const map: Record<string, string> = {
            'pending': 'Pendiente',
            'received': 'Recibido',
            'completed': 'Completado',
            'cancelled': 'Cancelado'
        }
        return map[status] || status
    }

    if (!supplier) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-zinc-50/50 dark:bg-zinc-950/50 backdrop-blur-xl border-zinc-200 dark:border-zinc-800">
                <DialogHeader className="p-6 pb-2 bg-white dark:bg-zinc-950 border-b relative">
                    <div className="flex flex-col gap-1">
                        <DialogTitle className="text-3xl font-bold tracking-tight">{supplier.name}</DialogTitle>
                        <DialogDescription className="text-base">
                            Perfil del proveedor y actividad reciente.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <div className="p-6 space-y-8">
                    {/* Contact Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm space-y-3">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Package className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Información de Contacto</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                        <span className="font-bold text-sm">{supplier.contact_name?.[0]?.toUpperCase() || "C"}</span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-foreground">{supplier.contact_name || "Sin Nombre de Contacto"}</p>
                                        <p className="text-sm text-muted-foreground">{supplier.address || "Sin dirección registrada"}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm space-y-3">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <Phone className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-wider">Canales de Comunicación</span>
                            </div>
                            <div className="space-y-2">
                                {supplier.phone ? (
                                    <a href={`tel:${supplier.phone}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors group">
                                        <div className="h-8 w-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                                            <Phone className="h-4 w-4" />
                                        </div>
                                        <span className="font-medium text-foreground">{supplier.phone}</span>
                                    </a>
                                ) : (
                                    <div className="flex items-center gap-3 p-2 opacity-50">
                                        <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center"><Phone className="h-4 w-4" /></div>
                                        <span>Sin teléfono</span>
                                    </div>
                                )}
                                
                                {supplier.email ? (
                                    <a href={`mailto:${supplier.email}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors group">
                                        <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                                            <Mail className="h-4 w-4" />
                                        </div>
                                        <span className="font-medium text-foreground">{supplier.email}</span>
                                    </a>
                                ) : (
                                    <div className="flex items-center gap-3 p-2 opacity-50">
                                        <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center"><Mail className="h-4 w-4" /></div>
                                        <span>Sin email</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {loading ? (
                         <div className="flex justify-center p-12">
                             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                         </div>
                    ) : (
                        <>
                            {/* Stats Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-5 rounded-2xl border bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-zinc-900 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-muted-foreground">Gastado Total</p>
                                        <DollarSign className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <p className="text-2xl font-bold tracking-tight text-foreground">{formatCurrency(stats.totalSpent)}</p>
                                </div>
                                <div className="p-5 rounded-2xl border bg-white dark:bg-zinc-900 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-muted-foreground">Total Pedidos</p>
                                        <Package className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <p className="text-2xl font-bold tracking-tight text-foreground">{stats.totalOrders}</p>
                                </div>
                                <div className="p-5 rounded-2xl border bg-white dark:bg-zinc-900 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-medium text-muted-foreground">Última Compra</p>
                                        <Calendar className="h-4 w-4 text-purple-600" />
                                    </div>
                                    <p className="text-xl font-bold tracking-tight text-foreground capitalize">
                                        {stats.lastOrderDate 
                                            ? format(new Date(stats.lastOrderDate), "d MMM yyyy", { locale: es }) 
                                            : "N/A"}
                                    </p>
                                </div>
                            </div>

                            {/* Recent Orders Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-muted-foreground" />
                                        Historial Reciente
                                    </h3>
                                </div>

                                {recentOrders.length === 0 ? (
                                    <div className="text-center py-12 rounded-xl border border-dashed bg-muted/20">
                                        <p className="text-muted-foreground">No hay pedidos registrados para este proveedor.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Desktop Table */}
                                        <div className="hidden md:block border rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                                                    <tr>
                                                        <th className="p-4 font-medium">Fecha</th>
                                                        <th className="p-4 font-medium">Total</th>
                                                        <th className="p-4 font-medium">Estado</th>
                                                        <th className="p-4 font-medium">Pago</th>
                                                        <th className="p-4 font-medium text-right">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {recentOrders.map((order) => (
                                                        <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                                                            <td className="p-4 text-muted-foreground">
                                                                {format(new Date(order.created_at), "dd/MM/yyyy HH:mm")}
                                                            </td>
                                                            <td className="p-4 font-bold text-foreground">
                                                                {formatCurrency(Number(order.total_amount))}
                                                            </td>
                                                            <td className="p-4">
                                                                <Badge variant="outline" className="capitalize font-medium">
                                                                    {translateStatus(order.status)}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-4">
                                                                 <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'} className="capitalize">
                                                                    {order.payment_status === 'paid' ? 'Pagado' : order.payment_status === 'partial' ? 'Parcial' : 'Impago'}
                                                                </Badge>
                                                            </td>
                                                            <td className="p-4 text-right">
                                                                <a 
                                                                    href={`/suppliers/orders/${order.id}`}
                                                                    className="inline-flex items-center justify-center rounded-lg text-xs font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-4"
                                                                >
                                                                    Ver Orden
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile List (Cards) */}
                                        <div className="md:hidden space-y-3">
                                            {recentOrders.map((order) => (
                                                <div key={order.id} className="p-4 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm text-muted-foreground font-medium">
                                                            {format(new Date(order.created_at), "dd MMM yyyy", { locale: es })}
                                                        </span>
                                                        <Badge variant={order.status === 'completed' ? 'default' : 'outline'} className="capitalize">
                                                            {translateStatus(order.status)}
                                                        </Badge>
                                                    </div>
                                                    
                                                    <div className="flex items-baseline justify-between">
                                                        <span className="text-2xl font-bold">{formatCurrency(Number(order.total_amount))}</span>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-2 border-t mt-2">
                                                         <Badge variant="secondary" className="capitalize text-xs">
                                                            {order.payment_status === 'paid' ? 'Pagado' : 'Impago'}
                                                        </Badge>
                                                        <a 
                                                            href={`/suppliers/orders/${order.id}`}
                                                            className="text-sm font-semibold text-primary hover:underline"
                                                        >
                                                            Ver Detalles &rarr;
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
