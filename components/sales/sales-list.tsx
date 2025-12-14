"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon, Eye, DollarSign, CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"
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
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">
                      {formatCurrency(sales.reduce((acc, curr) => acc + curr.total, 0))}
                  </div>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Transacciones</CardTitle>
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">
                      {sales.length}
                  </div>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">
                      {formatCurrency(sales.length > 0 ? sales.reduce((acc, curr) => acc + curr.total, 0) / sales.length : 0)}
                  </div>
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
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando...</TableCell>
                </TableRow>
            ) : sales.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay ventas registradas para este día.</TableCell>
                </TableRow>
            ) : (
                sales.map((sale) => (
                <TableRow key={sale.id}>
                    <TableCell className="font-medium">
                        {format(new Date(sale.created_at), "HH:mm")}
                    </TableCell>
                    <TableCell>{sale.kiosks?.name || 'Unknown'}</TableCell>
                    <TableCell>
                        <div className="flex flex-col">
                             <div className="flex items-center gap-2">
                                 {sale.payment_method === 'card' ? <CreditCard className="w-3 h-3"/> : <DollarSign className="w-3 h-3"/>}
                                 {translatePaymentMethod(sale.payment_method)}
                             </div>
                             {sale.customer_name && (
                                 <span className="text-xs text-muted-foreground flex items-center gap-1">
                                     👤 {sale.customer_name}
                                 </span>
                             )}
                        </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(sale.total)}
                    </TableCell>
                    <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(sale)}>
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
          <DialogContent className="max-w-md">
              <DialogHeader className="border-b pb-4">
                  <DialogTitle className="text-center text-xl">Ticket de Venta</DialogTitle>
                  <DialogDescription className="text-center space-y-1">
                      <span className="block font-mono text-xs text-muted-foreground">{selectedSale?.id}</span>
                      <span className="block">{selectedSale && format(new Date(selectedSale.created_at), "PPP 'a las' HH:mm", { locale: es })}</span>
                      <span className="block font-medium text-foreground">{selectedSale?.kiosks?.name}</span>
                  </DialogDescription>
              </DialogHeader>
              
              <div className="py-2 space-y-4">
                  {detailsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Cargando items...</div>
                  ) : (
                      <>
                        <div className="space-y-3">
                            {saleItems.map((item) => (
                                <div key={item.id} className="flex justify-between items-start text-sm">
                                    <div className="flex-1">
                                        <div className="font-medium">{item.products?.name}</div>
                                        <div className="text-xs text-muted-foreground">{item.quantity} x {formatCurrency(item.unit_price)}</div>
                                    </div>
                                    <div className="font-semibold tabular-nums">
                                        {formatCurrency(item.subtotal)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div className="border-t pt-4 space-y-2">
                            {selectedSale?.customer_name && (
                                <div className="flex justify-between items-center text-sm text-muted-foreground">
                                    <span>Pagado por:</span>
                                    <span className="font-medium text-foreground">{selectedSale.customer_name}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-sm text-muted-foreground">
                                <span>Método de pago:</span>
                                <span className="font-medium text-foreground capitalize">{translatePaymentMethod(selectedSale?.payment_method || '')}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t font-bold text-xl">
                                <span>Total</span>
                                <span>{selectedSale && formatCurrency(selectedSale.total)}</span>
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
