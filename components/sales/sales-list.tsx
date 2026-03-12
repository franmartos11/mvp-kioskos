"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/utils/supabase/client"
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon, Eye, DollarSign, CreditCard, ArrowUpRight, Store, CheckCircle2, Download, TrendingUp } from "lucide-react"
import { DateRange } from "react-day-picker"

import { BillingDialog } from "@/components/sales/billing-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useKiosk } from "@/components/providers/kiosk-provider"

// ─── Types ─────────────────────────────────────────────────────────────────────
interface SaleItem {
  id: string
  quantity: number
  unit_price: number
  subtotal: number
  products: { name: string }
}

interface Sale {
  id: string
  created_at: string
  total: number
  payment_method: string
  kiosk_id: string
  items?: SaleItem[]
  customer_name?: string | null
  kiosks: { name: string }
  cae?: string | null
  invoice_number?: number | null
  invoice_type?: string | null
}

type PeriodKey = "today" | "week" | "month" | "last30" | "custom"

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getDateRange(period: PeriodKey, customRange?: DateRange): { from: Date; to: Date } {
  const now = new Date()
  switch (period) {
    case "today":   return { from: startOfDay(now), to: endOfDay(now) }
    case "week":    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }
    case "month":   return { from: startOfMonth(now), to: endOfMonth(now) }
    case "last30":  return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) }
    case "custom":
      return {
        from: customRange?.from ? startOfDay(customRange.from) : startOfDay(now),
        to:   customRange?.to   ? endOfDay(customRange.to)   : endOfDay(now),
      }
  }
}

const periodLabels: Record<PeriodKey, string> = {
  today:  "Hoy",
  week:   "Esta semana",
  month:  "Este mes",
  last30: "Últimos 30 días",
  custom: "Rango personalizado",
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function SalesList() {
  const { currentKiosk } = useKiosk()
  const [period, setPeriod] = useState<PeriodKey>("today")
  const [customRange, setCustomRange] = useState<DateRange | undefined>()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const fetchSales = useCallback(async () => {
    if (!currentKiosk) return
    setLoading(true)
    const { from, to } = getDateRange(period, customRange)
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, kiosks(name)')
        .eq('kiosk_id', currentKiosk.id)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setSales(data || [])
    } catch (error) {
      console.error("Error fetching sales:", error)
    } finally {
      setLoading(false)
    }
  }, [currentKiosk, period, customRange])

  useEffect(() => { fetchSales() }, [fetchSales])

  const handleViewDetails = async (sale: Sale) => {
    setSelectedSale(sale)
    setIsDetailsOpen(true)
    setDetailsLoading(true)
    try {
      const { data, error } = await supabase
        .from('sale_items')
        .select('*, products(name)')
        .eq('sale_id', sale.id)
      if (error) throw error
      setSaleItems(data || [])
    } catch (error) {
      console.error("Error fetching items:", error)
    } finally {
      setDetailsLoading(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)

  const translatePaymentMethod = (method: string) => {
    const map: Record<string, string> = {
      cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', fiado: 'Fiado', other: 'Otro'
    }
    return map[method] || method
  }

  const exportCSV = () => {
    if (sales.length === 0) return
    const { from, to } = getDateRange(period, customRange)
    const headers = ['Fecha', 'Hora', 'Kiosco', 'Método', 'Cliente', 'Total']
    const rows = sales.map(s => [
      format(new Date(s.created_at), 'dd/MM/yyyy'),
      format(new Date(s.created_at), 'HH:mm'),
      s.kiosks?.name || '',
      translatePaymentMethod(s.payment_method),
      s.customer_name || '',
      s.total.toFixed(2)
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ventas_${format(from, 'yyyy-MM-dd')}_${format(to, 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Derived stats ───────────────────────────────────────────────────────────
  const totalRevenue = sales.reduce((s, c) => s + c.total, 0)
  const ticketAvg    = sales.length > 0 ? totalRevenue / sales.length : 0
  const byCash       = sales.filter(s => s.payment_method === 'cash').reduce((s, c) => s + c.total, 0)
  const byCard       = sales.filter(s => s.payment_method === 'card').reduce((s, c) => s + c.total, 0)
  const byFiado      = sales.filter(s => s.payment_method === 'fiado').reduce((s, c) => s + c.total, 0)
  const byOther      = sales.filter(s => !['cash','card','fiado'].includes(s.payment_method)).reduce((s, c) => s + c.total, 0)

  // ─── Period label ────────────────────────────────────────────────────────────
  const { from, to } = getDateRange(period, customRange)
  const rangeLabel = period === "today"
    ? format(from, "d 'de' MMMM, yyyy", { locale: es })
    : `${format(from, "d MMM", { locale: es })} – ${format(to, "d MMM yyyy", { locale: es })}`

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Historial de Ventas</h2>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline" size="sm" className="gap-2"
            onClick={exportCSV} disabled={sales.length === 0 || loading}
          >
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>

          {/* Period selector */}
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="last30">Últimos 30 días</SelectItem>
              <SelectItem value="custom">Rango personalizado...</SelectItem>
            </SelectContent>
          </Select>

          {/* Custom date range picker */}
          {period === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-[240px] justify-start text-left font-normal", !customRange && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customRange?.from ? (
                    customRange.to
                      ? `${format(customRange.from, "d MMM", { locale: es })} – ${format(customRange.to, "d MMM yy", { locale: es })}`
                      : format(customRange.from, "d MMM yyyy", { locale: es })
                  ) : "Elegir rango..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={setCustomRange}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* ── Stats cards ──────────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Ventas</CardTitle>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{sales.length} transacciones</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(ticketAvg)}</div>
            <p className="text-xs text-muted-foreground mt-1">Promedio por venta</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Efectivo</CardTitle>
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(byCash)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {byCard > 0 && `Tarjeta: ${formatCurrency(byCard)}`}
              {byOther > 0 && ` · Otro: ${formatCurrency(byOther)}`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fiado</CardTitle>
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
              <CreditCard className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(byFiado)}</div>
            <p className="text-xs text-muted-foreground mt-1">Por cobrar en cuentas</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────────── */}
      <div className="rounded-md border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha/Hora</TableHead>
              <TableHead>Kiosco</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>AFIP</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {[...Array(5)].map((_, j) => (
                    <TableCell key={j}><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No hay ventas registradas para este período.
                </TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow key={sale.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    <div>{format(new Date(sale.created_at), "dd/MM")}</div>
                    <div className="text-xs opacity-70">{format(new Date(sale.created_at), "HH:mm")}</div>
                  </TableCell>
                  <TableCell className="font-medium">{sale.kiosks?.name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1 items-start">
                      <Badge variant="secondary" className={cn(
                        "capitalize pl-1 pr-2 py-0.5 text-xs font-normal border-0",
                        sale.payment_method === 'cash'     ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                        sale.payment_method === 'card'     ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                        sale.payment_method === 'transfer' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                        sale.payment_method === 'fiado'    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        <span className="mr-1 opacity-70">
                          {sale.payment_method === 'card'     ? <CreditCard className="w-3 h-3 inline" /> :
                           sale.payment_method === 'transfer' ? <ArrowUpRight className="w-3 h-3 inline" /> :
                           <DollarSign className="w-3 h-3 inline" />}
                        </span>
                        {translatePaymentMethod(sale.payment_method)}
                      </Badge>
                      {sale.customer_name && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-1">
                          👤 {sale.customer_name}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {sale.cae ? (
                      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 gap-1 pr-2">
                        <CheckCircle2 className="h-3 w-3" />
                        FC {sale.invoice_type}-{sale.invoice_number}
                      </Badge>
                    ) : (
                      <BillingDialog saleId={sale.id} total={sale.total} onSuccess={fetchSales} />
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {formatCurrency(sale.total)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewDetails(sale)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Sale Detail Dialog ────────────────────────────────────────────────── */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md sm:rounded-xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-center text-xl flex flex-col items-center gap-2">
              <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              Ticket de Venta
            </DialogTitle>
            <DialogDescription className="text-center space-y-1">
              <span className="block font-mono text-xs text-muted-foreground">{selectedSale?.id}</span>
              <span className="block text-sm">
                {selectedSale && format(new Date(selectedSale.created_at), "PPP 'a las' HH:mm", { locale: es })}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium bg-secondary px-2 py-0.5 rounded-full mt-1">
                <Store className="h-3 w-3" />
                {selectedSale?.kiosks?.name}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {detailsLoading ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Cargando items...</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {saleItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-start text-sm hover:bg-muted/30 p-2 rounded-lg transition-colors">
                      <div className="flex-1">
                        <div className="font-medium">{item.products?.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </div>
                      </div>
                      <div className="font-semibold tabular-nums">{formatCurrency(item.subtotal)}</div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-3 bg-muted/20 -mx-6 px-6 pb-2">
                  {selectedSale?.customer_name && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Cliente</span>
                      <span className="font-medium">👤 {selectedSale.customer_name}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Método de pago</span>
                    <Badge variant="outline" className="capitalize bg-background">
                      {translatePaymentMethod(selectedSale?.payment_method || '')}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed font-bold text-lg">
                    <span>Total</span>
                    <span className="text-xl text-green-600 dark:text-green-500">
                      {selectedSale && formatCurrency(selectedSale.total)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
