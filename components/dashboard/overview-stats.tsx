import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SalesTrendChart, RevenuePieChart } from "./stats-charts"
import { EmployeeSalesStats } from "./employee-sales-stats"
import { DollarSign, Store, TrendingUp, TrendingDown } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DateRange } from "react-day-picker"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { useSubscription } from "@/hooks/use-subscription"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { Button } from "@/components/ui/button"
import { Lock } from "lucide-react"
import Link from "next/link"

interface OverviewStatsProps {
    userId: string
    initialData?: any
    dateRange?: DateRange
}

export function OverviewStats({ userId, initialData, dateRange }: OverviewStatsProps) {
    const { isPro } = useSubscription()
    const { data: stats, isLoading: loading } = useDashboardStats(
        { userId, from: dateRange?.from, to: dateRange?.to },
        initialData
    )

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(val)
    }

    const periodLabel = dateRange?.from 
        ? `${format(dateRange.from, "LLL dd", { locale: es })} - ${dateRange.to ? format(dateRange.to, "LLL dd, y", { locale: es }) : ""}`
        : "Últimos 30 días"

    // Helper to titling
    const { currentKiosk } = useKiosk()
    const permissions = currentKiosk?.permissions

    // Sanitize stats to prevent NaN from raw initialData
    const safeStats = {
        totalRevenue: Number(stats?.totalRevenue) || 0,
        grossProfit: Number(stats?.grossProfit) || 0,
        totalExpenses: Number(stats?.totalExpenses) || 0,
        netIncome: Number(stats?.netIncome) || 0,
        ticketAvg: Number(stats?.ticketAvg) || 0,
        margin: Number(stats?.margin) || 0,
        stockAlerts: Number(stats?.stockAlerts) || 0,
        trend: stats?.trend || [],
        pie: stats?.pie || [],
        topProducts: stats?.topProducts || []
    }

    if (loading || !stats) {
        // ... (existing loader logic is fine, maybe update if needed but keeping it simple for now)
        return (
            <div className="space-y-4">
               { /* Keep existing skeleton or update slightly */ }
                <div className="h-8 w-64 bg-muted animate-pulse rounded" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i} className="border-l-4 border-l-muted shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                                <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                            </CardHeader>
                            <CardContent>
                                <div className="h-8 w-32 bg-muted animate-pulse rounded mb-1" />
                                <div className="h-3 w-40 bg-muted animate-pulse rounded" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                {/* ... rest of skeleton */}
            </div>
        )
    }

    // ... (Permissions check remains same) ...
     if (!permissions?.view_finance) {
         return (
             <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 {/* ... (keep restricted view) */}
                 <h2 className="text-2xl font-bold tracking-tight">Panorama General</h2>
                 <div className="rounded-lg border border-dashed p-8 text-center animate-in zoom-in-50 duration-300">
                      {/* ... */}
                     <h3 className="mt-4 text-lg font-semibold">Información Financiera Restringida</h3>
                     <p className="mb-4 text-sm text-muted-foreground">No tienes permisos.</p>
                 </div>
             </div>
         )
     }

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Panorama General ({periodLabel})</h2>
                {safeStats.stockAlerts > 0 && (
                    <div className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium border border-red-200 animate-pulse">
                        <TrendingDown className="h-4 w-4" /> {/* Or AlertIcon if available, reusing TrendingDown as 'crisis' icon for now or Import AlertCircle */}
                        {safeStats.stockAlerts} prod. stock bajo
                    </div>
                )}
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Facturación Total</CardTitle>
                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{formatCurrency(safeStats.totalRevenue)}</div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1 gap-2">
                            <span>Ventas Brutas</span>
                            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                Ticket Prom: {formatCurrency(safeStats.ticketAvg)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ganancia Bruta</CardTitle>
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{formatCurrency(safeStats.grossProfit)}</div>
                        <div className="flex items-center text-xs text-muted-foreground mt-1 gap-2">
                            <span>Fact. - Costos</span>
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                Margen: {safeStats.margin.toFixed(1)}%
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Operativos</CardTitle>
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                            <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-foreground">{formatCurrency(-Math.abs(safeStats.totalExpenses))}</div>
                        <p className="text-xs text-muted-foreground mt-1">Alquiler, Servicios, etc.</p>
                    </CardContent>
                </Card>

                <Card className={safeStats.netIncome >= 0 
                     ? "border-l-4 border-l-green-600 bg-green-50/20 dark:bg-green-900/10 shadow-sm hover:shadow-md transition-shadow" 
                     : "border-l-4 border-l-red-600 bg-red-50/20 dark:bg-red-900/10 shadow-sm hover:shadow-md transition-shadow"
                 }>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-foreground">Resultado Neto</CardTitle>
                        <div className={`p-2 rounded-full ${safeStats.netIncome >= 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                             <Store className={`h-4 w-4 ${safeStats.netIncome >= 0 ? "text-green-600" : "text-red-600"}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${safeStats.netIncome >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                            {formatCurrency(safeStats.netIncome)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Bolsillo Real (Bruta - Op.)</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 relative">
                {/* Overlay for Free Users */}
                {!isPro && (
                    <div className="absolute inset-0 z-10 bg-background/50 backdrop-blur-sm flex items-center justify-center rounded-xl border border-dashed">
                        {/* ... (keep existing overlay) */}
                        <div className="text-center p-6 bg-background border rounded-xl shadow-lg max-w-sm mx-auto">
                            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Lock className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="font-bold text-lg mb-2">Reportes Avanzados</h3>
                            <p className="text-muted-foreground mb-4">
                                Desbloquea tendencias de ventas, análisis por empleado y comparativas con el plan PRO.
                            </p>
                            <Link href="/settings">
                                <Button className="w-full">
                                    Ver Planes
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}

                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Tendencia de Ventas</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <SalesTrendChart data={safeStats.trend} />
                    </CardContent>
                </Card>
                <div className="col-span-3 space-y-4">
                    <Card>
                        <CardHeader>
                             <CardTitle className="text-sm font-medium">Top Productos (Global)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {safeStats.topProducts.map((prod: any, i: number) => (
                                    <div key={i} className="flex items-center">
                                        <div className="w-8 font-bold text-muted-foreground">#{i+1}</div>
                                        <div className="flex-1 font-medium text-sm truncate">{prod.name}</div>
                                        <div className="font-semibold text-sm">{prod.quantity} u</div>
                                    </div>
                                ))}
                                {safeStats.topProducts.length === 0 && <div className="text-muted-foreground text-sm">Sin datos aún</div>}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Distribución por Kiosco</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RevenuePieChart data={safeStats.pie} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
