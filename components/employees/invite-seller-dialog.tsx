"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, UserPlus, Search, Mail, Copy, Check, KeyRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { useSubscription } from "@/hooks/use-subscription"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { inviteUser } from "@/app/actions/invitations"

interface Kiosk {
  id: string
  name: string
}

interface InviteSellerDialogProps {
  kiosks: Kiosk[]
  onAdded?: () => void
}

export function InviteSellerDialog({ kiosks, onAdded }: InviteSellerDialogProps) {
  const { currentKiosk } = useKiosk()
  
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [email, setEmail] = useState("")
  const [kioskId, setKioskId] = useState(kiosks[0]?.id || "")
  const [hourlyRate, setHourlyRate] = useState("")
  const [foundUser, setFoundUser] = useState<any>(null)
  const [searchAttempted, setSearchAttempted] = useState(false)

  const { plan, isEnterprise } = useSubscription()
  const [employeeCount, setEmployeeCount] = useState(0)
  const [limitReached, setLimitReached] = useState(false)

  // Check limits
  const router = useRouter()

  if (!currentKiosk || currentKiosk.role !== 'owner') {
      return null
  }

  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const checkLimit = async () => {
    if (isEnterprise) return // Unlimited

    // Fetch all members with role 'seller' in my kiosks
    const kioskIds = kiosks.map(k => k.id)
    if (kioskIds.length === 0) return

    const { count } = await supabase
        .from('kiosk_members')
        .select('*', { count: 'exact', head: true })
        .in('kiosk_id', kioskIds)
        .eq('role', 'seller')
    
    setEmployeeCount(count || 0)

    const limit = plan === 'free' ? 0 : 2 // Free: 0, Pro: 2
    
    if ((count || 0) >= limit) {
        setLimitReached(true)
    } else {
        setLimitReached(false)
    }
  }
  
  if (open && !limitReached && !isEnterprise) {
      checkLimit()
  }

  const handleSearch = async () => {
    if (!email) return
    setLoading(true)
    setFoundUser(null)
    setSearchAttempted(false)

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email.trim())
            .single()

        setSearchAttempted(true)

        // Treat profiles without a name as ghost/incomplete accounts → show invite flow
        if (error || !data || !data.full_name) {
            setFoundUser(null)
            if (!error && data && !data.full_name) {
                toast.info("El correo existe pero la cuenta no está configurada. Podés invitarlo igualmente.")
            }
        } else {
            setFoundUser(data)
            toast.success("Usuario encontrado: " + data.full_name)
        }
    } catch (e) {
        toast.error("Error al buscar usuario")
    } finally {
        setLoading(false)
    }
  }

  const handleAddExistingUser = async () => {
    if (!foundUser || !kioskId) return
    setLoading(true)

    try {
      // 1. Add to Kiosk Members
      const { error: memberError } = await supabase
        .from('kiosk_members')
        .insert({
            user_id: foundUser.id,
            kiosk_id: kioskId,
            role: 'seller'
        })
      
      if (memberError) {
          if (memberError.code === '23505') { // Unique violation
              toast.error("Este usuario ya es miembro del kiosco.")
          } else {
              throw memberError
          }
      }

      // 2. Add Employee Details (Rate)
      const { error: empError } = await supabase
        .from('employees')
        .upsert({
            kiosk_id: kioskId,
            user_id: foundUser.id,
            hourly_rate: parseFloat(hourlyRate) || 0
        }, { onConflict: 'kiosk_id, user_id' })

      if (empError) throw empError

      toast.success("Vendedor agregado correctamente")
      resetAndClose()
    } catch (error: any) {
      console.error(error)
      toast.error("Error al agregar vendedor: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendInvite = async () => {
    if (!email || !kioskId) return
    setLoading(true)

    try {
        const res = await inviteUser(kioskId, email.trim(), 'seller')
        if (res.success && res.inviteCode) {
            toast.success("Invitación enviada correctamente")
            setGeneratedCode(res.inviteCode)
            // Do NOT resetAndClose immediately — let the user copy the code
        } else {
            toast.error(res.error || "Error al enviar la invitación")
        }
    } catch (error: any) {
        toast.error("Error al enviar la invitación: " + error.message)
    } finally {
        setLoading(false)
    }
  }

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode).then(() => {
        setCopied(true)
        toast.success("Código copiado al portapapeles")
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const resetAndClose = () => {
      setOpen(false)
      setEmail("")
      setHourlyRate("")
      setFoundUser(null)
      setSearchAttempted(false)
      setGeneratedCode(null)
      setCopied(false)
      router.refresh()
      if (onAdded) onAdded()
  }

  return (
    <Dialog open={open} onOpenChange={(val) => {
        setOpen(val)
        if (!val) {
            setEmail("")
            setFoundUser(null)
            setSearchAttempted(false)
        }
    }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Agregar Vendedor
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar Vendedor / Empleado</DialogTitle>
        </DialogHeader>

        {limitReached && !isEnterprise ? (
             <div className="space-y-4 py-4">
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Límite de Empleados Alcanzado</AlertTitle>
                    <AlertDescription>
                        Tu plan actual ({plan}) permite {plan === 'free' ? '0' : '2'} empleados.
                        Tienes {employeeCount} registrados.
                    </AlertDescription>
                </Alert>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Link href="/settings">
                        <Button>Mejorar Plan</Button>
                    </Link>
                </div>
            </div>
        ) : generatedCode ? (
            <div className="space-y-6 py-4 animate-in fade-in zoom-in duration-300">
                <div className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                        <Check className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold">Invitación Enviada</h3>
                    <p className="text-sm text-muted-foreground">
                        Se envió un correo a <strong>{email}</strong> con un enlace para unirse.
                    </p>
                </div>

                <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
                    <Label className="text-xs text-muted-foreground uppercase flex items-center justify-center gap-1.5 font-bold mb-2">
                        <KeyRound className="h-3.5 w-3.5" />
                        O compartí este código:
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            readOnly
                            value={generatedCode}
                            className="font-mono text-center text-xl tracking-widest uppercase bg-transparent border-primary/20 text-primary font-bold"
                        />
                        <Button
                            variant="default"
                            size="icon"
                            onClick={handleCopyCode}
                            className="shrink-0 w-10"
                        >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                        El vendedor puede usar este código al registrarse o iniciar sesión.
                    </p>
                </div>

                <Button className="w-full" onClick={resetAndClose}>
                    Cerrar
                </Button>
            </div>
        ) : (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Kiosco</Label>
                <Select value={kioskId} onValueChange={setKioskId}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {kiosks.map(k => (
                            <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Buscar Usuario por Email</Label>
                <div className="flex gap-2">
                    <Input 
                        value={email}
                        onChange={e => {
                            setEmail(e.target.value)
                            setSearchAttempted(false)
                            setFoundUser(null)
                        }}
                        placeholder="email@ejemplo.com"
                    />
                    <Button onClick={handleSearch} disabled={loading || !email} size="icon">
                        <Search className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {searchAttempted && !foundUser && (
                <div className="p-4 bg-blue-50 text-blue-900 rounded-md border border-blue-200">
                    <p className="text-sm font-medium mb-1">📧 Invitar por email</p>
                    <p className="text-sm mb-3">Se le enviará un correo a <strong>{email}</strong> con un enlace para unirse al kiosco. Si no tiene cuenta, podrá crear una gratuitamente.</p>
                    <Button 
                        onClick={handleSendInvite} 
                        disabled={loading} 
                        variant="default" 
                        size="sm"
                        className="w-full gap-2"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        Enviar Invitación
                    </Button>
                </div>
            )}

            {searchAttempted && foundUser && (
                <>
                    <div className="p-3 bg-muted rounded-md text-sm border">
                        <p className="font-medium text-green-700 mb-1">✓ Cuenta encontrada</p>
                        <p className="font-semibold">{foundUser.full_name || "Sin nombre"}</p>
                        <p className="text-muted-foreground">{foundUser.email}</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Valor Hora ($)</Label>
                        <Input 
                            type="number"
                            step="0.01"
                            value={hourlyRate}
                            onChange={e => setHourlyRate(e.target.value)}
                            placeholder="0.00"
                        />
                    </div>

                    <Button onClick={handleAddExistingUser} className="w-full" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Agregar Vendedor
                    </Button>
                </>
            )}
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

