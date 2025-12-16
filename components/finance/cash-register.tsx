"use client"

import { useState, useEffect } from "react"
import { useFinance } from "@/hooks/use-finance"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Lock, Unlock, RefreshCw } from "lucide-react"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export function CashRegister() {
    const { openShift, isLoadingShift, openShiftMutation, closeShiftMutation } = useFinance()
    const { currentKiosk } = useKiosk()
    
    // Open Form State
    const [initialCash, setInitialCash] = useState("")

    // Close Form State
    const [finalCash, setFinalCash] = useState("")
    const [notes, setNotes] = useState("")
    const [isClosing, setIsClosing] = useState(false)

    // Live Metrics
    const [salesCash, setSalesCash] = useState(0)
    const [expensesCash, setExpensesCash] = useState(0)
    const [loadingMetrics, setLoadingMetrics] = useState(false)

    // Fetch live metrics if shift is open
    useEffect(() => {
        if (!openShift || !currentKiosk) return

        async function fetchMetrics() {
            setLoadingMetrics(true)
            // Sales in Cash
            const { data: sales } = await supabase
                .from('sales')
                .select('total')
                .eq('kiosk_id', currentKiosk?.id)
                .eq('payment_method', 'cash')
                .gte('created_at', openShift?.opened_at) // Sales since open
            
            const totalSales = sales?.reduce((acc, curr) => acc + curr.total, 0) || 0
            setSalesCash(totalSales)

            // Expenses in Cash
            const { data: expenses } = await supabase
                .from('expenses')
                .select('amount')
                .eq('kiosk_id', currentKiosk?.id)
                .eq('payment_method', 'cash')
                .gte('created_at', openShift?.opened_at)

            const totalExpenses = expenses?.reduce((acc, curr) => acc + curr.amount, 0) || 0
            setExpensesCash(totalExpenses)
            
            setLoadingMetrics(false)
        }

        fetchMetrics()
        // Poll every minute? or just on mount/focus
        const interval = setInterval(fetchMetrics, 30000)
        return () => clearInterval(interval)

    }, [openShift, currentKiosk])


    const handleOpen = async (e: React.FormEvent) => {
        e.preventDefault()
        await openShiftMutation.mutateAsync(parseFloat(initialCash) || 0)
    }

    const handleClose = async () => {
        if (!openShift) return
        await closeShiftMutation.mutateAsync({
            shiftId: openShift.id,
            finalCash: parseFloat(finalCash) || 0,
            notes
        })
        setIsClosing(false)
    }

    if (isLoadingShift) return <div>Cargando caja...</div>

    // 1. CAJA CERRADA (No Open Shift)
    if (!openShift) {
        return (
            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Unlock className="h-5 w-5 text-gray-500" />
                        Apertura de Caja
                    </CardTitle>
                    <CardDescription>
                        Ingresa el efectivo inicial para comenzar el turno.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleOpen} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Efectivo Inicial ($)</Label>
                            <Input 
                                type="number" 
                                value={initialCash} 
                                onChange={e => setInitialCash(e.target.value)} 
                                placeholder="0.00" 
                                autoFocus
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={openShiftMutation.isPending}>
                             {openShiftMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Abrir Caja
                        </Button>
                    </form>
                </CardContent>
            </Card>
        )
    }

    // 2. CAJA ABIERTA (Show Metrics & Close Option)
    const theoreticalCash = (openShift.initial_cash || 0) + salesCash - expensesCash

    if (isClosing) {
        // Confirmation / Arqueo View
        const diff = (parseFloat(finalCash) || 0) - theoreticalCash

        return (
             <Card className="max-w-md mx-auto border-yellow-400 border-2">
                <CardHeader>
                    <CardTitle>Cierre de Caja (Arqueo)</CardTitle>
                    <CardDescription>Cuenta los billetes físicos e ingresa el total.</CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Teórico (Sistema):</span>
                            <span className="font-bold">${theoreticalCash.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Efectivo Real (Contado)</Label>
                        <Input 
                             type="number" 
                             value={finalCash} 
                             onChange={e => setFinalCash(e.target.value)} 
                             className="text-xl font-bold"
                             autoFocus
                        />
                    </div>
                    
                    {finalCash && (
                        <div className={`p-3 rounded text-center font-bold ${diff === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {diff === 0 ? "Perfecto (Diferencia $0)" : `Diferencia: ${diff > 0 ? '+' : ''}$${diff.toLocaleString()}`}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Notas (Opcional)</Label>
                        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: Faltan $100 por..." />
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setIsClosing(false)}>Cancelar</Button>
                        <Button className="flex-1" onClick={handleClose} disabled={closeShiftMutation.isPending}>
                            {closeShiftMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirmar Cierre
                        </Button>
                    </div>
                 </CardContent>
             </Card>
        )
    }

    return (
        <div className="space-y-6">
            <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5 text-green-600" />
                                Caja Abierta
                            </CardTitle>
                            <CardDescription>
                                Desde {format(new Date(openShift.opened_at), "HH:mm 'hs' - d 'de' MMMM", { locale: es })}
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="p-4 bg-secondary/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Inicio</p>
                        <p className="text-2xl font-bold">${openShift.initial_cash.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-green-100 text-green-800 rounded-lg">
                        <p className="text-sm">+ Ventas (Efectivo)</p>
                        <p className="text-2xl font-bold">${salesCash.toLocaleString()}</p>
                    </div>
                     <div className="p-4 bg-red-100 text-red-800 rounded-lg">
                        <p className="text-sm">- Gastos (Efectivo)</p>
                        <p className="text-2xl font-bold">${expensesCash.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-primary text-primary-foreground rounded-lg shadow-lg transform scale-105">
                        <p className="text-sm font-medium opacity-80">En Caja (Teórico)</p>
                        <p className="text-3xl font-bold">${theoreticalCash.toLocaleString()}</p>
                    </div>
                </CardContent>
                <CardFooter className="justify-end">
                    <Button variant="destructive" onClick={() => setIsClosing(true)}>
                        Cerrar Caja (Z)
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
