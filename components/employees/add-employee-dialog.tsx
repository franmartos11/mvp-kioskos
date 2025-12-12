"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"

interface Kiosk {
  id: string
  name: string
}

interface AddEmployeeDialogProps {
  kiosks: Kiosk[]
  userId: string
  onAdded?: () => void
}

export function AddEmployeeDialog({ kiosks, userId, onAdded }: AddEmployeeDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [kioskId, setKioskId] = useState(kiosks[0]?.id || "")
  
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!kioskId) {
      toast.error("Debes seleccionar un Kiosco")
      return
    }
    
    setLoading(true)

    try {
      const { error } = await supabase
        .from('employees')
        .insert({
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            hourly_rate: parseFloat(hourlyRate) || 0,
            kiosk_id: kioskId,
            user_id: userId
        })

      if (error) throw error

      toast.success("Empleado registrado correctamente")
      setOpen(false)
      // Reset form
      setFirstName("")
      setLastName("")
      setEmail("")
      setPhone("")
      setHourlyRate("")
      
      router.refresh()
      if (onAdded) onAdded()
      
    } catch (error: any) {
      console.error(error)
      toast.error("Error al registrar empleado: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar Empleado
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Empleado</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="kiosk">Kiosco</Label>
                <Select value={kioskId} onValueChange={setKioskId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona un kiosco" />
                    </SelectTrigger>
                    <SelectContent>
                        {kiosks.map(k => (
                            <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input 
                        id="firstName" 
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input 
                        id="lastName" 
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="hourlyRate">Valor Hora ($)</Label>
                <Input 
                    id="hourlyRate" 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={hourlyRate}
                    onChange={e => setHourlyRate(e.target.value)}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email (Opcional)</Label>
                <Input 
                    id="email" 
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone">Teléfono (Opcional)</Label>
                <Input 
                    id="phone" 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Empleado
            </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
