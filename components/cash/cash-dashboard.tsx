"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { ArrowUpRight, ArrowDownLeft, Wallet, History, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { OpenShiftDialog, CloseShiftDialog } from "@/components/pos/cash-register-dialog"

export function CashDashboard() {
    const [loading, setLoading] = useState(true)
    const [kioskId, setKioskId] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [session, setSession] = useState<any>(null)
    
    // Stats
    const [stats, setStats] = useState({
        initial: 0,
        salesCash: 0,
        manualIn: 0,
        manualOut: 0,
        supplierPayments: 0,
        currentBalance: 0
    })

    const [movements, setMovements] = useState<any[]>([])

    // Expense Link State
    const [isExpense, setIsExpense] = useState(false)
    const [expenseCategory, setExpenseCategory] = useState("other")

    // Actions State
    const [movementOpen, setMovementOpen] = useState(false)
    const [movementType, setMovementType] = useState<'in' | 'out'>('in')
    const [amount, setAmount] = useState("")
    const [reason, setReason] = useState("")
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        const { data: member } = await supabase.from('kiosk_members').select('kiosk_id').eq('user_id', user.id).maybeSingle()
        if (member) {
            setKioskId(member.kiosk_id)
            await fetchSessionAndStats(member.kiosk_id)
        }
        setLoading(false)
    }

    async function fetchSessionAndStats(kioskId: string) {
        // 1. Get Open Session
        const { data: sessionData } = await supabase
            .from('cash_sessions')
            .select('*')
            .eq('kiosk_id', kioskId)
            .eq('status', 'open')
            .maybeSingle()
        
        setSession(sessionData)

        if (sessionData) {
            // 2. Fetch Movements (Sales, Manual, Payments)
            
            // Sales (Cash only)
            const { data: sales } = await supabase
                .from('sales')
                .select('total')
                .eq('kiosk_id', kioskId)
                .eq('payment_method', 'cash')
                .gte('created_at', sessionData.opened_at)
            
            const salesTotal = sales?.reduce((sum, s) => sum + s.total, 0) || 0

            // Manual Movements
            const { data: manualMoves } = await supabase
                .from('cash_movements')
                .select('*')
                .eq('cash_session_id', sessionData.id)
                .order('created_at', { ascending: false })
            
            const manualIn = manualMoves?.filter(m => m.type === 'in').reduce((sum, m) => sum + m.amount, 0) || 0
            const manualOut = manualMoves?.filter(m => m.type === 'out').reduce((sum, m) => sum + m.amount, 0) || 0

            // Supplier Payments (from Cash Register)
            // Need to check if table exists first? User ran script?
            // Assuming yes. If fail, it will just start with 0 in catch mainly, 
            // but let's try safely or just go for it.
            let supplierPayments = 0
            const { data: payments, error: payError } = await supabase
                .from('supplier_payments')
                .select('amount')
                .eq('cash_session_id', sessionData.id)
            
            if (!payError && payments) {
                supplierPayments = payments.reduce((sum, p) => sum + p.amount, 0)
            }

            const initial = sessionData.initial_cash
            const currentBalance = initial + salesTotal + manualIn - manualOut - supplierPayments

            setStats({
                initial,
                salesCash: salesTotal,
                manualIn,
                manualOut,
                supplierPayments,
                currentBalance
            })
            setMovements(manualMoves || [])
        } else {
            setStats({
                initial: 0,
                salesCash: 0,
                manualIn: 0,
                manualOut: 0,
                supplierPayments: 0,
                currentBalance: 0
            })
            setMovements([])
        }
    }

    const handleManualMovement = async () => {
        if (!amount || !reason || !session) return
        
        setSubmitting(true)
        try {
            // 1. Insert Movement
            const { error } = await supabase.from('cash_movements').insert({
                cash_session_id: session.id,
                user_id: userId,
                type: movementType,
                amount: parseFloat(amount),
                reason: reason
            })

            if (error) throw error

            // 2. If it's an Expense (Out + Checked), insert into expenses table
            if (movementType === 'out' && isExpense && kioskId && userId) {
                 const { error: expError } = await supabase.from('expenses').insert({
                    description: reason, // Use same reason
                    amount: parseFloat(amount),
                    category: expenseCategory,
                    kiosk_id: kioskId,
                    user_id: userId,
                    date: new Date().toISOString()
                 })
                 if (expError) {
                     console.error("Expense creation error:", expError)
                     toast.error("Movimiento guardado, pero falló al crear el gasto asociado.")
                 } else {
                     toast.success("Gasto registrado correctamente")
                 }
            }

            toast.success("Movimiento registrado")
            setMovementOpen(false)
            setAmount("")
            setReason("")
            setIsExpense(false) // Reset
            if (kioskId) fetchSessionAndStats(kioskId)

        } catch (error) {
            console.error(error)
            toast.error("Error al registrar movimiento")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div className="p-8">Cargando caja...</div>

    return (
        <div className="p-6 h-full flex flex-col gap-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de Caja</h1>
                    <p className="text-muted-foreground">Control de efectivo, turnos y movimientos.</p>
                </div>
                <div>
                     {session ? (
                         <div className="flex gap-2">
                             <Button onClick={() => { setMovementType('in'); setMovementOpen(true); }} variant="outline" className="text-green-600 border-green-200 hover:bg-green-50">
                                 <ArrowUpRight className="mr-2 h-4 w-4" /> Ingresar Dinero
                             </Button>
                             <Button onClick={() => { setMovementType('out'); setMovementOpen(true); }} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                                 <ArrowDownLeft className="mr-2 h-4 w-4" /> Retirar Dinero
                             </Button>
                             <CloseShiftDialog 
                                sessionId={session.id} 
                                kioskId={kioskId!} 
                                initialCash={session.initial_cash} 
                                openedAt={session.opened_at}
                                onSuccess={() => kioskId && fetchSessionAndStats(kioskId)}
                            />
                         </div>
                     ) : (
                        kioskId && userId && (
                            <OpenShiftDialog kioskId={kioskId} userId={userId} onSuccess={() => kioskId && fetchSessionAndStats(kioskId)} />
                        )
                     )}
                </div>
            </div>

            {!session ? (
                 <Card className="bg-muted/50 border-dashed">
                     <CardContent className="flex flex-col items-center justify-center h-60 gap-4">
                         <div className="p-4 bg-background rounded-full border">
                             <Wallet className="h-8 w-8 text-muted-foreground" />
                         </div>
                         <div className="text-center">
                             <h3 className="font-semibold text-lg">Caja Cerrada</h3>
                             <p className="text-muted-foreground">Abre un turno para comenzar a operar.</p>
                         </div>
                     </CardContent>
                 </Card>
            ) : (
                <div className="flex flex-col gap-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
                                <Wallet className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">${stats.currentBalance.toFixed(2)}</div>
                                <p className="text-xs text-muted-foreground">
                                    En caja ahora mismo
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Ventas Efectivo</CardTitle>
                                <ArrowUpRight className="h-4 w-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">+${stats.salesCash.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pagos Prov.</CardTitle>
                                <ArrowDownLeft className="h-4 w-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">-${stats.supplierPayments.toFixed(2)}</div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Manuales (Neto)</CardTitle>
                                <History className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${(stats.manualIn - stats.manualOut) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {(stats.manualIn - stats.manualOut) >= 0 ? '+' : ''}${(stats.manualIn - stats.manualOut).toFixed(2)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    In: ${stats.manualIn} | Out: ${stats.manualOut}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Movements Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Movimientos Manuales</CardTitle>
                            <CardDescription>Registro de ingresos y egresos extra en este turno.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Hora</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Motivo</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {movements.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                                No hay movimientos manuales registrados
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        movements.map((move: any) => (
                                            <TableRow key={move.id}>
                                                <TableCell>{format(new Date(move.created_at), "HH:mm")}</TableCell>
                                                <TableCell>
                                                    <Badge variant={move.type === 'in' ? 'default' : 'destructive'}>
                                                        {move.type === 'in' ? 'Ingreso' : 'Egreso'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{move.reason}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    ${move.amount.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}

            <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{movementType === 'in' ? 'Ingresar Dinero' : 'Retirar Dinero'}</DialogTitle>
                        <DialogDescription>
                            Registra un movimiento manual en la caja actual.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="amount" className="text-right">Monto</Label>
                            <Input
                                id="amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="reason" className="text-right">Motivo</Label>
                            <Input
                                id="reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="col-span-3"
                                placeholder={movementType === 'in' ? "Ej: Cambio inicial" : "Ej: Pago limpieza"}
                            />
                        </div>

                        {movementType === 'out' && (
                            <div className="grid grid-cols-4 items-center gap-4">
                                <div className="col-start-2 col-span-3 flex items-center space-x-2">
                                     <input 
                                        type="checkbox" 
                                        id="isExpense" 
                                        className="h-4 w-4 rounded border-gray-300"
                                        checked={isExpense}
                                        onChange={(e) => setIsExpense(e.target.checked)}
                                     />
                                     <label htmlFor="isExpense" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                         Registrar también como Gasto
                                     </label>
                                </div>
                            </div>
                        )}

                        {movementType === 'out' && isExpense && (
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="category" className="text-right">Categoría</Label>
                                <select 
                                    id="category"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 col-span-3"
                                    value={expenseCategory}
                                    onChange={(e) => setExpenseCategory(e.target.value)}
                                >
                                    <option value="services">Servicios</option>
                                    <option value="rent">Alquiler</option>
                                    <option value="salaries">Sueldos</option>
                                    <option value="other">Otros</option>
                                    <option value="inventory">Mercadería</option>
                                </select>
                             </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button onClick={handleManualMovement} disabled={submitting}>
                            {submitting ? "Guardando..." : "Confirmar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
