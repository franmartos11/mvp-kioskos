"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, CheckCircle, Wallet, CalendarDays, PackageCheck, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { supabase } from "@/utils/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { useKiosk } from "@/components/providers/kiosk-provider"

interface OrderDetailsClientProps {
    orderId: string
}

export function OrderDetailsClient({ orderId }: OrderDetailsClientProps) {
    const { currentKiosk } = useKiosk()
    const isOwner = currentKiosk?.role === 'owner'
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [order, setOrder] = useState<any>(null)
    const [items, setItems] = useState<any[]>([])
    
    // Actions State
    const [receiving, setReceiving] = useState(false) // Processing reception
    const [paying, setPaying] = useState(false) // Processing payment
    const [deleting, setDeleting] = useState(false)
    const [paymentAmount, setPaymentAmount] = useState<string>("")
    const [paymentMethod, setPaymentMethod] = useState<string>("cash_register")

    useEffect(() => {
        loadOrder()
    }, [orderId])

    async function loadOrder() {
        setLoading(true)
        const { data: orderData, error } = await supabase
            .from('supplier_orders')
            .select('*')
            .eq('id', orderId)
            .single()
        
        if (error) {
            console.error("Fetch Error for OrderID:", orderId, JSON.stringify(error, null, 2))
            toast.error(`Error al cargar orden: ${error.message || error.code}`)
        } else {
            // Fetch supplier manually to avoid relationship issues
            const { data: supplier } = await supabase.from('suppliers').select('*').eq('id', orderData.supplier_id).single()
            setOrder({ ...orderData, supplier })
            
            const { data: itemsData } = await supabase
                .from('supplier_order_items')
                .select(`*, product:products(*)`)
                .eq('order_id', orderId)
            
            setItems(itemsData || [])
            setPaymentAmount(orderData.total_amount.toString())
        }
        setLoading(false)
    }

    const handleReceiveStock = async () => {
        // Confirmation handled by AlertDialog
        
        setReceiving(true)
        try {
            // 1. Update Stock for each item
            for (const item of items) {
                await supabase.rpc('increment_stock_and_update_cost', {
                    p_product_id: item.product_id,
                    p_quantity: item.quantity,
                    p_new_cost: item.cost
                })
            }

            // 2. Update Order Status
            await supabase
                .from('supplier_orders')
                .update({ 
                    status: 'received',
                    delivery_date: new Date().toISOString()
                })
                .eq('id', orderId)

            toast.success("Mercadería recibida y stock actualizado")
            loadOrder()
        } catch (error) {
            console.error(error)
            toast.error("Error al recibir mercadería")
        } finally {
            setReceiving(false)
        }
    }

    const handleUpdateQuantity = async (itemId: string, newQty: number) => {
        if (newQty < 0) return
        
        const targetItem = items.find(i => i.id === itemId)
        if (!targetItem) return

        const updatedItems = items.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    quantity: newQty,
                    subtotal: newQty * item.cost
                }
            }
            return item
        })
        
        setItems(updatedItems)
        
        const newTotal = updatedItems.reduce((sum, item) => sum + item.subtotal, 0)
        setOrder((prev: any) => ({ ...prev, total_amount: newTotal }))
        setPaymentAmount(newTotal.toString())

        try {
            await supabase.from('supplier_order_items').update({
                quantity: newQty,
                subtotal: newQty * targetItem.cost
            }).eq('id', itemId)
            
            await supabase.from('supplier_orders').update({
                total_amount: newTotal
            }).eq('id', orderId)
            
        } catch (error) {
            console.error("Error updating quantity:", error)
            toast.error("Error al actualizar la cantidad")
            loadOrder() // Rollback on error
        }
    }

    const handleDeleteOrder = async () => {
        setDeleting(true)
        try {
            const { error } = await supabase.from('supplier_orders').delete().eq('id', orderId)
            if (error) throw error
            toast.success("Orden eliminada")
            router.push('/suppliers/orders')
        } catch (error) {
            console.error(error)
            toast.error("Error al eliminar la orden")
            setDeleting(false)
        }
    }

    const handleRegisterPayment = async () => {
        const amount = parseFloat(paymentAmount)
        if (!amount || amount <= 0) {
            toast.error("Monto inválido")
            return
        }

        setPaying(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
             if (!user) throw new Error("No user")

            // Get Kiosk from context
            if (!currentKiosk) throw new Error("No kiosk selected")

            // Determine Cash Session if paying from register
            // Note: We use currentKiosk.id instead of member.kiosk_id
            let cashSessionId = null
            if (paymentMethod === 'cash_register') {
                const { data: session } = await supabase
                    .from('cash_sessions')
                    .select('id')
                    .eq('kiosk_id', currentKiosk.id)
                    .eq('status', 'open')
                    .single()
                
                if (!session) {
                    toast.error("No hay caja abierta para realizar el pago")
                    setPaying(false)
                    return
                }
                cashSessionId = session.id
            }

            // 1. Create Payment Record (future table)
            // For now, assume table exists 'supplier_payments'
             await supabase.from('supplier_payments').insert({
                 order_id: orderId,
                 kiosk_id: currentKiosk.id,
                 user_id: user.id,
                 amount: amount,
                 payment_method: paymentMethod,
                 cash_session_id: cashSessionId
             })

             // 2. Create Expense Record (for Cash Register & Dashboard)
             await supabase.from('expenses').insert({
                kiosk_id: currentKiosk.id,
                user_id: user.id,
                amount: amount,
                description: `Pago a proveedor - Orden #${orderId.slice(0, 8)}`,
                category: 'provider',
                payment_method: paymentMethod,
                date: new Date().toISOString()
             })

            // 2. Update Order Payment Status
            // Logic: if total paid >= total amount -> paid, else partial
            // Simplification: Direct 'paid' update if full amount matching
            const newStatus = amount >= order.total_amount ? 'paid' : 'partial'
            
            let updateData: any = { payment_status: newStatus }
            if (newStatus === 'paid' && order.status === 'received') {
                updateData.status = 'completed' // Fully done cycle
            }

            await supabase
                .from('supplier_orders')
                .update(updateData)
                .eq('id', orderId)

            toast.success("Pago registrado")
            loadOrder()
        } catch (error) {
            console.error(error)
            toast.error("Error al registrar pago")
        } finally {
            setPaying(false)
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
    }

    if (!order) return <div>Orden no encontrada</div>

    return (
        <div className="p-6 h-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                 <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                     <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Orden #{orderId.slice(0, 8)}</h1>
                        <Badge variant={
                            order.status === 'completed' ? 'default' : 
                            order.status === 'received' ? 'secondary' : 'outline'
                        }>
                            {order.status === 'pending' ? 'Pendiente' : 
                             order.status === 'received' ? 'Recibido (Sin Pagar)' :
                             order.status === 'completed' ? 'Completado' : order.status}
                        </Badge>
                        <Badge variant={
                            order.payment_status === 'paid' ? 'default' : 
                            order.payment_status === 'partial' ? 'secondary' : 'destructive'
                        }>
                            {order.payment_status === 'paid' ? 'Pagado' : 
                             order.payment_status === 'partial' ? 'Pago Parcial' : 'No Pagado'}
                        </Badge>
                     </div>
                     <p className="text-muted-foreground flex items-center gap-2 mt-1">
                        <CalendarDays className="h-3 w-3" />
                        {format(new Date(order.date), "dd/MM/yyyy HH:mm")} - {order.supplier.name}
                     </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content: Items */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Productos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Cantidad</TableHead>
                                    {isOwner && <TableHead className="text-right">Costo</TableHead>}
                                    {isOwner && <TableHead className="text-right">Total</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item: any) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.product.name}</TableCell>
                                        <TableCell className="text-right">
                                            {order.status === 'pending' ? (
                                                <Input 
                                                    type="number" 
                                                    className="w-20 ml-auto text-right" 
                                                    value={item.quantity}
                                                    onChange={(e) => handleUpdateQuantity(item.id, Number(e.target.value))}
                                                    step="any"
                                                />
                                            ) : (
                                                item.quantity
                                            )}
                                        </TableCell>
                                        {isOwner && <TableCell className="text-right">${item.cost}</TableCell>}
                                        {isOwner && <TableCell className="text-right font-bold">${item.subtotal}</TableCell>}
                                    </TableRow>
                                ))}
                                {isOwner && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-right font-bold text-lg">Total</TableCell>
                                        <TableCell className="text-right font-bold text-lg">${order.total_amount}</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Sidebar: Actions */}
                <div className="flex flex-col gap-6">
                    {/* Action 1: Receive */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <PackageCheck className="h-4 w-4" /> Recepción
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {order.status === 'pending' ? (
                                <div className="space-y-4">
                                    <p className="text-sm text-muted-foreground">
                                        Confirma cuando la mercadería haya llegado físicamente. Esto actualizará el stock inmediatamente.
                                    </p>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button className="w-full" disabled={receiving}>
                                                {receiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Confirmar Recepción
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>¿Confirmar Recepción?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta acción es irreversible. Se actualizará el stock de todos los productos incluidos en esta orden y se recalcularán los costos.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleReceiveStock}>Confirmar</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>

                                    <div className="pt-4 border-t">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" className="w-full flex items-center gap-2" disabled={deleting}>
                                                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                    Eliminar Orden
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Eliminar Orden?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta acción eliminará la orden de compra permanentemente y no se puede deshacer.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleDeleteOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-muted rounded-md flex items-center gap-2 text-sm text-muted-foreground">
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    Mercadería recibida el {order.delivery_date ? format(new Date(order.delivery_date), "dd/MM") : '-'}
                                </div>
                            )}
                        </CardContent>
                    </Card>


                    {/* Action 2: Payment (Owner Only) */}
                    {isOwner && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Wallet className="h-4 w-4" /> Pagos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {order.payment_status !== 'paid' ? (
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Registra un pago para esta orden.
                                        </p>
                                        
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="secondary" className="w-full">Registrar Pago</Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Registrar Pago a Proveedor</DialogTitle>
                                                    <DialogDescription>
                                                        El pago saldrá de la caja seleccionada o fondos externos.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="grid gap-4 py-4">
                                                    <div className="grid grid-cols-4 items-center gap-4">
                                                        <span className="text-sm font-medium">Monto</span>
                                                        <Input 
                                                            className="col-span-3" 
                                                            type="number" 
                                                            value={paymentAmount}
                                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-4 items-center gap-4">
                                                        <span className="text-sm font-medium">Método</span>
                                                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                                            <SelectTrigger className="col-span-3">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="cash_register">Efectivo de Caja (Actual)</SelectItem>
                                                                <SelectItem value="cash_external">Efectivo Externo</SelectItem>
                                                                <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                                                                <SelectItem value="other">Otro</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button onClick={handleRegisterPayment} disabled={paying}>
                                                        {paying ? "Registrando..." : "Confirmar Pago"}
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-muted rounded-md flex items-center gap-2 text-sm text-muted-foreground">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        Orden pagada en su totalidad.
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
