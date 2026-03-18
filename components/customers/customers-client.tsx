"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { 
  Plus, Search, Users, CreditCard, TrendingDown, Phone, 
  Mail, ArrowDownLeft, ArrowUpRight, Loader2, History
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency } from "@/lib/utils"

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
  customer_debt: { balance: number, credit_limit: number | null }[] | null
}

interface DebtMovement {
  id: string
  type: "charge" | "payment"
  amount: number
  notes: string | null
  created_at: string
  sale_id: string | null
}

// ─── Create / Edit Customer Dialog ───────────────────────────────────────────
function CustomerFormDialog({
  open, onOpenChange, kioskId, customer, onSuccess
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  kioskId: string
  customer?: Customer | null
  onSuccess: () => void
}) {
  const [name, setName] = useState(customer?.name || "")
  const [phone, setPhone] = useState(customer?.phone || "")
  const [email, setEmail] = useState(customer?.email || "")
  const [notes, setNotes] = useState(customer?.notes || "")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setName(customer?.name || "")
    setPhone(customer?.phone || "")
    setEmail(customer?.email || "")
    setNotes(customer?.notes || "")
  }, [customer])

  const handleSave = async () => {
    if (!name.trim()) return toast.error("El nombre es obligatorio")
    setLoading(true)
    try {
      const payload = { kiosk_id: kioskId, name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, notes: notes.trim() || null }
      if (customer) {
        const { error } = await supabase.from("customers").update(payload).eq("id", customer.id)
        if (error) throw error
        toast.success("Cliente actualizado")
      } else {
        const { error } = await supabase.from("customers").insert(payload)
        if (error) throw error
        toast.success("Cliente creado")
      }
      onSuccess()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || "Error al guardar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            {customer ? "Modificá los datos del cliente." : "Completá los datos del nuevo cliente."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="c-name">Nombre <span className="text-red-500">*</span></Label>
            <Input id="c-name" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Juan García" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="c-phone">Teléfono</Label>
              <Input id="c-phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 9 11..." />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-email">Email</Label>
              <Input id="c-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="juan@email.com" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="c-notes">Notas</Label>
            <Textarea id="c-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones opcionales..." rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {customer ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Payment Dialog ───────────────────────────────────────────────────────────
function PaymentDialog({
  open, onOpenChange, customer, kioskId, userId, onSuccess
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  customer: Customer | null
  kioskId: string
  userId: string
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const balance = customer?.customer_debt?.[0]?.balance ?? 0

  const handlePay = async () => {
    const num = parseFloat(amount)
    if (!num || num <= 0) return toast.error("Ingresá un monto válido")
    setLoading(true)
    try {
      const { error } = await supabase.rpc("record_debt_payment", {
        p_kiosk_id: kioskId,
        p_customer_id: customer!.id,
        p_amount: num,
        p_notes: notes.trim() || null,
        p_user_id: userId,
      })
      if (error) throw error
      toast.success(`Pago de ${formatCurrency(num)} registrado`)
      setAmount("")
      setNotes("")
      onSuccess()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pago — {customer?.name}</DialogTitle>
          <DialogDescription>
            Deuda actual: <strong className="text-red-600">{formatCurrency(balance)}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Monto a abonar</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="text-lg font-mono"
            />
            {balance > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setAmount(balance.toFixed(2))}
              >
                Pagar deuda completa ({formatCurrency(balance)})
              </button>
            )}
          </div>
          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: abonó en efectivo" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handlePay} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <ArrowDownLeft className="h-4 w-4" /> Registrar Pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── History Dialog ───────────────────────────────────────────────────────────
function HistoryDialog({ open, onOpenChange, customer }: {
  open: boolean; onOpenChange: (v: boolean) => void; customer: Customer | null;
}) {
  const [movements, setMovements] = useState<DebtMovement[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !customer) return
    setLoading(true)
    supabase
      .from("customer_debt_movements")
      .select("*")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMovements((data || []) as DebtMovement[])
        setLoading(false)
      })
  }, [open, customer])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial — {customer?.name}</DialogTitle>
          <DialogDescription>Últimos 50 movimientos de cuenta corriente</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {loading && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {!loading && movements.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">Sin movimientos registrados</p>
          )}
          {movements.map(m => (
            <div key={m.id} className={`flex items-center justify-between p-3 rounded-lg border ${m.type === 'charge' ? 'border-red-100 bg-red-50/50' : 'border-green-100 bg-green-50/50'}`}>
              <div className="flex items-center gap-2">
                {m.type === 'charge'
                  ? <ArrowUpRight className="h-4 w-4 text-red-500" />
                  : <ArrowDownLeft className="h-4 w-4 text-green-600" />}
                <div>
                  <p className="text-sm font-medium">{m.type === 'charge' ? 'Venta a fiado' : 'Pago'}</p>
                  {m.notes && <p className="text-xs text-muted-foreground">{m.notes}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold text-sm ${m.type === 'charge' ? 'text-red-600' : 'text-green-600'}`}>
                  {m.type === 'charge' ? '+' : '-'}{formatCurrency(m.amount)}
                </p>
                <p className="text-xs text-muted-foreground">{format(new Date(m.created_at), "d MMM HH:mm", { locale: es })}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CustomersClient() {
  const { currentKiosk } = useKiosk()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [userId, setUserId] = useState("")

  // Dialog states
  const [formOpen, setFormOpen] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [payCustomer, setPayCustomer] = useState<Customer | null>(null)
  const [histOpen, setHistOpen] = useState(false)
  const [histCustomer, setHistCustomer] = useState<Customer | null>(null)

  const fetchCustomers = useCallback(async () => {
    if (!currentKiosk) return
    setLoading(true)
    const { data } = await supabase
      .from("customers")
      .select("*, customer_debt(balance, credit_limit)")
      .eq("kiosk_id", currentKiosk.id)
      .order("name")
    setCustomers((data || []) as Customer[])
    setLoading(false)
  }, [currentKiosk])

  useEffect(() => {
    fetchCustomers()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id)
    })
  }, [fetchCustomers])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  const totalDebt = customers.reduce((sum, c) => sum + (c.customer_debt?.[0]?.balance ?? 0), 0)
  const debtors = customers.filter(c => (c.customer_debt?.[0]?.balance ?? 0) > 0).length

  if (!currentKiosk) {
    return (
      <div className="flex justify-center py-12 text-muted-foreground">
        Seleccioná un kiosco para ver los clientes.
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gestioná clientes y cuenta corriente.</p>
        </div>
        <Button className="gap-2" onClick={() => { setEditCustomer(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-full"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{customers.length}</p>
              <p className="text-xs text-muted-foreground">Clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="bg-red-100 p-2 rounded-full"><TrendingDown className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
              <p className="text-xs text-muted-foreground">Deuda Total Pendiente</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-full"><CreditCard className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{debtors}</p>
              <p className="text-xs text-muted-foreground">Clientes con deuda</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/20">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border-0 bg-transparent focus-visible:ring-0 h-8"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>{filtered.length} cliente{filtered.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Deuda</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2 className="animate-spin h-5 w-5 mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    {search ? "Sin resultados para la búsqueda." : "Aún no hay clientes. Creá el primero."}
                  </TableCell>
                </TableRow>
              ) : filtered.map(c => {
                const debt = c.customer_debt?.[0]?.balance ?? 0
                return (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50"
                    onClick={() => { setEditCustomer(c); setFormOpen(true) }}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                        {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                        {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {debt > 0
                        ? <Badge variant="destructive">{formatCurrency(debt)}</Badge>
                        : <Badge variant="secondary" className="text-green-700 bg-green-100">Al día</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                          size="sm" variant="outline" className="gap-1 text-xs"
                          onClick={() => { setHistCustomer(c); setHistOpen(true) }}
                          title="Historial"
                        >
                          <History className="h-3 w-3" />
                        </Button>
                        {debt > 0 && (
                          <Button
                            size="sm" className="gap-1 text-xs bg-green-600 hover:bg-green-700"
                            onClick={() => { setPayCustomer(c); setPayOpen(true) }}
                          >
                            <ArrowDownLeft className="h-3 w-3" /> Pago
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        kioskId={currentKiosk.id}
        customer={editCustomer}
        onSuccess={fetchCustomers}
      />
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        customer={payCustomer}
        kioskId={currentKiosk.id}
        userId={userId}
        onSuccess={fetchCustomers}
      />
      <HistoryDialog
        open={histOpen}
        onOpenChange={setHistOpen}
        customer={histCustomer}
      />
    </div>
  )
}
