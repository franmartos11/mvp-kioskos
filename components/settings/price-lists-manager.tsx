"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Trash2, Clock, Calendar, AlertCircle, Edit2 } from "lucide-react"
import { toast } from "sonner"

interface PriceList {
    id: string
    name: string
    adjustment_percentage: number
    rounding_rule: 'none' | 'nearest_10' | 'nearest_50' | 'nearest_100'
    is_active: boolean
    schedule: { day: number, start: string, end: string }[] | null
    excluded_category_ids: string[]
    excluded_product_ids: string[]
    priority: number
}

interface Category {
    id: string
    name: string
}

export function PriceListsManager() {
    const { currentKiosk } = useKiosk()
    const [lists, setLists] = useState<PriceList[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState<Partial<PriceList>>({
        name: "",
        adjustment_percentage: 0,
        rounding_rule: "none",
        is_active: true,
        excluded_category_ids: [],
        excluded_product_ids: [],
        schedule: [] // Default empty means "Always Active" if selected manually, or we logic it
    })

    // Product Search State
    const [productSearch, setProductSearch] = useState("")
    const [foundProducts, setFoundProducts] = useState<{id: string, name: string}[]>([])
    const [excludedProductsDetails, setExcludedProductsDetails] = useState<{id: string, name: string}[]>([])

    // Schedule Form Helper
    const [schedulerDay, setSchedulerDay] = useState("0") // 0=Sunday
    const [schedulerStart, setSchedulerStart] = useState("00:00")
    const [schedulerEnd, setSchedulerEnd] = useState("23:59")

    useEffect(() => {
        if (currentKiosk) {
            fetchLists()
            fetchCategories()
        }
    }, [currentKiosk])

    const fetchLists = async () => {
        if (!currentKiosk) return
        const { data, error } = await supabase
            .from('price_lists')
            .select('*')
            .eq('kiosk_id', currentKiosk.id)
            .order('created_at', { ascending: true }) // Default first
        
        // Auto-create default list if none exist
        if ((!data || data.length === 0) && !error) {
            try {
                const { error: createError } = await supabase.from('price_lists').insert({
                    kiosk_id: currentKiosk.id,
                    name: "Lista Base",
                    adjustment_percentage: 0,
                    rounding_rule: "none",
                    is_active: true,
                    priority: 0
                })
                if (!createError) {
                    // Retry fetch
                    fetchLists()
                    return
                }
            } catch (e) {
                console.error("Error creating default list", e)
            }
        }

        setLists(data || [])
        setLoading(false)
    }

    const fetchCategories = async () => {
        if (!currentKiosk) return
        const { data } = await supabase
            .from('categories')
            .select('*')
            .eq('kiosk_id', currentKiosk.id)
        setCategories(data || [])
    }

    const handleSave = async () => {
        if (!currentKiosk) return
        if (!formData.name) return toast.error("El nombre es obligatorio")

        setSaving(true)
        try {
            const payload = {
                kiosk_id: currentKiosk.id,
                name: formData.name,
                adjustment_percentage: formData.adjustment_percentage,
                rounding_rule: formData.rounding_rule,
                is_active: formData.is_active,
                priority: formData.priority, 
                excluded_category_ids: formData.excluded_category_ids,
                excluded_product_ids: formData.excluded_product_ids,
                schedule: formData.schedule && formData.schedule.length > 0 ? formData.schedule : null
            }

            if (editingId) {
                await supabase.from('price_lists').update(payload).eq('id', editingId)
                toast.success("Lista actualizada")
            } else {
                await supabase.from('price_lists').insert(payload)
                toast.success("Lista creada")
            }
            setIsDialogOpen(false)
            fetchLists()
            resetForm()
            setIsDialogOpen(false)
            fetchLists()
            resetForm()
        } catch (error) {
            console.error(error)
            toast.error("Error al guardar")
        } finally {
            setSaving(false)
        }
    }

    // Search products when typing
    useEffect(() => {
        const search = async () => {
            if (!productSearch.trim()) {
                setFoundProducts([])
                return
            }
            const { data } = await supabase
                .from('products')
                .select('id, name')
                .eq('kiosk_id', currentKiosk?.id)
                .ilike('name', `%${productSearch}%`)
                .limit(5)
            setFoundProducts(data || [])
        }
        const timeout = setTimeout(search, 300)
        return () => clearTimeout(timeout)
    }, [productSearch, currentKiosk])

    // Load details of excluded products when editing
    useEffect(() => {
        const loadDetails = async () => {
             if (formData.excluded_product_ids && formData.excluded_product_ids.length > 0) {
                 const { data } = await supabase
                    .from('products')
                    .select('id, name')
                    .in('id', formData.excluded_product_ids)
                 setExcludedProductsDetails(data || [])
             } else {
                 setExcludedProductsDetails([])
             }
        }
        loadDetails()
    }, [formData.excluded_product_ids])

    const toggleProductExclusion = (product: {id: string, name: string}) => {
        const current = formData.excluded_product_ids || []
        if (current.includes(product.id)) {
            setFormData({
                ...formData, 
                excluded_product_ids: current.filter(id => id !== product.id)
            })
        } else {
            setFormData({
                ...formData, 
                excluded_product_ids: [...current, product.id]
            })
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("¿Seguro que deseas eliminar esta lista?")) return
        await supabase.from('price_lists').delete().eq('id', id)
        toast.success("Lista eliminada")
        fetchLists()
    }

    const resetForm = () => {
        setEditingId(null)
        setFormData({
            name: "",
            adjustment_percentage: 0,
            rounding_rule: "none",
            is_active: true,
            priority: 0,
            excluded_category_ids: [],
            excluded_product_ids: [],
            schedule: []
        })
        setProductSearch("")
        setFoundProducts([])
        setExcludedProductsDetails([])
    }

    const editList = (list: PriceList) => {
        setEditingId(list.id)
        setFormData({
            name: list.name,
            adjustment_percentage: list.adjustment_percentage,
            rounding_rule: list.rounding_rule,
            is_active: list.is_active,
            priority: list.priority || 0,
            excluded_category_ids: list.excluded_category_ids || [],
            excluded_product_ids: list.excluded_product_ids || [],
            schedule: list.schedule || []
        })
        setIsDialogOpen(true)
    }

    const addSchedule = () => {
        const newSchedule = [...(formData.schedule || [])]
        newSchedule.push({
            day: parseInt(schedulerDay),
            start: schedulerStart,
            end: schedulerEnd
        })
        setFormData({ ...formData, schedule: newSchedule })
    }

    const removeSchedule = (index: number) => {
        const newSchedule = [...(formData.schedule || [])]
        newSchedule.splice(index, 1)
        setFormData({ ...formData, schedule: newSchedule })
    }

    const getDayName = (day: number) => ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][day]

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Listas de Precio</CardTitle>
                    <CardDescription>Configura reglas automáticas para cambiar precios por horario.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if(!open) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Nueva Lista
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Editar Lista" : "Nueva Lista de Precios"}</DialogTitle>
                            <DialogDescription>Define el porcentaje de aumento y cuándo se aplica.</DialogDescription>
                        </DialogHeader>
                        
                        <div className="grid gap-6 py-4">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Nombre</Label>
                                    <Input 
                                        placeholder="Ej: Noche / Finde" 
                                        value={formData.name} 
                                        onChange={(e) => setFormData({...formData, name: e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Prioridad</Label>
                                    <Input 
                                        type="number" 
                                        min="0"
                                        value={formData.priority || 0} 
                                        onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 0})} 
                                    />
                                    <p className="text-xs text-muted-foreground">Mayor número = Mayor prioridad sobre otras listas.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Ajuste (%)</Label>
                                    <div className="relative">
                                        <Input 
                                            type="number" 
                                            placeholder="20" 
                                            value={formData.adjustment_percentage} 
                                            onChange={(e) => setFormData({...formData, adjustment_percentage: parseFloat(e.target.value)})} 
                                            className="pl-8"
                                        />
                                        <span className="absolute left-3 top-2.5 text-muted-foreground font-bold text-sm">%</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Usa negativo para descuentos (ej: -10).</p>
                                </div>
                            </div>

                            {/* Rounding & Active */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Redondeo</Label>
                                    <Select 
                                        value={formData.rounding_rule} 
                                        onValueChange={(v: any) => setFormData({...formData, rounding_rule: v})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Exacto (Sin redondeo)</SelectItem>
                                            <SelectItem value="nearest_10">Redondear a $10</SelectItem>
                                            <SelectItem value="nearest_50">Redondear a $50</SelectItem>
                                            <SelectItem value="nearest_100">Redondear a $100</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center space-x-2 pt-8">
                                    <Switch 
                                        checked={formData.is_active} 
                                        onCheckedChange={(c) => setFormData({...formData, is_active: c})} 
                                    />
                                    <Label>Habilitada</Label>
                                </div>
                            </div>

                            {/* Exclusions */}
                            <div className="space-y-2 border p-4 rounded-lg bg-muted/20">
                                <Label className="mb-2 block font-semibold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" /> Excluir Categorías (No aumentan)
                                </Label>
                                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                                    {categories.map((cat) => (
                                        <div key={cat.id} className="flex items-center space-x-2">
                                            <Checkbox 
                                                id={`cat-${cat.id}`} 
                                                checked={formData.excluded_category_ids?.includes(cat.id)}
                                                onCheckedChange={(checked) => {
                                                    const current = formData.excluded_category_ids || []
                                                    if (checked) {
                                                        setFormData({...formData, excluded_category_ids: [...current, cat.id]})
                                                    } else {
                                                        setFormData({...formData, excluded_category_ids: current.filter(id => id !== cat.id)})
                                                    }
                                                }}
                                            />
                                            <label htmlFor={`cat-${cat.id}`} className="text-sm cursor-pointer select-none">
                                                {cat.name}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Product Exclusions */}
                            <div className="space-y-2 border p-4 rounded-lg bg-muted/20">
                                <Label className="mb-2 block font-semibold flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4" /> Excluir Productos Específicos
                                </Label>
                                <div className="space-y-3">
                                    <div className="relative">
                                         <Input 
                                            placeholder="Buscar producto para excluir..." 
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                         />
                                         {foundProducts.length > 0 && (
                                             <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-auto">
                                                 {foundProducts.map(p => (
                                                     <div 
                                                        key={p.id} 
                                                        className="p-2 hover:bg-muted cursor-pointer flex justify-between items-center"
                                                        onClick={() => {
                                                            toggleProductExclusion(p)
                                                            setProductSearch("")
                                                            setFoundProducts([])
                                                        }}
                                                     >
                                                         <span className="text-sm">{p.name}</span>
                                                         {formData.excluded_product_ids?.includes(p.id) ? 
                                                            <Badge variant="secondary" className="text-xs">Excluido</Badge> : 
                                                            <Plus className="h-3 w-3 text-muted-foreground" />
                                                         }
                                                     </div>
                                                 ))}
                                             </div>
                                         )}
                                    </div>

                                    {/* Selected Products List */}
                                    {excludedProductsDetails.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {excludedProductsDetails.map(p => (
                                                <Badge key={p.id} variant="secondary" className="flex items-center gap-1 pl-2 pr-1 py-1">
                                                    {p.name}
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-4 w-4 ml-1 hover:bg-transparent hover:text-red-500"
                                                        onClick={() => toggleProductExclusion(p)}
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">No hay productos específicos excluidos.</p>
                                    )}
                                </div>
                            </div>

                            {/* Schedule Builder */}
                            <div className="space-y-3 border p-4 rounded-lg bg-muted/20">
                                <Label className="font-semibold flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> Horarios de Activación
                                </Label>
                                <p className="text-xs text-muted-foreground">Si no agregas horarios, la lista solo se activará manualmente.</p>
                                
                                <div className="flex gap-2 items-end">
                                    <div className="grid gap-1 flex-1">
                                        <span className="text-xs">Día</span>
                                        <Select value={schedulerDay} onValueChange={setSchedulerDay}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {[0,1,2,3,4,5,6].map(d => (
                                                    <SelectItem key={d} value={d.toString()}>{getDayName(d)}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1 w-24">
                                        <span className="text-xs">Inicio</span>
                                        <Input type="time" value={schedulerStart} onChange={e => setSchedulerStart(e.target.value)} />
                                    </div>
                                    <div className="grid gap-1 w-24">
                                        <span className="text-xs">Fin</span>
                                        <Input type="time" value={schedulerEnd} onChange={e => setSchedulerEnd(e.target.value)} />
                                    </div>
                                    <Button variant="secondary" onClick={addSchedule}>Agregar</Button>
                                </div>

                                <div className="space-y-2 mt-2">
                                    {formData.schedule?.map((s, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-background p-2 rounded border text-sm">
                                            <span>{getDayName(s.day)}: {s.start} - {s.end}</span>
                                            <Button variant="ghost" size="sm" onClick={() => removeSchedule(idx)} className="h-6 w-6 p-0 text-red-500">
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>

                        <DialogFooter>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? "Guardando..." : "Guardar Lista"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {/* List View */}
                <div className="space-y-4">
                    {lists.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No tienes listas de precios configuradas.
                        </div>
                    )}
                    {lists.map((list) => (
                        <div key={list.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold">{list.name}</span>
                                    {list.is_active ? 
                                        <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">Activa</Badge> : 
                                        <Badge variant="outline" className="text-muted-foreground">Inactiva</Badge>
                                    }
                                    <Badge variant="secondary">
                                        {list.adjustment_percentage > 0 ? '+' : ''}{list.adjustment_percentage}%
                                    </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    {list.schedule && list.schedule.length > 0 ? (
                                        <><Clock className="h-3 w-3" /> {list.schedule.length} horarios definidos</>
                                    ) : (
                                        <span className="italic">Activación manual solamente</span>
                                    )}
                                    {list.excluded_category_ids && list.excluded_category_ids.length > 0 && (
                                         <span>• {list.excluded_category_ids.length} categorías excluidas</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" onClick={() => editList(list)}>
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(list.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
