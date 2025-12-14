"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Plus, Trash, ArrowLeft, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { supabase } from "@/utils/supabase/client"
import { Product } from "@/types/inventory"

interface OrderItem {
    product: Product
    quantity: number
    cost: number
}

interface Supplier {
    id: string
    name: string
}

import { useKiosk } from "@/components/providers/kiosk-provider"

export function NewOrderClient() {
    const router = useRouter()
    const { currentKiosk } = useKiosk()
    const [loading, setLoading] = useState(true) // Start true to wait for checks
    const [saving, setSaving] = useState(false)
    
    // State
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>("")
    
    const [products, setProducts] = useState<Product[]>([]) // Catalog
    const [searchTerm, setSearchTerm] = useState("")
    const [searchResults, setSearchResults] = useState<Product[]>([])
    
    const [items, setItems] = useState<OrderItem[]>([])

    useEffect(() => {
        // Protect Route
        if (currentKiosk && currentKiosk.role !== 'owner') {
            toast.error("No tienes permisos para realizar pedidos")
            router.push('/suppliers')
            return
        }

        async function load(kioskId: string) {
            setLoading(true)
            const [supRes, prodRes] = await Promise.all([
                supabase.from('suppliers').select('id, name').order('name'),
                supabase.from('products').select('*').eq('kiosk_id', kioskId).order('name').limit(50)
            ])
            
            if (supRes.data) setSuppliers(supRes.data)
            if (prodRes.data) setProducts(prodRes.data as Product[])
            setLoading(false)
        }
        if (currentKiosk) {
            load(currentKiosk.id)
        }
    }, [currentKiosk, router])

    // Search logic
    useEffect(() => {
        if (!searchTerm) {
            setSearchResults([])
            return
        }
        const lower = searchTerm.toLowerCase()
        const results = products.filter(p => 
            p.name.toLowerCase().includes(lower) || 
            p.barcode?.includes(lower)
        )
        setSearchResults(results)
    }, [searchTerm, products])

    const addItem = (product: Product) => {
        setItems(prev => {
            const exists = prev.find(i => i.product.id === product.id)
            if (exists) {
                return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
            }
            return [...prev, { product, quantity: 1, cost: product.cost || 0 }]
        })
        setSearchTerm("") // Clear search to continue scanning adding
    }

    const updateItem = (productId: string, field: 'quantity' | 'cost', value: number) => {
        setItems(prev => prev.map(item => {
            if (item.product.id === productId) {
                return { ...item, [field]: value }
            }
            return item
        }))
    }

    const removeItem = (productId: string) => {
        setItems(prev => prev.filter(i => i.product.id !== productId))
    }

    const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.cost), 0)

    const handleSave = async () => {
        if (!selectedSupplierId) {
            toast.error("Debes seleccionar un proveedor")
            return
        }
        if (items.length === 0) {
            toast.error("La orden está vacía")
            return
        }

        setSaving(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("No user")

            // Get kiosk
            const { data: member } = await supabase.from('kiosk_members').select('kiosk_id').eq('user_id', user.id).single()
            if (!member) throw new Error("No kiosk")

            // 1. Create Order (Pending)
            const { data: order, error: orderError } = await supabase
                .from('supplier_orders')
                .insert({
                    kiosk_id: member.kiosk_id,
                    supplier_id: selectedSupplierId,
                    user_id: user.id,
                    total_amount: totalAmount,
                    status: 'pending', // Starts as pending, waiting for delivery
                    payment_status: 'unpaid',
                    date: new Date().toISOString()
                })
                .select()
                .single()

            if (orderError) throw orderError

            // 2. Create Items
            const orderItems = items.map(item => ({
                order_id: order.id,
                product_id: item.product.id,
                quantity: item.quantity,
                cost: item.cost,
                subtotal: item.quantity * item.cost
            }))

            const { error: itemsError } = await supabase
                .from('supplier_order_items')
                .insert(orderItems)
            
            if (itemsError) throw itemsError

            // 3. NO Stock update here yet. Done on reception.

            toast.success("Pedido creado correctamente")
            router.push(`/suppliers`) 
            router.refresh()
        } catch (error) {
            console.error(error)
            toast.error("Error al guardar el pedido")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="p-6 h-full flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                     <h1 className="text-2xl font-bold tracking-tight">Nuevo Pedido a Proveedor</h1>
                     <p className="text-muted-foreground">Registra entrada de mercadería.</p>
                </div>
                <div className="ml-auto flex items-center gap-4">
                    <div className="text-right">
                        <span className="text-sm text-muted-foreground">Total Estimado</span>
                        <div className="text-2xl font-bold">${totalAmount.toLocaleString()}</div>
                    </div>
                    <Button onClick={handleSave} disabled={saving || items.length === 0}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Confirmar Pedido
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Left: Configuration & Search */}
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>1. Seleccionar Proveedor</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Elegir..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    <Card className="flex-1 flex flex-col min-h-0">
                        <CardHeader>
                            <CardTitle>2. Agregar Productos</CardTitle>
                            <CardDescription>Busca por nombre o código de barras</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar..." 
                                    className="pl-8" 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            <div className="flex-1 overflow-y-auto border rounded-md p-2">
                                {searchTerm && searchResults.length === 0 && (
                                    <div className="p-4 text-center text-muted-foreground text-sm">No se encontraron productos</div>
                                )}
                                {searchTerm && searchResults.map(p => (
                                    <div 
                                        key={p.id} 
                                        className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                                        onClick={() => addItem(p)}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">{p.name}</span>
                                            <span className="text-xs text-muted-foreground">Stock actual: {p.stock}</span>
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-8 w-8">
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {!searchTerm && (
                                    <div className="p-4 text-center text-muted-foreground text-sm">
                                        Escribe para buscar productos...
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Order Detail */}
                <Card className="lg:col-span-2 flex flex-col">
                    <CardHeader>
                        <CardTitle>Detalle del Pedido</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[40%]">Producto</TableHead>
                                    <TableHead className="w-[15%]">Cant.</TableHead>
                                    <TableHead className="w-[20%]">Costo Unit.</TableHead>
                                    <TableHead className="w-[15%] text-right">Subtotal</TableHead>
                                    <TableHead className="w-[10%]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No has agregado productos.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {items.map(item => (
                                    <TableRow key={item.product.id}>
                                        <TableCell className="font-medium">
                                            {item.product.name}
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                className="w-20 h-8"
                                                min={1}
                                                value={item.quantity}
                                                onChange={(e) => updateItem(item.product.id, 'quantity', parseInt(e.target.value) || 0)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                className="w-24 h-8"
                                                step="0.01"
                                                min={0}
                                                value={item.cost}
                                                onChange={(e) => updateItem(item.product.id, 'cost', parseFloat(e.target.value) || 0)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            ${(item.quantity * item.cost).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => removeItem(item.product.id)}
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
