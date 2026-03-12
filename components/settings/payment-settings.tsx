"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { toast } from "sonner"
import { Loader2, Save, QrCode, Wallet, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

interface PaymentConfig {
  alias?: string
  cvu?: string
  holder_name?: string
  bank_name?: string
  mp_link?: string
  qr_source?: "alias" | "mp_link" | "cvu"
}

function buildQRText(config: PaymentConfig): string {
  if (config.qr_source === "mp_link" && config.mp_link) return config.mp_link
  if (config.qr_source === "cvu" && config.cvu) return config.cvu
  return config.alias || config.cvu || config.mp_link || ""
}

export function PaymentSettings() {
  const { currentKiosk } = useKiosk()
  const [config, setConfig] = useState<PaymentConfig>({
    alias: "",
    cvu: "",
    holder_name: "",
    bank_name: "",
    mp_link: "",
    qr_source: "alias",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState("")

  useEffect(() => {
    if (!currentKiosk?.id) return
    supabase
      .from("kiosks")
      .select("payment_config")
      .eq("id", currentKiosk.id)
      .single()
      .then(({ data }) => {
        if (data?.payment_config) {
          setConfig(data.payment_config as PaymentConfig)
        }
        setLoading(false)
      })
  }, [currentKiosk?.id])

  useEffect(() => {
    setPreview(buildQRText(config))
  }, [config])

  const updateField = (field: keyof PaymentConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!currentKiosk?.id) return
    setSaving(true)
    const { error } = await supabase
      .from("kiosks")
      .update({ payment_config: config })
      .eq("id", currentKiosk.id)
    if (error) {
      toast.error("Error al guardar: " + error.message)
    } else {
      toast.success("Configuración de pagos guardada ✓")
    }
    setSaving(false)
  }

  const qrUrl = preview
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(preview)}&margin=10`
    : null

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Datos Bancarios para Transferencias
          </CardTitle>
          <CardDescription>
            Estos datos aparecerán cuando el cliente elija pagar por transferencia en el POS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Titular y banco */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Titular de la cuenta</Label>
              <Input
                placeholder="Juan García"
                value={config.holder_name || ""}
                onChange={e => updateField("holder_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Banco</Label>
              <Input
                placeholder="Banco Galicia / Mercado Pago..."
                value={config.bank_name || ""}
                onChange={e => updateField("bank_name", e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Alias */}
          <div className="space-y-1.5">
            <Label>Alias CBU / CVU</Label>
            <Input
              placeholder="ej: kiosco.example.mp"
              value={config.alias || ""}
              onChange={e => updateField("alias", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              El alias que los clientes pueden usar para transferirte vía cualquier banco.
            </p>
          </div>

          {/* CVU */}
          <div className="space-y-1.5">
            <Label>CVU / CBU (número completo)</Label>
            <Input
              placeholder="0000003100010012345678"
              value={config.cvu || ""}
              onChange={e => updateField("cvu", e.target.value)}
              maxLength={22}
            />
          </div>

          {/* Link de Mercado Pago */}
          <div className="space-y-1.5">
            <Label>Link de pago de Mercado Pago (opcional)</Label>
            <Input
              placeholder="https://link.mercadopago.com.ar/tu-link"
              value={config.mp_link || ""}
              onChange={e => updateField("mp_link", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Si tenés un link de cobro personalizado de MP, los clientes pueden escanearlo directamente.{" "}
              <a href="https://www.mercadopago.com.ar/links" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
                Crear link <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          <Separator />

          {/* QR source selector */}
          <div className="space-y-1.5">
            <Label>¿Qué codificar en el QR?</Label>
            <Select
              value={config.qr_source || "alias"}
              onValueChange={v => updateField("qr_source", v)}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alias">Alias (recomendado)</SelectItem>
                <SelectItem value="cvu">CVU / CBU</SelectItem>
                <SelectItem value="mp_link">Link de Mercado Pago</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El cliente escanea el QR y su app bancaria / MP lo redirige al pago.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Vista Previa del Panel de Cobro
          </CardTitle>
          <CardDescription>Así va a verse en el POS cuando el cajero seleccione Transferencia.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-muted/30 p-5 flex flex-col sm:flex-row gap-6 items-center">
            {qrUrl ? (
              <div className="shrink-0 bg-white rounded-xl p-2 shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR de pago" width={160} height={160} className="rounded" />
              </div>
            ) : (
              <div className="h-[160px] w-[160px] rounded-xl border-2 border-dashed flex items-center justify-center text-muted-foreground">
                <QrCode className="h-10 w-10 opacity-30" />
              </div>
            )}
            <div className="space-y-2 text-sm flex-1">
              <p className="font-semibold text-base">Pago por Transferencia</p>
              {config.alias && (
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Alias</span>
                  <p className="font-mono font-bold">{config.alias}</p>
                </div>
              )}
              {config.cvu && (
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">CVU</span>
                  <p className="font-mono text-sm">{config.cvu}</p>
                </div>
              )}
              {config.holder_name && (
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Titular</span>
                  <p className="font-medium">{config.holder_name}</p>
                </div>
              )}
              {config.bank_name && (
                <p className="text-muted-foreground">{config.bank_name}</p>
              )}
              {!config.alias && !config.cvu && !config.mp_link && (
                <p className="text-muted-foreground italic">Completá los datos para ver la preview.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar Configuración
      </Button>
    </div>
  )
}
