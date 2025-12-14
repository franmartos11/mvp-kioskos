import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SalesTrendChart, RevenuePieChart } from "./stats-charts"
import { EmployeeSalesStats } from "./employee-sales-stats"
import { Skeleton } from "@/components/ui/skeleton"
import { DollarSign, Store, TrendingUp, TrendingDown } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DateRange } from "react-day-picker"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"

interface OverviewStatsProps {
    userId: string
    initialData?: any
    dateRange?: DateRange
}

export function OverviewStats({ userId, initialData, dateRange }: OverviewStatsProps) {
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

    // Helper to titling
    const periodLabel = dateRange?.from ? 
        `${format(dateRange.from, 'd MMM', { locale: es })} - ${format(dateRange.to || dateRange.from, 'd MMM', { locale: es })}` 
        : "Últimos 30 días"

    if (loading || !stats) {
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
                        <SalesTrendChart data={stats.trend} />
                    </CardContent>
                </Card>
                <div className="col-span-3 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Distribución por Kiosco</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <RevenuePieChart data={stats.pie} />
                        </CardContent>
                    </Card>
                    <EmployeeSalesStats />
                </div>
            </div>
        </div>
    )
}
