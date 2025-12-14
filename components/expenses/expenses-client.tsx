"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Plus, Search, Filter, TrendingDown } from "lucide-react"
import { AddExpenseDialog } from "./add-expense-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useKiosk } from "@/components/providers/kiosk-provider"

export function ExpensesClient() {
    const { currentKiosk } = useKiosk()
    const [expenses, setExpenses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [categoryFilter, setCategoryFilter] = useState("all")
    const [dialogOpen, setDialogOpen] = useState(false)

    useEffect(() => {
        if (currentKiosk) {
            fetchExpenses()
        }
    }, [categoryFilter, currentKiosk])

    async function fetchExpenses() {
        if (!currentKiosk) return
        setLoading(true)
        
        let query = supabase
            .from('expenses')
            .select('*')
            .eq('kiosk_id', currentKiosk.id)
            .order('date', { ascending: false })
            
        if (categoryFilter !== "all") {
            query = query.eq('category', categoryFilter)
        }

        const { data, error } = await query
        if (error) {
            console.error("Error fetching expenses:", error)
        } else {
            setExpenses(data || [])
        }
        setLoading(false)
    }


    const filteredExpenses = expenses.filter(ex => 
        ex.description.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalFiltered = filteredExpenses.reduce((sum, ex) => sum + ex.amount, 0)

    const categoryLabels: Record<string, string> = {
        services: "Servicios",
        rent: "Alquiler",
        salaries: "Sueldos",
        inventory: "Mercadería",
        other: "Otros"
    }

    return (
        <div className="p-6 h-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gastos</h1>
                    <p className="text-muted-foreground">Administra los egresos del negocio.</p>
                </div>
                <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Gasto
                </Button>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                     <div>
                        <CardTitle>Historial de Gastos</CardTitle>
                        <CardDescription>Lista completa de egresos registrados.</CardDescription>
                     </div>
                     <div className="text-right">
                         <div className="text-2xl font-bold text-destructive">-${totalFiltered.toLocaleString()}</div>
                         <p className="text-xs text-muted-foreground">Total en vista</p>
                     </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar por descripción..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <div className="w-[200px]">
                            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    <SelectItem value="services">Servicios</SelectItem>
                                    <SelectItem value="rent">Alquiler</SelectItem>
                                    <SelectItem value="salaries">Sueldos</SelectItem>
                                    <SelectItem value="inventory">Mercadería</SelectItem>
                                    <SelectItem value="other">Otros</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">Cargando...</TableCell>
                                    </TableRow>
                                ) : filteredExpenses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            No se encontraron gastos.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredExpenses.map((expense) => (
                                        <TableRow key={expense.id}>
                                            <TableCell>{format(new Date(expense.date), "dd/MM/yyyy HH:mm")}</TableCell>
                                            <TableCell className="font-medium">{expense.description}</TableCell>
                                            <TableCell>
                                                <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                                                    {categoryLabels[expense.category] || expense.category}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-destructive">
                                                -${expense.amount.toLocaleString()}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {currentKiosk && (
                <AddExpenseDialog 
                    open={dialogOpen} 
                    onOpenChange={setDialogOpen}
                    kioskId={currentKiosk.id}
                    onSuccess={() => fetchExpenses()}
                />
            )}
        </div>
    )
}
