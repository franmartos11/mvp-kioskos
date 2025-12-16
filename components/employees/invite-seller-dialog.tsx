"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, UserPlus, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { useSubscription } from "@/hooks/use-subscription"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"
import { ShieldAlert } from "lucide-react"

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

  const { plan, isEnterprise } = useSubscription()
  const [employeeCount, setEmployeeCount] = useState(0)
  const [limitReached, setLimitReached] = useState(false)

  // Check limits
  const router = useRouter()

  if (!currentKiosk || currentKiosk.role !== 'owner') {
      return null
  }

  // Fetch count when opening
  // We can use a simple effect.
  // Note: Open state is local, so we depend on `open` if we had access, but here open is inside component?
  // Ah, `open` is state.
  
  // We need to fetch count of sellers for this user/kiosk owner.
  // The 'kiosks' prop contains all kiosks where user is owner.
  // So we count members in these kiosks.
  
  // Wait, useEffect should run when dialog opens. 
  // Let's rely on checking when the component mounts or when `open` changes.
  
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
  
  // Monitor open state changes? or just fetch once?
  // Ideally we use text of button to show "Limit Reached" or disable it?
  // Or show Alert inside content.
  
  // Since `open` is controlled locally, we can hook into onOpenChange or just run effect.
  if (open && !limitReached && !isEnterprise) {
      checkLimit()
  }

  const handleSearch = async () => {
    if (!email) return
    setLoading(true)
    setFoundUser(null)

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email.trim())
            .single()

        if (error || !data) {
            toast.error("Usuario no encontrado")
        } else {
            setFoundUser(data)
            toast.success("Usuario encontrado: " + (data.full_name || data.email))
        }
    } catch (e) {
        toast.error("Error al buscar usuario")
    } finally {
        setLoading(false)
    }
  }

  const handleInvite = async () => {
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
          // Proceed to check/create employee record anyway?
      }

      // 2. Add Employee Details (Rate)
      // Check if exists first? Or upsert.
      const { error: empError } = await supabase
        .from('employees')
        .upsert({
            kiosk_id: kioskId,
            user_id: foundUser.id,
            hourly_rate: parseFloat(hourlyRate) || 0
        }, { onConflict: 'kiosk_id, user_id' })

      if (empError) throw empError

      toast.success("Vendedor agregado correctamente")
      setOpen(false)
      setEmail("")
      setHourlyRate("")
      setFoundUser(null)
      
      router.refresh()
      if (onAdded) onAdded()
      
    } catch (error: any) {
      console.error(error)
      toast.error("Error al agregar vendedor: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                        onChange={e => setEmail(e.target.value)}
                        placeholder="email@ejemplo.com"
                    />
                    <Button onClick={handleSearch} disabled={loading || !email} size="icon">
                        <Search className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {foundUser && (
                <div className="p-3 bg-muted rounded-md text-sm">
                    <p className="font-medium">{foundUser.full_name || "Sin nombre"}</p>
                    <p className="text-muted-foreground">{foundUser.email}</p>
                </div>
            )}

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

            <Button onClick={handleInvite} className="w-full" disabled={loading || !foundUser}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar y Agregar
            </Button>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
