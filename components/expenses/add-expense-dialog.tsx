"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"

interface AddExpenseDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    kioskId: string
    onSuccess: () => void
}

export function AddExpenseDialog({ open, onOpenChange, kioskId, onSuccess }: AddExpenseDialogProps) {
    const [loading, setLoading] = useState(false)
    const [amount, setAmount] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("other")

    const handleSave = async () => {
        if (!amount || !description) return

        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            
            const { error } = await supabase.from('expenses').insert({
                kiosk_id: kioskId,
                user_id: user?.id,
                amount: parseFloat(amount),
                description: description,
                category: category,
                date: new Date().toISOString()
            })

            if (error) throw error

            toast.success("Gasto registrado")
            setAmount("")
            setDescription("")
            setCategory("other")
            onOpenChange(false)
            onSuccess()
        } catch (error) {
            console.error(error)
            toast.error("Error al guardar gasto")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Gasto</DialogTitle>
                    <DialogDescription>
                        Añade un gasto que NO haya salido de la caja diaria (ej: Alquiler).
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="desc">Descripción</Label>
                        <Input 
                            id="desc" 
                            placeholder="Ej: Pago de Alquiler Enero" 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Monto</Label>
                        <Input 
                            id="amount" 
                            type="number" 
                            placeholder="0.00" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Categoría</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="services">Servicios (Luz, Internet)</SelectItem>
                                <SelectItem value="rent">Alquiler</SelectItem>
                                <SelectItem value="salaries">Sueldos</SelectItem>
                                <SelectItem value="inventory">Mercadería (Externo)</SelectItem>
                                <SelectItem value="other">Otros</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? "Guardando..." : "Guardar Gasto"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
