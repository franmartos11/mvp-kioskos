"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/utils/supabase/client"
import { SalesTrendChart, RevenuePieChart } from "./stats-charts"
import { EmployeeSalesStats } from "./employee-sales-stats"
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign, Store, CreditCard, TrendingUp, TrendingDown } from "lucide-react"
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns"
import { es } from "date-fns/locale"

import { DateRange } from "react-day-picker"

interface OverviewStatsProps {
    userId: string
    initialData?: any
    dateRange?: DateRange
}

export function OverviewStats({ userId, initialData, dateRange }: OverviewStatsProps) {
    const [stats, setStats] = useState({
        totalRevenue: initialData?.totalRevenue || 0,
        totalSales: initialData?.totalSales || 0,
        totalExpenses: initialData?.totalExpenses || 0,
        grossProfit: initialData?.grossProfit || 0,
        netIncome: initialData?.netIncome || 0,
        topKiosk: initialData?.topKiosk || "N/A"
    })
    
    // Process initial trend data if available
    const initialTrend = initialData?.trend ? (initialData.trend || []).map((t: any) => ({
        date: format(new Date(t.date), 'dd/MM'),
        amount: t.amount
    })) : []

    const [trendData, setTrendData] = useState<any[]>(initialTrend)
    const [pieData, setPieData] = useState<any[]>(initialData?.pie || [])
    const [loading, setLoading] = useState(!initialData)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            
            let startDate = subDays(new Date(), 30)
            let endDate = new Date()

            if (dateRange?.from) {
                startDate = dateRange.from
                endDate = dateRange.to || dateRange.from
            }

            // Call v2 stats which includes expenses
            const { data, error } = await supabase.rpc('get_dashboard_stats_v2', {
                p_user_id: userId,
                p_start_date: startDate.toISOString(),
                p_end_date: endDate.toISOString()
            })
                
            if (error || !data) {
                console.warn("RPC failed, falling back to client-side calculation", error)
                
                // Fallback: Fetch manually
                const [salesRes, expensesRes] = await Promise.all([
                    supabase.from('sales').select('total, created_at, kiosk_id, kiosks(name)')
                        .gte('created_at', startDate.toISOString())
                        .lte('created_at', endDate.toISOString())
                    ,
                    supabase.from('expenses').select('amount, date')
                        .gte('date', startDate.toISOString())
                        .lte('date', endDate.toISOString())
                ])

                if (salesRes.error || expensesRes.error) {
                     console.error("Fallback fetch failed", salesRes.error, expensesRes.error)
                     setLoading(false)
                     return
                }

                const sales = salesRes.data || []
                const expenses = expensesRes.data || []

                const totalSales = sales.length
                const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0)
                const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0)
                // Fallback assumes 0 cost if RPC fails, effectively Gross = Revenue
                const grossProfit = totalRevenue 
                const netIncome = totalRevenue - totalExpenses

                // ... (Kiosk calculation remains same) ...
                // Calculate Top Kiosk
                const kioskMap = new Map<string, number>()
                sales.forEach(s => {
                    // @ts-ignore
                    const name = s.kiosks?.name || 'Unknown'
                    kioskMap.set(name, (kioskMap.get(name) || 0) + s.total)
                })
                let topKiosk = "N/A"
                if (kioskMap.size > 0) {
                     // Find max
                     topKiosk = [...kioskMap.entries()].reduce((a, b) => b[1] > a[1] ? b : a)[0]
                }

                // ... (Trend/Pie calculations remain same) ...
                const trendMap = new Map<string, number>()
                sales.forEach(s => {
                    const d = format(new Date(s.created_at), 'dd/MM')
                    trendMap.set(d, (trendMap.get(d) || 0) + s.total)
                })
                const trend = Array.from(trendMap.entries()).map(([date, amount]) => ({ date, amount }))
                    .sort((a,b) => a.date.localeCompare(b.date))

                const pie = Array.from(kioskMap.entries()).map(([name, value]) => ({ name, value }))

                setStats({
                    totalRevenue,
                    totalSales,
                    totalExpenses,
                    grossProfit,
                    netIncome,
                    topKiosk
                })
                setTrendData(trend)
                setPieData(pie)
                setLoading(false)
                return
            }

            // Transform date format for charts
            // @ts-ignore
            const trend = (data.trend || []).map((t: any) => ({
                date: format(new Date(t.date), 'dd/MM'),
                amount: t.amount
            }))

            setStats({
                totalRevenue: data.totalRevenue,
                totalSales: data.totalSales,
                totalExpenses: data.totalExpenses,
                grossProfit: data.grossProfit,
                netIncome: data.netIncome,
                topKiosk: data.topKiosk
            })
            setTrendData(trend)
            setPieData(data.pie || [])
            setLoading(false)
        }

        fetchData()
    }, [userId, dateRange])

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(val)
    }

    // Helper to titling
    const periodLabel = dateRange?.from ? 
        `${format(dateRange.from, 'd MMM', { locale: es })} - ${format(dateRange.to || dateRange.from, 'd MMM', { locale: es })}` 
        : "Últimos 30 días"

    if (loading) {
        return (
            <div className="space-y-4">
                 <h2 className="text-2xl font-bold tracking-tight"><Skeleton className="h-8 w-[300px]" /></h2>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}>
                             <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <Skeleton className="h-4 w-[100px]" />
                                <Skeleton className="h-4 w-4" />
                             </CardHeader>
                             <CardContent>
                                <Skeleton className="h-8 w-[120px] mb-1" />
                                <Skeleton className="h-3 w-[80px]" />
                             </CardContent>
                        </Card>
                    ))}
                 </div>
                 {/* ... charts skeletons ... */}
            </div>
        )
    }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold tracking-tight">Panorama General ({periodLabel})</h2>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Facturación Total</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">Ventas Brutas</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ganancia Bruta</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.grossProfit)}</div>
                        <p className="text-xs text-muted-foreground">Facturación - Costo Mercadería</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gastos Operativos</CardTitle>
                        <TrendingDown className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-destructive">{formatCurrency(stats.totalExpenses)}</div>
                        <p className="text-xs text-muted-foreground">Alquiler, Servicios, etc.</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resultado Neto</CardTitle>
                        <Store className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stats.netIncome >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                            {formatCurrency(stats.netIncome)}
                        </div>
                        <p className="text-xs text-muted-foreground">Bolsillo Real (Bruta - Op.)</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Tendencia de Ventas</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <SalesTrendChart data={trendData} />
                    </CardContent>
                </Card>
                <div className="col-span-3 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Distribución por Kiosco</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RevenuePieChart data={pieData} />
                        </CardContent>
                    </Card>
                    <EmployeeSalesStats />
                </div>
            </div>
        </div>
    )
}
