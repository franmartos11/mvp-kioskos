"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns"
import { es } from "date-fns/locale"
import {
  ChevronLeft, ChevronRight, Printer, Loader2,
  TrendingUp, TrendingDown, DollarSign, CreditCard, ShoppingBag
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// ─── Types ─────────────────────────────────────────────────────────────────────
interface MonthlySale {
  total: number
  payment_method: string
  created_at: string
}

interface TopProduct {
  name: string
  quantity: number
  revenue: number
}

interface DailyStat {
  day: string
  total: number
  count: number
}

interface ReportData {
  totalRevenue: number
  totalTransactions: number
  ticketAvg: number
  byCash: number
  byCard: number
  byTransfer: number
  byFiado: number
  byOther: number
  topProducts: TopProduct[]
  dailyStats: DailyStat[]
}

// ─── Print Styles ──────────────────────────────────────────────────────────────
const PRINT_STYLES = `
@media print {
  body * { visibility: hidden; }
  #monthly-report, #monthly-report * { visibility: visible; }
  #monthly-report { position: absolute; top: 0; left: 0; width: 100%; padding: 20px; }
  .no-print { display: none !important; }
  .print-break { page-break-after: always; }
  body { background: white !important; }
}
`

// ─── Component ─────────────────────────────────────────────────────────────────
export function MonthlyReportClient() {
  const { currentKiosk } = useKiosk()
  const [monthDate, setMonthDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReportData | null>(null)
  const styleRef = useRef<HTMLStyleElement | null>(null)

  // Inject print styles
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = PRINT_STYLES
    document.head.appendChild(style)
    styleRef.current = style
    return () => { style.remove() }
  }, [])

  const fetchReport = useCallback(async () => {
    if (!currentKiosk) return
    setLoading(true)
    const from = startOfMonth(monthDate)
    const to   = endOfMonth(monthDate)

    const [salesRes, itemsRes] = await Promise.all([
      supabase
        .from('sales')
        .select('total, payment_method, created_at')
        .eq('kiosk_id', currentKiosk.id)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString()),
      supabase
        .from('sale_items')
        .select('quantity, unit_price, subtotal, products(name), sales!inner(created_at, kiosk_id)')
        .eq('sales.kiosk_id', currentKiosk.id)
        .gte('sales.created_at', from.toISOString())
        .lte('sales.created_at', to.toISOString())
    ])

    const sales: MonthlySale[] = salesRes.data || []
    const items: any[] = itemsRes.data || []

    // Aggregate sales
    let byCash = 0, byCard = 0, byTransfer = 0, byFiado = 0, byOther = 0
    const dailyMap: Record<string, DailyStat> = {}

    sales.forEach(s => {
      if (s.payment_method === 'cash') byCash += s.total
      else if (s.payment_method === 'card') byCard += s.total
      else if (s.payment_method === 'transfer') byTransfer += s.total
      else if (s.payment_method === 'fiado') byFiado += s.total
      else byOther += s.total

      const day = format(new Date(s.created_at), 'yyyy-MM-dd')
      if (!dailyMap[day]) dailyMap[day] = { day, total: 0, count: 0 }
      dailyMap[day].total += s.total
      dailyMap[day].count++
    })

    // Aggregate products
    const productMap: Record<string, TopProduct> = {}
    items.forEach((item: any) => {
      const name = item.products?.name || 'Desconocido'
      if (!productMap[name]) productMap[name] = { name, quantity: 0, revenue: 0 }
      productMap[name].quantity += item.quantity
      productMap[name].revenue  += item.subtotal
    })

    const totalRevenue = sales.reduce((s, c) => s + c.total, 0)
    const totalTransactions = sales.length

    setReport({
      totalRevenue,
      totalTransactions,
      ticketAvg: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
      byCash, byCard, byTransfer, byFiado, byOther,
      topProducts: Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      dailyStats: Object.values(dailyMap).sort((a, b) => a.day.localeCompare(b.day))
    })
    setLoading(false)
  }, [currentKiosk, monthDate])

  useEffect(() => { fetchReport() }, [fetchReport])

  const fmt = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n)
  const pct = (n: number) => report && report.totalRevenue > 0 ? ((n / report.totalRevenue) * 100).toFixed(1) + '%' : '0%'

  const monthLabel = format(monthDate, "MMMM yyyy", { locale: es })

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold">Reporte Mensual</h1>
          <p className="text-sm text-muted-foreground">Resumen financiero imprimible.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-card border rounded-md shadow-sm">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMonthDate(subMonths(monthDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="w-36 text-center font-semibold capitalize text-sm px-2">{monthLabel}</div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button className="gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !report ? null : (
        <div id="monthly-report" className="space-y-6">
          {/* Report header (visible in print) */}
          <div className="hidden print:block text-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold">{currentKiosk?.name}</h1>
            <p className="text-lg capitalize font-medium">{monthLabel}</p>
            <p className="text-sm text-gray-500">Generado el {format(new Date(), "d 'de' MMMM yyyy", { locale: es })}</p>
          </div>

          {/* ── KPIs ── */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Facturación</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(report.totalRevenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">Ingresos totales del mes</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Transacciones</CardTitle>
                <ShoppingBag className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.totalTransactions}</div>
                <p className="text-xs text-muted-foreground mt-1">Ventas del mes</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
                <DollarSign className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{fmt(report.ticketAvg)}</div>
                <p className="text-xs text-muted-foreground mt-1">Por venta</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Fiado</CardTitle>
                <CreditCard className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{fmt(report.byFiado)}</div>
                <p className="text-xs text-muted-foreground mt-1">Por cobrar en cuentas</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* ── Desglose por método de pago ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Desglose por Método de Pago</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Efectivo', value: report.byCash, color: 'bg-green-500' },
                  { label: 'Tarjeta', value: report.byCard, color: 'bg-blue-500' },
                  { label: 'Transferencia', value: report.byTransfer, color: 'bg-purple-500' },
                  { label: 'Fiado', value: report.byFiado, color: 'bg-orange-500' },
                  { label: 'Otro', value: report.byOther, color: 'bg-gray-400' },
                ].filter(m => m.value > 0).map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{m.label}</span>
                      <span className="tabular-nums font-bold">{fmt(m.value)} <span className="text-muted-foreground font-normal">({pct(m.value)})</span></span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full ${m.color} rounded-full transition-all`}
                        style={{ width: pct(m.value) }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* ── Top productos ── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 10 Productos</CardTitle>
              </CardHeader>
              <CardContent>
                {report.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin datos este mes.</p>
                ) : (
                  <div className="divide-y">
                    {report.topProducts.map((p, i) => (
                      <div key={p.name} className="flex items-center justify-between py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-center font-bold text-muted-foreground">#{i + 1}</span>
                          <span className="font-medium truncate max-w-[180px]">{p.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-semibold tabular-nums">{fmt(p.revenue)}</div>
                          <div className="text-xs text-muted-foreground">{p.quantity} u.</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Ventas por día ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ventas por Día</CardTitle>
            </CardHeader>
            <CardContent>
              {report.dailyStats.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium text-muted-foreground">Día</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Ventas</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Total</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Ticket Prom.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {report.dailyStats.map(stat => (
                        <tr key={stat.day} className="hover:bg-muted/30">
                          <td className="py-2 px-2 capitalize">
                            {format(new Date(stat.day + 'T12:00:00'), "EEEE d", { locale: es })}
                          </td>
                          <td className="py-2 px-2 text-right tabular-nums">{stat.count}</td>
                          <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmt(stat.total)}</td>
                          <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                            {fmt(stat.count > 0 ? stat.total / stat.count : 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2">
                      <tr className="font-bold">
                        <td className="py-2 px-2">TOTAL</td>
                        <td className="py-2 px-2 text-right">{report.totalTransactions}</td>
                        <td className="py-2 px-2 text-right">{fmt(report.totalRevenue)}</td>
                        <td className="py-2 px-2 text-right">{fmt(report.ticketAvg)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Print footer */}
          <div className="hidden print:block text-center text-xs text-gray-400 border-t pt-4 mt-6">
            KioskApp · {currentKiosk?.name} · Reporte {monthLabel}
          </div>
        </div>
      )}
    </div>
  )
}
