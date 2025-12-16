"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Wallet, CreditCard, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { startOfDay, startOfMonth, endOfDay, subDays, endOfMonth, format, addMonths, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function BalanceView() {
    const { currentKiosk } = useKiosk()
    const [period, setPeriod] = useState("today")
    const [customDate, setCustomDate] = useState<Date | undefined>(new Date())
    const [customMonth, setCustomMonth] = useState<Date | undefined>(new Date())
    const [loading, setLoading] = useState(false)
    const [stats, setStats] = useState({
        salesCash: 0,
        salesDigital: 0,
        expensesCash: 0,
        expensesDigital: 0,
        cogs: 0
    })

    useEffect(() => {
        if (currentKiosk) {
            fetchBalance()
        }
    }, [currentKiosk, period, customDate, customMonth])

    async function fetchBalance() {
        if (!currentKiosk) return
        setLoading(true)

        const now = new Date()
        let startDate = startOfDay(now).toISOString()
        let endDate = endOfDay(now).toISOString()
        
        if (period === "yesterday") {
            startDate = startOfDay(subDays(now, 1)).toISOString()
            endDate = endOfDay(subDays(now, 1)).toISOString()
        } else if (period === "month") {
            startDate = startOfMonth(now).toISOString()
            endDate = endOfDay(now).toISOString()
        } else if (period === "custom-date" && customDate) {
            startDate = startOfDay(customDate).toISOString()
            endDate = endOfDay(customDate).toISOString()
        } else if (period === "custom-month" && customMonth) {
            startDate = startOfMonth(customMonth).toISOString()
            endDate = endOfMonth(customMonth).toISOString()
        }

        const { data: salesData } = await supabase
            .from('sales')
            .select('total, payment_method')
            .eq('kiosk_id', currentKiosk.id)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            
        const { data: expensesData } = await supabase
            .from('expenses')
            .select('amount, payment_method')
            .eq('kiosk_id', currentKiosk.id)
            .gte('created_at', startDate)
            .lte('created_at', endDate)

        // Fetch Cost of Goods Sold (COGS)
        const { data: cogsData } = await supabase
            .from('sale_items')
            .select('cost, quantity, sales!inner(created_at, kiosk_id)')
            .eq('sales.kiosk_id', currentKiosk.id) // Filter on the joined table
            .gte('sales.created_at', startDate)
            .lte('sales.created_at', endDate)

        // Aggregations
        let sCash = 0, sDigital = 0
        salesData?.forEach((s: any) => {
            if (s.payment_method === 'cash') sCash += s.total
            else sDigital += s.total
        })

        let eCash = 0, eDigital = 0
        expensesData?.forEach((e: any) => {
            if (e.payment_method === 'cash') eCash += e.amount
            else eDigital += e.amount
        })

        let totalCOGS = 0
        cogsData?.forEach((item: any) => {
            totalCOGS += (item.cost || 0) * (item.quantity || 1)
        })

        setStats({
            salesCash: sCash,
            salesDigital: sDigital,
            expensesCash: eCash,
            expensesDigital: eDigital,
            cogs: totalCOGS
        })
        setLoading(false)
    }

    const netCash = stats.salesCash - stats.expensesCash
    const netDigital = stats.salesDigital - stats.expensesDigital
    
    // Financial Metrics
    const totalSales = stats.salesCash + stats.salesDigital
    const totalExpenses = stats.expensesCash + stats.expensesDigital
    const grossProfit = totalSales - stats.cogs // Ganancia Bruta (Ventas - Costo Producto)
    const netResult = grossProfit - totalExpenses // Resultado Final (Ventas - Costo - Gastos)

    if (loading) {
        return (
            <div className="space-y-6">
                 <div className="flex justify-between items-center">
                    <div className="h-8 w-48 bg-muted animate-pulse rounded" />
                    <div className="h-10 w-[180px] bg-muted animate-pulse rounded" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                     {[...Array(4)].map((_, i) => (
                        <div key={i} className="rounded-xl border bg-card text-card-foreground shadow p-6 space-y-2">
                             <div className="flex justify-between">
                                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                <div className="h-4 w-4 bg-muted animate-pulse rounded-full" />
                             </div>
                             <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                        </div>
                     ))}
                </div>
                 <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border bg-card text-card-foreground shadow p-6 h-32 space-y-4">
                         <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                         <div className="h-10 w-48 bg-muted animate-pulse rounded" />
                    </div>
                     <div className="rounded-xl border bg-card text-card-foreground shadow p-6 h-32 space-y-4">
                         <div className="h-6 w-48 bg-muted animate-pulse rounded" />
                         <div className="space-y-2">
                             <div className="h-8 w-full bg-muted animate-pulse rounded" />
                             <div className="h-8 w-full bg-muted animate-pulse rounded" />
                         </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h2 className="text-xl font-bold">Balance Financiero</h2>
                <div className="flex items-center gap-2">
                    {/* Month Picker Control */}
                    {period === 'custom-month' && customMonth && (
                       <div className="flex items-center bg-card border rounded-md shadow-sm">
                           <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCustomMonth(subMonths(customMonth, 1))}>
                               <ChevronLeft className="h-4 w-4" />
                           </Button>
                           <div className="w-32 text-center font-medium capitalize text-sm">
                               {format(customMonth, "MMMM yyyy", { locale: es })}
                           </div>
                           <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCustomMonth(addMonths(customMonth, 1))}>
                               <ChevronRight className="h-4 w-4" />
                           </Button>
                       </div>
                    )}

                    {/* Date Picker Control */}
                    {period === 'custom-date' && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-[260px] justify-start text-left font-normal",
                                        !customDate && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {customDate ? format(customDate, "PPP", { locale: es }) : <span>Elegir fecha</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    mode="single"
                                    selected={customDate}
                                    onSelect={(date: Date | undefined) => date && setCustomDate(date)} // date might be undefined if deselected
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    )}

                    <div className="w-[180px]">
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Hoy</SelectItem>
                                <SelectItem value="yesterday">Ayer</SelectItem>
                                <SelectItem value="month">Este Mes</SelectItem>
                                <SelectItem value="custom-date">Elegir Fecha...</SelectItem>
                                <SelectItem value="custom-month">Elegir Mes...</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {/* 1. SALES */}
                 <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Totales</CardTitle>
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">${totalSales.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.salesCash > 0 && `Efec: $${stats.salesCash.toLocaleString()} `}
                            {stats.salesDigital > 0 && `Dig: $${stats.salesDigital.toLocaleString()}`}
                        </p>
                    </CardContent>
                 </Card>

                 {/* 2. COGS */}
                 <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Costo Mercadería</CardTitle>
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                             <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">-${stats.cogs.toLocaleString()}</div>
                         <p className="text-xs text-muted-foreground mt-1">
                            Costo de reposición estimado
                        </p>
                    </CardContent>
                 </Card>

                 {/* 3. GROSS PROFIT */}
                 <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ganancia Bruta</CardTitle>
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                            <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">${grossProfit.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Ventas - Costo Producto ({totalSales > 0 ? Math.round((grossProfit/totalSales)*100) : 0}%)
                        </p>
                    </CardContent>
                 </Card>

                 {/* 4. EXPENSES */}
                 <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Operativos</CardTitle>
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                            <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">-${totalExpenses.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Alquiler, Servicios, etc.
                        </p>
                    </CardContent>
                 </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                 {/* NET RESULT */}
                 <Card className={netResult >= 0 
                     ? "border-l-4 border-l-green-600 bg-green-50/50 dark:bg-green-900/10 shadow-sm" 
                     : "border-l-4 border-l-red-600 bg-red-50/50 dark:bg-red-900/10 shadow-sm"
                 }>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-lg font-bold">Resultado Neto Real</CardTitle>
                        <div className={`p-2 rounded-full ${netResult >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                             {netResult >= 0 
                                ? <TrendingUp className={`h-5 w-5 ${netResult >= 0 ? "text-green-600" : "text-red-600"}`} />
                                : <TrendingDown className="h-5 w-5 text-red-600" />
                             }
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-4xl font-bold ${netResult >= 0 ? "text-green-700 dark:text-green-500" : "text-red-700 dark:text-red-500"}`}>
                            ${netResult.toLocaleString()}
                        </div>
                        <p className="text-sm mt-2 text-muted-foreground">
                            Ganancia Final (Ganancia Bruta - Gastos)
                        </p>
                    </CardContent>
                </Card>

                {/* CASH FLOW SUMMARY */}
                 <Card className="shadow-sm border-l-4 border-l-slate-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-lg font-bold">Disponibilidad (Caja/Bancos)</CardTitle>
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                            <CreditCard className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        </div>
                    </CardHeader>
                     <CardContent className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-background border rounded-lg shadow-sm">
                            <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">En Caja (Físico)</span>
                            </div>
                            <span className="font-bold font-mono text-lg">${netCash.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-background border rounded-lg shadow-sm">
                            <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">En Bancos (Digital)</span>
                            </div>
                            <span className="font-bold font-mono text-lg">${netDigital.toLocaleString()}</span>
                        </div>
                    </CardContent>
                 </Card>
            </div>
        </div>
    )
}
