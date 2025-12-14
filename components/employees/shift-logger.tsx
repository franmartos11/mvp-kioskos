"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, Timer } from "lucide-react"
import { useRouter } from "next/navigation"
import { useKiosk } from "@/components/providers/kiosk-provider"

interface Employee {
    id?: string
    ui_key?: string
    first_name: string
    last_name: string
    kiosk_id: string
}

interface ShiftLoggerProps {
  employees: Employee[]
  kiosks: { id: string, name: string }[]
  onLog?: () => void
}

export function ShiftLogger({ employees, kiosks, onLog }: ShiftLoggerProps) {
  const { currentKiosk } = useKiosk()
  
  if (!currentKiosk || currentKiosk.role !== 'owner') {
      return null
  }

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [employeeId, setEmployeeId] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [hours, setHours] = useState("")

  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employeeId) {
      toast.error("Selecciona un empleado")
      return
    }

    const employee = employees.find(e => e.id === employeeId)
    if (!employee || !employee.id) {
        toast.error("El empleado no tiene ficha configurada (Valor hora)")
        return
    }

    setLoading(true)

    try {
      // Simplified shift logging: Just total hours for a day
      const shiftDate = new Date(date)
      const startTime = new Date(shiftDate)
      startTime.setHours(9, 0, 0, 0)
      
      const { error } = await supabase
        .from('work_shifts')
        .insert({
            employee_id: employee.id, // Uses the details ID
            kiosk_id: employee.kiosk_id,
            date: date,
            start_time: startTime.toISOString(), // Placeholder
            total_hours: parseFloat(hours)
        })

      if (error) throw error

      toast.success("Horas registradas correctamente")
      setOpen(false)
      setHours("")
      
      router.refresh()
      if (onLog) onLog()
      
    } catch (error: any) {
      console.error(error)
      toast.error("Error al registrar horas: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  // Filter employees ? Or just list all.
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Timer className="h-4 w-4" />
          Registrar Horas
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Turno / Horas</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="employee">Empleado</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger>
                        <SelectValue placeholder="Selecciona un empleado" />
                    </SelectTrigger>
                    <SelectContent>
                        {employees.map(e => (
                            <SelectItem key={e.ui_key || e.id || Math.random()} value={e.id || "missing_id"} disabled={!e.id}>
                                {e.first_name} {e.last_name} {!e.id && "(Sin datos)"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input 
                    id="date" 
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="hours">Cantidad de Horas</Label>
                <Input 
                    id="hours" 
                    type="number"
                    step="0.5"
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                    placeholder="Ej. 8"
                    required
                />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
            </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
