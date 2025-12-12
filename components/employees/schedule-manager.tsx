"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, CalendarClock, Save } from "lucide-react"
import { useRouter } from "next/navigation"

interface Employee {
  id?: string
  first_name: string
  last_name: string
}

interface Schedule {
    day_of_week: number
    start_time: string
    end_time: string
    is_active: boolean
}

interface ScheduleManagerProps {
  employee: Employee
}

export function ScheduleManager({ employee }: ScheduleManagerProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // 0=Sun, 1=Mon, ..., 6=Sat
  // Default structure:
  const defaultSchedules: Schedule[] = Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      start_time: "09:00",
      end_time: "17:00",
      is_active: i >= 1 && i <= 5 // Mon-Fri default
  }))

  const [schedules, setSchedules] = useState<Schedule[]>(defaultSchedules)
  const router = useRouter()

  useEffect(() => {
     if (open && employee.id) {
         fetchSchedule()
     }
  }, [open, employee.id])

  const fetchSchedule = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
            .from('employee_schedules')
            .select('*')
            .eq('employee_id', employee.id)

        if (data && data.length > 0) {
            // MergeDB data with default structure to ensure all days exist in UI
            const merged = defaultSchedules.map(def => {
                const found = data.find((d: any) => d.day_of_week === def.day_of_week)
                if (found) {
                    return {
                        day_of_week: found.day_of_week,
                        start_time: found.start_time.slice(0, 5), // HH:MM
                        end_time: found.end_time.slice(0, 5),
                        is_active: found.is_active
                    }
                }
                return { ...def, is_active: false } // If not in DB, assume off? Or default? Let's assume off if not found but previously saved.
            })
            setSchedules(merged)
        }
      } catch (e) {
          console.error(e)
      } finally {
          setLoading(false)
      }
  }

  const handleSave = async () => {
      if (!employee.id) return
      setSaving(true)

      try {
          // 1. Delete existing (simplest strategy for full update)
          await supabase.from('employee_schedules').delete().eq('employee_id', employee.id)

          // 2. Insert active ones
          const toInsert = schedules
            .filter(s => s.is_active)
            .map(s => ({
                employee_id: employee.id,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                is_active: true
            }))

          if (toInsert.length > 0) {
            const { error } = await supabase.from('employee_schedules').insert(toInsert)
            if (error) throw error
          }

          toast.success("Horarios actualizados")
          setOpen(false)
          router.refresh()

      } catch (error: any) {
          toast.error("Error al guardar: " + error.message)
      } finally {
          setSaving(false)
      }
  }

  const updateSchedule = (day: number, field: keyof Schedule, value: any) => {
      setSchedules(prev => prev.map(s => s.day_of_week === day ? { ...s, [field]: value } : s))
  }

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  // Sorting to show Mon first (1) then Sun (0) last
  const sortedDays = [...schedules].sort((a, b) => {
      const dayA = a.day_of_week === 0 ? 7 : a.day_of_week
      const dayB = b.day_of_week === 0 ? 7 : b.day_of_week
      return dayA - dayB
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            Horarios
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Gestionar Horarios de {employee.first_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
            ) : (
                <div className="grid gap-3">
                    {sortedDays.map((s) => (
                        <div key={s.day_of_week} className={`flex items-center gap-4 p-3 rounded-lg border ${s.is_active ? 'bg-card' : 'bg-muted/50'}`}>
                            <div className="flex items-center gap-4 w-[140px]">
                                <Switch 
                                    checked={s.is_active} 
                                    onCheckedChange={(c) => updateSchedule(s.day_of_week, 'is_active', c)}
                                />
                                <Label className={s.is_active ? "font-medium" : "text-muted-foreground"}>
                                    {dayNames[s.day_of_week]}
                                </Label>
                            </div>
                            
                            {s.is_active ? (
                                <div className="flex items-center gap-2 flex-1">
                                    <Input 
                                        type="time" 
                                        value={s.start_time} 
                                        onChange={e => updateSchedule(s.day_of_week, 'start_time', e.target.value)}
                                        className="w-32" 
                                    />
                                    <span className="text-muted-foreground">-</span>
                                    <Input 
                                        type="time" 
                                        value={s.end_time} 
                                        onChange={e => updateSchedule(s.day_of_week, 'end_time', e.target.value)}
                                        className="w-32" 
                                    />
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground italic flex-1">
                                    Día libre
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>

        <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || loading}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Guardar Cambios
            </Button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
