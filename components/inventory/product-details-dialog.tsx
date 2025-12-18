"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Product } from "@/types/inventory"
import { Image as ImageIcon, Barcode, Calendar, Package, DollarSign, Pencil, Save, X, ScanBarcode, Upload, TrendingUp, ShoppingCart, ChevronLeft, ChevronRight, PieChart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format, startOfMonth, endOfMonth, addMonths, subMonths, getDate } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"
import { BarcodeScanner } from "./barcode-scanner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useKiosk } from "@/components/providers/kiosk-provider"

interface ProductDetailsDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onProductUpdated?: () => void
}

export function ProductDetailsDialog({ product, open, onOpenChange, onProductUpdated }: ProductDetailsDialogProps) {
  const { currentKiosk } = useKiosk()
  const p = currentKiosk?.permissions || { view_costs: false, manage_products: false } as any

  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Stats State
  const [stats, setStats] = useState<{ totalSold: number; totalRevenue: number; estimatedProfit: number } | null>(null)
  const [salesData, setSalesData] = useState<{ day: number; sales: number }[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Form State
  const [name, setName] = useState("")
  const [barcode, setBarcode] = useState("")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState<string>("")
  const [categories, setCategories] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    async function getCategories() {
       if (!currentKiosk?.id) return
       const { data } = await supabase
        .from('categories')
        .select('id, name')
        .eq('kiosk_id', currentKiosk.id)
        .order('name')
       if (data) setCategories(data)
    }
    getCategories()
  }, [currentKiosk?.id])

  // Reset state when product changes or dialog opens
  useEffect(() => {
    if (product) {
      setName(product.name)
      setBarcode(product.barcode || "")
      setImageUrl(product.image_url)
      setCategoryId(product.category_id || "none")
      
      if (open) {
          fetchStats(product.id, currentMonth)
      }
    }
    setIsEditing(false)
  }, [product, open, currentMonth])

  const fetchStats = async (productId: string, month: Date) => {
      const start = startOfMonth(month).toISOString()
      const end = endOfMonth(month).toISOString()

      // Fetch sales for the selected month (joined with sale_items)
      // Note: We use !inner to filter by sales.created_at
      const { data, error } = await supabase
        .from('sale_items')
        .select(`
            quantity, 
            subtotal,
            sales!inner (
                created_at
            )
        `)
        .eq('product_id', productId)
        .gte('sales.created_at', start)
        .lte('sales.created_at', end)

      if (data) {
          // Calculate Totals for the Month
          const totalSold = data.reduce((acc, curr) => acc + curr.quantity, 0)
          const totalRevenue = data.reduce((acc, curr) => acc + curr.subtotal, 0)
          
          // Profit Approximation: Revenue - (Units Sold * Current Cost)
          // Note: This is an approximation using current cost, not historical cost at time of sale.
          const currentCost = product?.cost || 0
          const estimatedCost = totalSold * currentCost
          const estimatedProfit = totalRevenue - estimatedCost

          setStats({ totalSold, totalRevenue, estimatedProfit })

          // Prepare Chart Data (Daily aggregation)
          const dailySales = new Map<number, number>()
          
          // Initialize all days of month with 0
          const daysInMonth = parseInt(format(endOfMonth(month), 'd'))
          for (let i = 1; i <= daysInMonth; i++) {
              dailySales.set(i, 0)
          }

          data.forEach((item: any) => {
              const date = new Date(item.sales.created_at)
              const day = getDate(date)
              const current = dailySales.get(day) || 0
              dailySales.set(day, current + item.quantity) // Charting Quantity sold
          })

          const chartData = Array.from(dailySales.entries()).map(([day, sales]) => ({
              day,
              sales
          }))
          setSalesData(chartData)
      }
  }
  
  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))

  if (!product) return null

  const isLowStock = product.stock <= (product.min_stock ?? 5)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido")
      return
    }

    try {
      setIsLoading(true)
      const { error } = await supabase
        .from('products')
        .update({
          name,
          barcode: barcode || null,
          image_url: imageUrl,
          category_id: (categoryId === "none" || !categoryId) ? null : categoryId
        })
        .eq('id', product.id)

      if (error) throw error

      toast.success("Producto actualizado")
      setIsEditing(false)
      if (onProductUpdated) onProductUpdated()
    } catch (error) {
      console.error(error)
      toast.error("Error al actualizar producto")
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return

      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      setUploading(true)

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage.from('products').getPublicUrl(filePath)
      
      setImageUrl(data.publicUrl)
      toast.success("Imagen cargada")
    } catch (error) {
      console.error(error)
      toast.error("Error al cargar la imagen")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
             <DialogTitle className="text-2xl font-bold">
                {isEditing ? "Editar Producto" : product.name}
             </DialogTitle>
             {!isEditing && p.manage_products && (
                 <Button onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                 </Button>
             )}
          </div>
          <DialogDescription>
             {isEditing ? "Modifica los detalles del producto." : `Código: ${product.barcode || 'N/A'}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Detalles</TabsTrigger>
                <TabsTrigger value="stats">Estadísticas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="aspect-square bg-muted rounded-xl border overflow-hidden flex items-center justify-center relative group">
                    {imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                        src={imageUrl}
                        alt={name}
                        className="w-full h-full object-cover"
                        />
                    ) : (
                        <ImageIcon className="h-24 w-24 text-muted-foreground/30" />
                    )}
                    
                    {isEditing && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Label htmlFor="edit-image" className="cursor-pointer">
                                <div className="bg-white text-black px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-100 transition-colors shadow-lg">
                                    <Upload className="h-4 w-4" />
                                    {uploading ? "Subiendo..." : "Cambiar Imagen"}
                                </div>
                                <Input 
                                    id="edit-image" 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={uploading}
                                />
                            </Label>
                        </div>
                    )}
                    </div>
                    {isEditing && imageUrl && (
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setImageUrl(null)}
                        >
                            <X className="h-4 w-4 mr-2" /> Eliminar Imagen
                        </Button>
                    )}
                </div>

                <div className="space-y-8">
                    
                    {isEditing ? (
                        // EDIT FORM
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre del Producto</Label>
                                <Input 
                                    id="name" 
                                    value={name} 
                                    onChange={(e) => setName(e.target.value)} 
                                    className="text-lg"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="barcode">Código de Barras</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        id="barcode" 
                                        value={barcode} 
                                        onChange={(e) => setBarcode(e.target.value)} 
                                        placeholder="Escanear o ingresar..."
                                    />
                                    <Button type="button" variant="outline" size="icon" onClick={() => setShowScanner(true)}>
                                        <ScanBarcode className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Categoría</Label>
                                <Select value={categoryId} onValueChange={setCategoryId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar Categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Sin Categoría</SelectItem>
                                        {categories.map((cat) => (
                                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        // VIEW MODE
                        <div className="space-y-6">
                            <div className="p-4 bg-muted/30 rounded-lg border">
                                <span className="text-sm font-medium text-muted-foreground block mb-2">Precio de Venta</span>
                                <div className="text-4xl font-bold flex items-center text-primary">
                                    <DollarSign className="h-8 w-8 mr-1 text-muted-foreground" />
                                    {product.price.toFixed(2)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {p.view_costs && (
                                    <div className="p-4 rounded-lg border">
                                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Costo Unitario</span>
                                        <div className="text-xl font-semibold mt-1">
                                            {product.cost ? `$${product.cost.toFixed(2)}` : '-'}
                                        </div>
                                    </div>
                                )}
                                <div className="p-4 rounded-lg border">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Stock Actual</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-xl font-semibold ${isLowStock ? 'text-red-500' : ''}`}>
                                            {product.stock}
                                        </span>
                                        {isLowStock && <Badge variant="destructive">Bajo Stock</Badge>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 pt-4 border-t">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Package className="h-4 w-4" /> Stock Mínimo
                                    </span>
                                    <span className="font-medium">{product.min_stock ?? 5}</span>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Calendar className="h-4 w-4" /> Registrado
                                    </span>
                                    <span className="font-medium">{format(new Date(product.created_at || new Date()), "PPP", { locale: es })}</span>
                                </div>
                                
                                {product.supplier_id && (
                                     <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">ID Proveedor</span>
                                        <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{product.supplier_id.substring(0, 8)}...</span>
                                    </div>
                                )}
                                
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Categoría</span>
                                    <Badge variant="outline">{product.category?.name || "Sin Categoría"}</Badge>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                </div>
            </TabsContent>

            <TabsContent value="stats" className="pt-4 space-y-6">
                 {/* Month Select */}
                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-lg mb-4">
                     <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                        <ChevronLeft className="h-4 w-4" />
                     </Button>
                     <span className="font-semibold capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: es })}
                     </span>
                     <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                     </Button>
                </div>
                
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Unidades Vendidas</CardTitle>
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats ? stats.totalSold : "-"}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats ? `$${stats.totalRevenue.toFixed(2)}` : "-"}
                            </div>
                        </CardContent>
                    </Card>
                    {p.view_costs && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ganancia Estimada</CardTitle>
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-emerald-600">
                                    {stats ? `$${stats.estimatedProfit.toFixed(2)}` : "-"}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sales Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Tendencia Mensual</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[250px]">
                        {salesData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={salesData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis 
                                        dataKey="day" 
                                        tickLine={false} 
                                        axisLine={false} 
                                        fontSize={12}
                                    />
                                    <YAxis 
                                        tickLine={false} 
                                        axisLine={false} 
                                        fontSize={12}
                                        tickFormatter={(value) => `${value}u`}
                                    />
                                    <RechartsTooltip 
                                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                      formatter={(value: number) => [`${value} unidades`, 'Ventas']}
                                      labelFormatter={(label) => `Día ${label}`}
                                    />
                                    <Bar dataKey="sales" fill="currentColor" className="fill-primary" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                No hay datos de ventas para este mes.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>

        {isEditing && (
            <DialogFooter className="gap-2 sm:gap-0 mt-6">
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isLoading}>
                    Cancelar
                </Button>
                <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading ? "Guardando..." : "Guardar Cambios"}
                </Button>
            </DialogFooter>
        )}
        
        {showScanner && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 rounded-lg">
            <div className="w-full max-w-md bg-background rounded-lg p-4">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Escanear Código</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowScanner(false)}>
                      <X className="h-4 w-4" />
                  </Button>
               </div>
              <BarcodeScanner
                onScan={(code) => {
                  setBarcode(code)
                  setShowScanner(false)
                  toast.success("Código escaneado")
                }}
                onClose={() => setShowScanner(false)}
              />
            </div>
          </div>
        )}

      </DialogContent>
    </Dialog>
  )
}
