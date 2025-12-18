"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Trash2, Plus, Tag } from "lucide-react"
import { toast } from "sonner"

interface Category {
    id: string
    name: string
}

export function CategoriesManager() {
    const { currentKiosk } = useKiosk()
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [newCategoryName, setNewCategoryName] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    useEffect(() => {
        if (currentKiosk) fetchCategories()
    }, [currentKiosk])

    const fetchCategories = async () => {
        if (!currentKiosk) return
        const { data } = await supabase
            .from('categories')
            .select('*')
            .eq('kiosk_id', currentKiosk.id)
            .order('name')
        setCategories(data || [])
        setLoading(false)
    }

    const handleCreate = async () => {
        if (!currentKiosk || !newCategoryName.trim()) return

        try {
            const { error } = await supabase.from('categories').insert({
                kiosk_id: currentKiosk.id,
                name: newCategoryName.trim()
            })

            if (error) throw error

            toast.success("Categoría creada")
            setNewCategoryName("")
            fetchCategories()
        } catch (error) {
            toast.error("Error al crear categoría")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Si borras esta categoría, los productos quedarán sin categoría. ¿Seguro?")) return

        try {
            const { error } = await supabase.from('categories').delete().eq('id', id)
            if (error) throw error
            toast.success("Categoría eliminada")
            fetchCategories()
        } catch (error) {
            toast.error("Error al eliminar")
        }
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Tag className="mr-2 h-4 w-4" /> Categorías
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gestionar Categorías</DialogTitle>
                    <DialogDescription>Crea categorías para organizar tus productos y aplicar reglas de precios.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Nueva categoría (ej: Bebidas)" 
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        />
                        <Button onClick={handleCreate} disabled={!newCategoryName.trim()}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                        {categories.length === 0 && (
                            <div className="p-4 text-center text-sm text-muted-foreground">
                                No hay categorías. Crea la primera.
                            </div>
                        )}
                        {categories.map((cat) => (
                            <div key={cat.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                                <span className="text-sm font-medium">{cat.name}</span>
                                <Button variant="ghost" size="sm" className="h-8 w-8 text-red-500" onClick={() => handleDelete(cat.id)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
