"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Skeleton } from "@/components/ui/skeleton"

interface Kiosk {
  id: string
  name: string
}

interface ExpensesListProps {
  kiosks: Kiosk[]
}

const CATEGORY_LABELS: Record<string, string> = {
  services: "Servicios",
  rent: "Alquiler",
  inventory: "Mercadería",
  salaries: "Sueldos",
  other: "Otros"
}

export function ExpensesList({ kiosks }: ExpensesListProps) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKiosk, setSelectedKiosk] = useState<string>("all")

  const fetchExpenses = async () => {
    setLoading(true)
    let query = supabase
      .from('expenses')
      .select(`
        *,
        kiosks (name)
      `)
      .order('date', { ascending: false })

    if (selectedKiosk !== 'all') {
      query = query.eq('kiosk_id', selectedKiosk)
    }

    const { data, error } = await query

    if (error) {
      console.error("Error fetching expenses:", error)
    } else {
      setExpenses(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchExpenses()
  }, [selectedKiosk])

  // Expose refresh capability via custom event or similar if needed, 
  // but for now relying on parent or simple polling/effect is okay.
  // Actually, since this is a separate component, let's just re-fetch when props change or filtered.

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Historial de Gastos</CardTitle>
        <div className="w-[200px]">
             <Select value={selectedKiosk} onValueChange={setSelectedKiosk}>
                <SelectTrigger>
                    <SelectValue placeholder="Filtrar por Kiosco" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todos los Kioscos</SelectItem>
                    {kiosks.map(k => (
                        <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
             <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
             </div>
        ) : expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
                No hay gastos registrados.
            </div>
        ) : (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Kiosco</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {expenses.map((expense) => (
                        <TableRow key={expense.id}>
                            <TableCell>{format(new Date(expense.date), "dd/MM/yyyy", { locale: es })}</TableCell>
                            <TableCell>{expense.description}</TableCell>
                            <TableCell>{CATEGORY_LABELS[expense.category] || expense.category}</TableCell>
                            <TableCell>{expense.kiosks?.name}</TableCell>
                            <TableCell className="text-right font-medium text-red-500">
                                - ${expense.amount.toFixed(2)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )}
      </CardContent>
    </Card>
  )
}
