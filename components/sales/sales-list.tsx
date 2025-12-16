"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon, Eye, DollarSign, CreditCard, ArrowUpRight, Store } from "lucide-react"

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useKiosk } from "@/components/providers/kiosk-provider"

interface SaleItem {
  id: string
  product_name: string // We will join this or fetch it
  quantity: number
  unit_price: number
  subtotal: number
  products: {
      name: string
  }
}

interface Sale {
  id: string
  created_at: string
  total: number
  payment_method: string
  kiosk_id: string
  items?: SaleItem[] // Optional till fetched
  customer_name?: string | null
  kiosks: {
      name: string
  }
  profiles?: {
      full_name: string
  }
}

export function SalesList() {
  const { currentKiosk } = useKiosk()
  const [date, setDate] = useState<Date | undefined>(new Date())
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  useEffect(() => {
    if (date && currentKiosk) {
      fetchSales(date)
    }
  }, [date, currentKiosk])

  const fetchSales = async (selectedDate: Date) => {
    if (!currentKiosk) return
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const startOfDay = new Date(selectedDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(selectedDate)
      endOfDay.setHours(23, 59, 59, 999)
      
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          kiosks (name)
        `)
        .eq('kiosk_id', currentKiosk.id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      setSales(data || [])
    } catch (error) {
      console.error("Error fetching sales:", JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = async (sale: Sale) => {
    setSelectedSale(sale)
    setIsDetailsOpen(true)
    setDetailsLoading(true)
    try {
        const { data, error } = await supabase
            .from('sale_items')
            .select(`
                *,
                products (name)
            `)
            .eq('sale_id', sale.id)
        
        if (error) throw error
        setSaleItems(data || [])
    } catch (error) {
        console.error("Error fetching items:", error)
    } finally {
        setDetailsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount)
  }

  const translatePaymentMethod = (method: string) => {
      const map: Record<string, string> = {
          'cash': 'Efectivo',
          'card': 'Tarjeta',
          'transfer': 'Transferencia',
          'other': 'Otro'
      }
      return map[method] || method
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
            <h2 className="text-xl font-semibold">Historial de Ventas</h2>
            <p className="text-sm text-muted-foreground">
                Ventas del día {date ? format(date, "d 'de' MMMM, yyyy", { locale: es }) : ''}
            </p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(date: Date | undefined) => setDate(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Ventas</CardTitle>
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                      {formatCurrency(sales.reduce((acc, curr) => acc + curr.total, 0))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ingresos brutos del día
                  </p>
              </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Transacciones</CardTitle>
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                    <CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                      {sales.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Operaciones realizadas
                  </p>
              </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Promedio</CardTitle>
                  <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                      {formatCurrency(sales.length > 0 ? sales.reduce((acc, curr) => acc + curr.total, 0) / sales.length : 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Promedio por venta
                  </p>
              </CardContent>
          </Card>
      </div>

      <div className="rounded-md border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Kiosco</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><div className="h-4 w-12 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
                        <TableCell>
                            <div className="flex flex-col gap-1">
                                <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
                            </div>
                        </TableCell>
                        <TableCell className="text-right"><div className="h-4 w-16 bg-muted animate-pulse rounded ml-auto" /></TableCell>
                        <TableCell><div className="h-8 w-8 bg-muted animate-pulse rounded" /></TableCell>
                    </TableRow>
                ))
            ) : sales.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay ventas registradas para este día.</TableCell>
                </TableRow>
            ) : (
                sales.map((sale) => (
                <TableRow key={sale.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono text-sm text-muted-foreground">
                        {format(new Date(sale.created_at), "HH:mm")}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{sale.kiosks?.name || 'Unknown'}</TableCell>
                    <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                             <Badge variant="secondary" className={cn(
                                 "capitalize pl-1 pr-2 py-0.5 text-xs font-normal border-0",
                                 sale.payment_method === 'cash' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                 sale.payment_method === 'card' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                 sale.payment_method === 'transfer' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                                 "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                             )}>
                                 <span className="mr-1 opacity-70">
                                     {sale.payment_method === 'card' ? <CreditCard className="w-3 h-3 inline"/> : 
                                      sale.payment_method === 'transfer' ? <ArrowUpRight className="w-3 h-3 inline"/> :
                                      <DollarSign className="w-3 h-3 inline"/>}
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
                    <TableCell className="text-right font-bold text-foreground tabular-nums">
                        {formatCurrency(sale.total)}
                    </TableCell>
                    <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50" onClick={() => handleViewDetails(sale)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                    </TableCell>
                </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>

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
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                            {saleItems.map((item) => (
                                <div key={item.id} className="flex justify-between items-start text-sm group hover:bg-muted/30 p-2 rounded-lg transition-colors">
                                    <div className="flex-1">
                                        <div className="font-medium text-foreground">{item.products?.name}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {item.quantity} x {formatCurrency(item.unit_price)}
                                        </div>
                                    </div>
                                    <div className="font-semibold tabular-nums text-foreground">
                                        {formatCurrency(item.subtotal)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="border-t pt-4 space-y-3 bg-muted/20 -mx-6 px-6 pb-2">
                            {selectedSale?.customer_name && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Cliente</span>
                                    <span className="font-medium flex items-center gap-1">
                                        👤 {selectedSale.customer_name}
                                    </span>
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
                                <span className="text-xl text-green-600 dark:text-green-500">{selectedSale && formatCurrency(selectedSale.total)}</span>
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
