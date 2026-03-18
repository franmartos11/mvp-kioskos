"use client"

import { useState, useEffect } from "react"
import { CartItem, PaymentMethod } from "@/types/pos"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Loader2, UserPlus, QrCode, Copy, CheckCheck } from "lucide-react"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface PaymentConfig {
  alias?: string
  cvu?: string
  holder_name?: string
  bank_name?: string
  mp_link?: string
  qr_source?: "alias" | "mp_link" | "cvu"
}

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  onConfirm: (method: PaymentMethod, customerName?: string, customerId?: string | null) => Promise<void>
}

function buildQRText(config: PaymentConfig): string {
  if (config.qr_source === "mp_link" && config.mp_link) return config.mp_link
  if (config.qr_source === "cvu" && config.cvu) return config.cvu
  return config.alias || config.cvu || config.mp_link || ""
}

export function CheckoutDialog({ open, onOpenChange, items, onConfirm }: CheckoutDialogProps) {
  const { currentKiosk } = useKiosk()
  const [method, setMethod] = useState<PaymentMethod>("cash")
  const [loading, setLoading] = useState(false)
  const [customerName, setCustomerName] = useState("")
  const [customers, setCustomers] = useState<{id: string, name: string, balance: number}[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null)
  const [copied, setCopied] = useState<"alias" | "cvu" | null>(null)

  useEffect(() => {
    if (open && currentKiosk) {
      // Load customers for fiado
      supabase
        .from("customers")
        .select("id, name, customer_debt(balance)")
        .eq("kiosk_id", currentKiosk.id)
        .order("name")
        .then(({ data }) => {
          setCustomers((data || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            balance: c.customer_debt?.[0]?.balance ?? 0
          })))
        })

      // Load payment config for transfer QR
      supabase
        .from("kiosks")
        .select("payment_config")
        .eq("id", currentKiosk.id)
        .single()
        .then(({ data }) => {
          if (data?.payment_config) {
            setPaymentConfig(data.payment_config as PaymentConfig)
          }
        })
    }
    if (!open) {
      setMethod("cash")
      setSelectedCustomerId("")
      setCustomerName("")
    }
  }, [open, currentKiosk])

  const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)

  async function handleConfirm() {
    if (method === 'fiado' && !selectedCustomerId) return
    try {
      setLoading(true)
      await onConfirm(
        method,
        method === 'transfer' ? customerName : undefined,
        method === 'fiado' ? selectedCustomerId : null
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (field: "alias" | "cvu") => {
    const text = field === "alias" ? paymentConfig?.alias : paymentConfig?.cvu
    if (text) {
      navigator.clipboard.writeText(text)
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
    }
  }

  const qrText = paymentConfig ? buildQRText(paymentConfig) : ""
  const qrUrl = qrText
    ? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrText)}&margin=8`
    : null
  const hasPaymentConfig = !!(paymentConfig?.alias || paymentConfig?.cvu || paymentConfig?.mp_link)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Confirmar Venta</DialogTitle>
          <DialogDescription>Resumen de la transacción</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Total */}
          <div className="flex justify-between items-center text-xl font-bold bg-muted/40 rounded-lg px-4 py-3">
            <span>Total a Pagar</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>

          {/* Method selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Método de Pago</label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">💵 Efectivo</SelectItem>
                <SelectItem value="card">💳 Tarjeta</SelectItem>
                <SelectItem value="transfer">📱 Transferencia</SelectItem>
                <SelectItem value="fiado">📋 Fiado / Cuenta Corriente</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── TRANSFER: QR Panel ─────────────────────────────────────────── */}
          {method === 'transfer' && (
            <div className="animate-in fade-in slide-in-from-top-2 space-y-3">
              {hasPaymentConfig ? (
                <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 p-4">
                  <div className="flex gap-4 items-center">
                    {/* QR */}
                    {qrUrl ? (
                      <div className="shrink-0 bg-white rounded-lg p-1.5 shadow-sm border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrUrl} alt="QR de pago" width={100} height={100} className="rounded" />
                      </div>
                    ) : (
                      <div className="h-[100px] w-[100px] shrink-0 rounded-lg border-2 border-dashed flex items-center justify-center">
                        <QrCode className="h-8 w-8 text-muted-foreground opacity-40" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-2 text-sm">
                      <p className="font-semibold text-blue-800 dark:text-blue-300">
                        📱 Escanear para pagar
                      </p>
                      {paymentConfig?.alias && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">Alias</span>
                            <span className="font-mono font-bold text-sm truncate block">{paymentConfig.alias}</span>
                          </div>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                            onClick={() => handleCopy("alias")}
                          >
                            {copied === "alias" ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      )}
                      {paymentConfig?.cvu && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">CVU</span>
                            <span className="font-mono text-xs truncate block">{paymentConfig.cvu}</span>
                          </div>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                            onClick={() => handleCopy("cvu")}
                          >
                            {copied === "cvu" ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      )}
                      {paymentConfig?.holder_name && (
                        <p className="text-xs text-muted-foreground">
                          {paymentConfig.holder_name}{paymentConfig.bank_name ? ` · ${paymentConfig.bank_name}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
                  <QrCode className="h-6 w-6 mx-auto mb-1 opacity-30" />
                  <p>No configuraste datos bancarios aún.</p>
                  <Link href="/settings?tab=payments" className="text-primary underline text-xs" onClick={() => onOpenChange(false)}>
                    Configurar en Ajustes →
                  </Link>
                </div>
              )}

              {/* Optional: name of who transferred */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Nombre del cliente (opcional)</label>
                <Input
                  placeholder="Ej: Juan Pérez"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── FIADO: Customer selector ───────────────────────────────────── */}
          {method === 'fiado' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 p-3 bg-orange-50 border border-orange-200 dark:bg-orange-900/10 dark:border-orange-800 rounded-md">
              <label className="text-sm font-medium text-orange-800 dark:text-orange-300">Cliente (deuda a su nombre)</label>
              {customers.length === 0 ? (
                <div className="text-xs text-orange-700 space-y-1">
                  <p>No tenés clientes registrados.</p>
                  <Link href="/customers" className="underline font-semibold flex items-center gap-1" onClick={() => onOpenChange(false)}>
                    <UserPlus className="h-3 w-3" /> Crear un cliente
                  </Link>
                </div>
              ) : (
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.balance > 0 ? ` — Debe ${formatCurrency(c.balance)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || (method === 'fiado' && !selectedCustomerId)}
            className={method === 'transfer' ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {method === 'fiado'     ? 'Registrar Fiado' :
             method === 'transfer' ? '✓ Confirmar pago recibido' :
             'Confirmar Cobro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
