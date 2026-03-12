"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, PackageCheck, Loader2, ShoppingCart, ChevronRight, ChevronDown, Trash2, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Supplier { id: string; name: string }
interface Product  { id: string; name: string; cost: number; barcode: string | null }

interface OrderItem {
  product_id: string | null
  product_name: string
  quantity: number
  unit_cost: number
}

interface PurchaseOrder {
  id: string
  created_at: string
  status: string
  notes: string | null
  total: number
  received_at: string | null
  suppliers: { name: string } | null
  purchase_order_items: { quantity: number; product_name: string; unit_cost: number }[]
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; variant: string }> = {
  draft:     { label: "Borrador",  variant: "secondary" },
  sent:      { label: "Enviado",   variant: "outline" },
  received:  { label: "Recibido", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
}

// ─── New Order Dialog ─────────────────────────────────────────────────────────
function NewOrderDialog({ suppliers, products, kioskId, onSuccess }: {
  suppliers: Supplier[]
  products: Product[]
  kioskId: string
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [supplierId, setSupplierId] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<OrderItem[]>([
    { product_id: null, product_name: "", quantity: 1, unit_cost: 0 }
  ])

  const addItem = () => setItems(prev => [
    ...prev, { product_id: null, product_name: "", quantity: 1, unit_cost: 0 }
  ])

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i))

  const updateItem = (i: number, field: keyof OrderItem, value: any) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item
      if (field === 'product_id' && value !== 'manual') {
        const p = products.find(p => p.id === value)
        if (p) return { ...item, product_id: p.id, product_name: p.name, unit_cost: p.cost || 0 }
      }
      return { ...item, [field]: value }
    }))
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unit_cost, 0)

  const handleSubmit = async () => {
    const validItems = items.filter(i => i.product_name.trim() && i.quantity > 0)
    if (validItems.length === 0) { toast.error("Agregá al menos un producto"); return }
    setLoading(true)
    try {
      const { data: order, error: oErr } = await supabase
        .from('purchase_orders')
        .insert({ kiosk_id: kioskId, supplier_id: supplierId || null, notes: notes || null, total })
        .select().single()
      if (oErr) throw oErr

      const { error: iErr } = await supabase.from('purchase_order_items').insert(
        validItems.map(i => ({
          order_id: order.id,
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_cost: i.unit_cost
        }))
      )
      if (iErr) throw iErr

      toast.success("Orden creada correctamente")
      setOpen(false)
      setSupplierId(""); setNotes("")
      setItems([{ product_id: null, product_name: "", quantity: 1, unit_cost: 0 }])
      onSuccess()
    } catch (e: any) {
      toast.error("Error al crear la orden: " + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Nueva Orden</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Orden de Compra</DialogTitle>
          <DialogDescription>Registrá los productos que pedís a tu proveedor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Proveedor */}
          <div className="space-y-1.5">
            <Label>Proveedor (opcional)</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Seleccioná un proveedor..." /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <Label>Productos</Label>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
                <div className="space-y-1">
                  {i === 0 && <span className="text-xs text-muted-foreground">Producto</span>}
                  <Select
                    value={item.product_id || 'manual'}
                    onValueChange={(v) => updateItem(i, 'product_id', v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Del inventario..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">— Escribir manualmente</SelectItem>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(!item.product_id || item.product_id === 'manual') && (
                    <Input
                      placeholder="Nombre del producto..."
                      value={item.product_name}
                      onChange={e => updateItem(i, 'product_name', e.target.value)}
                    />
                  )}
                </div>
                <div className="w-20 space-y-1">
                  {i === 0 && <span className="text-xs text-muted-foreground">Cantidad</span>}
                  <Input
                    type="number" min={1}
                    value={item.quantity}
                    onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div className="w-24 space-y-1">
                  {i === 0 && <span className="text-xs text-muted-foreground">Costo unit.</span>}
                  <Input
                    type="number" min={0} step="0.01" placeholder="$0"
                    value={item.unit_cost || ""}
                    onChange={e => updateItem(i, 'unit_cost', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <Button
                  variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(i)} disabled={items.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" className="gap-1 w-full" onClick={addItem}>
              <Plus className="h-3.5 w-3.5" /> Agregar producto
            </Button>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea
              placeholder="Instrucciones especiales, forma de entrega..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border text-sm font-semibold">
            <span>Total estimado</span>
            <span className="text-lg">${total.toFixed(2)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function PurchaseOrdersClient() {
  const { currentKiosk } = useKiosk()
  const isOwner = currentKiosk?.role === 'owner'
  const kioskId = currentKiosk?.id

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [receiving, setReceiving] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!kioskId) return
    setLoading(true)
    const [ordersRes, suppliersRes, productsRes] = await Promise.all([
      supabase.from('purchase_orders')
        .select('*, suppliers(name), purchase_order_items(quantity, product_name, unit_cost)')
        .eq('kiosk_id', kioskId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('suppliers').select('id, name').order('name'),
      supabase.from('products').select('id, name, cost, barcode').eq('kiosk_id', kioskId).order('name').limit(500),
    ])
    setOrders((ordersRes.data || []) as any)
    setSuppliers(suppliersRes.data || [])
    setProducts(productsRes.data || [])
    setLoading(false)
  }, [kioskId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleReceive = async (orderId: string) => {
    if (!confirm("¿Confirmar recepción? Se actualizará el stock de los productos.")) return
    setReceiving(orderId)
    const { error } = await supabase.rpc('receive_purchase_order', { p_order_id: orderId })
    if (error) {
      toast.error("Error al recibir la orden: " + error.message)
    } else {
      toast.success("✅ Orden recibida — stock actualizado")
      fetchData()
    }
    setReceiving(null)
  }

  const handleCancel = async (orderId: string) => {
    if (!confirm("¿Cancelar esta orden?")) return
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'cancelled' }).eq('id', orderId)
    if (error) toast.error("Error al cancelar")
    else { toast.success("Orden cancelada"); fetchData() }
  }

  const pendingOrders = orders.filter(o => o.status !== 'received' && o.status !== 'cancelled')
  const completedOrders = orders.filter(o => o.status === 'received' || o.status === 'cancelled')

  if (!kioskId) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Órdenes de Compra</h2>
          <p className="text-sm text-muted-foreground">Pedidos a proveedores con actualización automática de stock.</p>
        </div>
        {isOwner && (
          <NewOrderDialog
            suppliers={suppliers}
            products={products}
            kioskId={kioskId}
            onSuccess={fetchData}
          />
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <ClipboardList className="h-16 w-16 mb-4 opacity-20" />
          <p className="font-medium">No hay órdenes de compra</p>
          <p className="text-sm mt-1">Creá tu primera orden para registrar un pedido a un proveedor.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending / Active */}
          {pendingOrders.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                Activas ({pendingOrders.length})
              </h3>
              {pendingOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isOwner={isOwner}
                  isExpanded={expandedId === order.id}
                  onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  onReceive={() => handleReceive(order.id)}
                  onCancel={() => handleCancel(order.id)}
                  receiving={receiving === order.id}
                />
              ))}
            </div>
          )}

          {/* Completed */}
          {completedOrders.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
                Historial ({completedOrders.length})
              </h3>
              {completedOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isOwner={false}
                  isExpanded={expandedId === order.id}
                  onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  onReceive={() => {}}
                  onCancel={() => {}}
                  receiving={false}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── OrderCard ────────────────────────────────────────────────────────────────
function OrderCard({ order, isOwner, isExpanded, onToggle, onReceive, onCancel, receiving }: {
  order: PurchaseOrder
  isOwner: boolean
  isExpanded: boolean
  onToggle: () => void
  onReceive: () => void
  onCancel: () => void
  receiving: boolean
}) {
  const sc = statusConfig[order.status] || { label: order.status, variant: "secondary" }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Header Row */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={onToggle}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">#{order.id.slice(0, 8)}</span>
              <Badge variant={sc.variant as any} className="text-xs">{sc.label}</Badge>
              {order.suppliers && (
                <span className="text-sm font-medium">{order.suppliers.name}</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(order.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
              {" · "}{order.purchase_order_items.length} producto{order.purchase_order_items.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold">${order.total?.toFixed(2) || "0.00"}</div>
          </div>
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="border-t px-4 py-3 space-y-3 bg-muted/10">
            {/* Items table */}
            <div className="divide-y text-sm border rounded-md">
              {order.purchase_order_items.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2">
                  <span className="font-medium">{item.product_name}</span>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{item.quantity} u. × ${item.unit_cost.toFixed(2)}</span>
                    <span className="font-semibold text-foreground">${(item.quantity * item.unit_cost).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Notes */}
            {order.notes && (
              <p className="text-xs text-muted-foreground bg-background border rounded px-3 py-2">
                📝 {order.notes}
              </p>
            )}

            {/* Actions */}
            {isOwner && order.status !== 'received' && order.status !== 'cancelled' && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="gap-2 bg-green-600 hover:bg-green-700"
                  onClick={onReceive}
                  disabled={receiving}
                >
                  {receiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                  Confirmar Recepción
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-muted-foreground"
                  onClick={onCancel}
                >
                  Cancelar Orden
                </Button>
              </div>
            )}

            {order.status === 'received' && order.received_at && (
              <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                ✅ Recibida el {format(new Date(order.received_at), "d MMM yyyy 'a las' HH:mm", { locale: es })} — Stock actualizado automáticamente.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
