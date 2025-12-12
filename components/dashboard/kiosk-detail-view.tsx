"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { supabase } from "@/utils/supabase/client"
import { SalesTrendChart, RevenuePieChart, HourlyBarChart } from "./stats-charts"
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign, Percent, ShoppingBag, Clock, TrendingUp } from "lucide-react"
import { format, subDays, getHours } from "date-fns"
import { es } from "date-fns/locale"

interface KioskDetailViewProps {
    kioskId: string
    kioskName: string
}

export function KioskDetailView({ kioskId, kioskName }: KioskDetailViewProps) {
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        revenue: 0,
        profit: 0,
        ticketAvg: 0,
        margin: 0
    })
    const [hourlyData, setHourlyData] = useState<any[]>([])
    const [paymentData, setPaymentData] = useState<any[]>([])
    const [topProducts, setTopProducts] = useState<any[]>([])

    useEffect(() => {
        async function fetchKioskData() {
            setLoading(true)
            const endDate = new Date()
            const startDate = subDays(endDate, 30)

            
            // Optimization: Use RPC for single round-trip fetching of complex details
            console.time("Kiosk Detail RPC")
            const { data, error } = await supabase.rpc('get_kiosk_details', {
                p_kiosk_id: kioskId,
                p_start_date: startDate.toISOString(),
                p_end_date: endDate.toISOString()
            })
            console.timeEnd("Kiosk Detail RPC")

            if (error) {
                console.error("Error fetching kiosk details", error)
                setLoading(false)
                return
            }

            if (!data) {
                setLoading(false)
                return
            }

            setStats({
                revenue: data.revenue,
                profit: data.profit,
                ticketAvg: data.ticketAvg,
                margin: data.margin
            })
            setHourlyData(data.hourly || [])
            setPaymentData(data.payment || [])
            setTopProducts(data.topProducts || [])
            setLoading(false)
        }

        if (kioskId) {
            fetchKioskData()
        }
    }, [kioskId])

    const translatePayment = (method: string) => {
        const map: Record<string, string> = {
            'cash': 'Efectivo',
            'card': 'Tarjeta',
            'transfer': 'Transferencia',
            'other': 'Otro'
        }
        return map[method] || method
    }

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(val)
    }



    if (loading) {
         return (
            <div className="space-y-4">
                 <h2 className="text-2xl font-bold tracking-tight"><Skeleton className="h-8 w-[300px]" /></h2>
                 <div className="grid gap-4 md:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Skeleton className="h-4 w-[100px]" />
                                <Skeleton className="h-4 w-4" />
                             </CardHeader>
                             <CardContent>
                                <Skeleton className="h-8 w-[120px]" />
                             </CardContent>
                        </Card>
                    ))}
                 </div>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <Skeleton className="h-6 w-[150px]" />
                        </CardHeader>
                        <CardContent className="pl-2">
                             <Skeleton className="h-[350px] w-full" />
                        </CardContent>
                    </Card>
                    <Card className="col-span-3">
                         <CardHeader>
                            <Skeleton className="h-6 w-[150px]" />
                        </CardHeader>
                         <CardContent>
                             <Skeleton className="h-[300px] w-full" />
                        </CardContent>
                    </Card>
                 </div>
            </div>
        )
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-2xl font-bold tracking-tight">Detalles: {kioskName}</h2>
            
             <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Facturación</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.revenue)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ganancia Est.</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.profit)}</div>
                        <p className="text-xs text-muted-foreground">Margen: {stats.margin.toFixed(1)}%</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                        <Percent className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(stats.ticketAvg)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Prod. Vendidos</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                         {/* Aggregating all quantity */}
                        <div className="text-2xl font-bold">
                            {topProducts.reduce((acc, curr) => acc + curr.quantity, 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Ventas por Hora (Acumulado)</CardTitle>
                        <CardDescription>Horarios de mayor facturación</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <HourlyBarChart data={hourlyData} />
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Métodos de Pago</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RevenuePieChart data={paymentData} />
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Top 5 Productos</CardTitle>
                        <CardDescription>Más unidades vendidas</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-4">
                            {topProducts.map((prod, i) => (
                                <div key={i} className="flex items-center">
                                    <div className="w-8 font-bold text-muted-foreground">#{i+1}</div>
                                    <div className="flex-1 font-medium">{prod.name}</div>
                                    <div className="font-semibold">{prod.quantity} u</div>
                                </div>
                            ))}
                            {topProducts.length === 0 && <div className="text-muted-foreground">No data</div>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
