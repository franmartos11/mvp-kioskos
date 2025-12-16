"use client"

import { useState } from "react"
import { useFinance, ExpenseCategory, PaymentMethod } from "@/hooks/use-finance"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, DollarSign, Calendar } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

export function ExpenseList() {
    const { expenses, isLoadingExpenses, createExpenseMutation } = useFinance()
    const [open, setOpen] = useState(false)
    
    // Form state
    const [amount, setAmount] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState<ExpenseCategory>('provider')
    const [method, setMethod] = useState<PaymentMethod>('cash')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await createExpenseMutation.mutateAsync({
            amount: parseFloat(amount),
            description,
            category,
            payment_method: method
        })
        setOpen(false)
        setAmount("")
        setDescription("")
    }

    if (isLoadingExpenses) return <div>Cargando gastos...</div>

    const totalExpenses = expenses?.reduce((acc, curr) => acc + curr.amount, 0) || 0

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                 <div className="text-2xl font-bold">
                    Total Gastos: ${totalExpenses.toLocaleString()}
                 </div>
                 <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" /> Registrar Gasto
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Monto</Label>
                                <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ej: Pago Proveedor Coca Cola" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Categoría</Label>
                                    <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="provider">Proveedor</SelectItem>
                                            <SelectItem value="service">Servicio (Luz/Int)</SelectItem>
                                            <SelectItem value="withdrawal">Retiro</SelectItem>
                                            <SelectItem value="other">Otro</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Método de Pago</Label>
                                    <Select value={method} onValueChange={(v: any) => setMethod(v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Efectivo</SelectItem>
                                            <SelectItem value="transfer">Transferencia</SelectItem>
                                            <SelectItem value="card">Tarjeta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button type="submit" className="w-full" disabled={createExpenseMutation.isPending}>
                                {createExpenseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar
                            </Button>
                        </form>
                    </DialogContent>
                 </Dialog>
            </div>

            <div className="space-y-4">
                {expenses?.length === 0 && <div className="text-center text-muted-foreground py-10">No hay gastos registrados</div>}
                
                {expenses?.map(expense => (
                    <Card key={expense.id} className="overflow-hidden">
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center
                                    ${expense.payment_method === 'cash' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}
                                `}>
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-medium">{expense.description}</p>
                                    <p className="text-sm text-muted-foreground capitalize">
                                        {expense.category} • {expense.payment_method}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-red-600">- ${expense.amount.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground">
                                    {new Date(expense.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    )
}
