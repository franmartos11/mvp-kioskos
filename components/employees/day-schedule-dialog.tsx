"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface Employee {
  id: string
  first_name: string
  last_name: string
  kiosk_id: string
}

interface DayScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date
  employees: Employee[]
  currentShift?: any // If editing an existing override
  onSave?: () => void
}

export function DayScheduleDialog({ open, onOpenChange, date, employees, currentShift, onSave }: DayScheduleDialogProps) {
  const [loading, setLoading] = useState(false)
  const [employeeId, setEmployeeId] = useState("")
  const [startTime, setStartTime] = useState("09:00")
  const [hours, setHours] = useState("8")
  const [status, setStatus] = useState("scheduled") // scheduled, absent, completed (usually scheduled for future)

  const router = useRouter()

  useEffect(() => {
    if (open) {
        if (currentShift) {
            setEmployeeId(currentShift.employee_id)
            setStartTime(currentShift.start_time ? new Date(currentShift.start_time).toTimeString().slice(0,5) : "09:00")
            setHours(currentShift.total_hours?.toString() || "0")
            setStatus(currentShift.status || "scheduled")
        } else {
            // Default new
            setEmployeeId(employees[0]?.id || "")
            setStartTime("09:00")
            setHours("8")
            setStatus("scheduled")
        }
    }
  }, [open, currentShift, employees])

  const handleSave = async () => {
      if (!employeeId) return
      setLoading(true)

      try {
        const shiftDate = new Date(date)
        // Combine date with start time
        const [sh, sm] = startTime.split(':').map(Number)
        const startDateTime = new Date(date)
        startDateTime.setHours(sh, sm, 0, 0)
        
        // If status is 'absent', maybe hours should be 0?
        const finalHours = status === 'absent' ? 0 : parseFloat(hours)

        const payload = {
            employee_id: employeeId,
            kiosk_id: employees.find(e => e.id === employeeId)?.kiosk_id,
            date: date.toISOString().split('T')[0],
            start_time: startDateTime.toISOString(),
            total_hours: finalHours,
            status: status,
            notes: "Manual Override"
        }

        if (currentShift?.id) {
            // Update
            const { error } = await supabase
                .from('work_shifts')
                .update(payload)
                .eq('id', currentShift.id)
            if (error) throw error
        } else {
            // Insert
            const { error } = await supabase
                .from('work_shifts')
                .insert(payload)
            if (error) throw error
        }

        toast.success("Turno guardado")
        onOpenChange(false)
        router.refresh()
        if (onSave) onSave()

      } catch (error: any) {
          toast.error("Error: " + error.message)
      } finally {
          setLoading(false)
      }
  }

  const handleDelete = async () => {
      if (!currentShift?.id) return
      if (!confirm("¿Eliminar este turno?")) return
      setLoading(true)
      try {
          await supabase.from('work_shifts').delete().eq('id', currentShift.id)
          toast.success("Turno eliminado")
          onOpenChange(false)
          router.refresh()
          if (onSave) onSave()
      } catch (e) {
          toast.error("Error al eliminar")
      } finally {
          setLoading(false)
      }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
              {currentShift ? "Editar Turno" : "Agregar Turno Extra / Modificar"}
              <span className="ml-2 text-muted-foreground font-normal text-sm">
                  {date.toLocaleDateString()}
              </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
            <div className="space-y-2">
                <Label>Empleado</Label>
                <Select value={employeeId} onValueChange={setEmployeeId} disabled={!!currentShift}>
                    <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                        {employees.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="scheduled">Programado (Trabaja)</SelectItem>
                        <SelectItem value="absent">Franco / Ausente</SelectItem>
                        <SelectItem value="completed">Completado</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {status !== 'absent' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Hora Inicio</Label>
                        <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Duración (Horas)</Label>
                        <Input type="number" step="0.5" value={hours} onChange={e => setHours(e.target.value)} />
                    </div>
                </div>
            )}

            <div className="flex justify-between pt-4">
                {currentShift ? (
                    <Button variant="destructive" size="icon" onClick={handleDelete} type="button">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                ) : <div />}
                
                <Button onClick={handleSave} disabled={loading || !employeeId}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
