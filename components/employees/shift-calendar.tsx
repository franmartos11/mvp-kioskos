"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Calendar as CalIcon, LayoutGrid } from "lucide-react"
import { DayScheduleDialog } from "./day-schedule-dialog"

interface Employee {
    id: string
    ui_key?: string 
    first_name: string
    last_name: string
    kiosk_id: string 
}

interface Schedule {
    employee_id: string
    day_of_week: number // 0-6
    start_time: string
    end_time: string
    is_active: boolean
}

interface Shift {
    id: string
    employee_id: string
    date: string // YYYY-MM-DD
    start_time: string
    total_hours: number
    status: string // scheduled, absent, completed
}

interface ShiftCalendarProps {
    employees: Employee[]
    schedules: Schedule[]
    shifts?: Shift[] // Specific overrides/shifts
}

export function ShiftCalendar({ employees, schedules, shifts = [] }: ShiftCalendarProps) {
  const [view, setView] = useState<'week' | 'month'>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedShift, setSelectedShift] = useState<Shift | undefined>(undefined)

  const handlePrev = () => {
      setCurrentDate(prev => view === 'week' ? addDays(prev, -7) : addDays(prev, -30)) // Rough month jump, stick to startOfMonth usually better
  }
  const handleNext = () => {
      setCurrentDate(prev => view === 'week' ? addDays(prev, 7) : addDays(prev, 30))
  }

  // Generate Days to Render
  let daysToRender: Date[] = []
  if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      daysToRender = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  } else {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
      const end = endOfWeek(endOfMonth(currentDate)) 
      // Helper for endOfWeek if not imported? 
      // Let's just generate 6 weeks (42 days) to be safe for grid
      daysToRender = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }

  // Helper to end of week
  function endOfWeek(date: Date) {
      const start = startOfWeek(date, { weekStartsOn: 1 })
      return addDays(start, 6)
  }

  const handleDayClick = (date: Date) => {
      setSelectedDate(date)
      setSelectedShift(undefined) // New shift
      setDialogOpen(true)
  }

  const handleShiftClick = (e: React.MouseEvent, shift: Shift) => {
      e.stopPropagation()
      const d = new Date(shift.date)
      // d.setDate(d.getDate() + 1) // Timezone issues usually, keeping raw string is safer. 
      // But for editing dialog we need Date object.
      // Assuming shift.date is YYYY-MM-DD local, parsing it as YYYY-MM-DDT00:00 is safest.
      const [y,m,dPart] = shift.date.split('-').map(Number)
      setSelectedDate(new Date(y, m-1, dPart))
      
      setSelectedShift(shift)
      setDialogOpen(true)
  }

  return (
    <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-4">
                <CardTitle>
                    {view === 'week' ? 'Semana del ' + format(daysToRender[0], "d MMM", { locale: es }) : format(currentDate, "MMMM yyyy", { locale: es })}
                </CardTitle>
                <div className="flex border rounded-md overflow-hidden">
                    <Button variant={view === 'week' ? "secondary" : "ghost"} size="sm" onClick={() => setView('week')} className="rounded-none px-3">
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button variant={view === 'month' ? "secondary" : "ghost"} size="sm" onClick={() => setView('month')} className="rounded-none px-3">
                        <CalIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={handlePrev}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={handleNext}><ChevronRight className="h-4 w-4" /></Button>
            </div>
        </CardHeader>
        <CardContent>
            {/* Header Days */}
            <div className="overflow-x-auto pb-2">
                <div className="min-w-[600px]">
                    <div className="grid grid-cols-7 gap-1 text-center border-b pb-2 mb-2 font-semibold text-sm">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    
                    <div className={`grid grid-cols-7 gap-1 ${view === 'month' ? 'auto-rows-[100px]' : 'min-h-[200px]'}`}>
                        {daysToRender.map((day, idx) => {
                            const isCurrentMonth = view === 'week' || isSameMonth(day, currentDate)
                            const dayOfWeek = getDay(day) // 0-6 Sun-Sat (Wait, getDay 0 is Sunday usually)
                            // date-fns getDay: 0=Sunday, 1=Monday...
                            // My Loop generates Mon-Sun if weekStartsOn:1.
                            // But I need to match dayOfWeek to my Schedule (assuming 0-6 is Mon-Sun or Sun-Sat?)
                            // I previously defined 0-6. Let's assume standard JS getDay (0=Sun).
                            
                            // 1. Get Recurring Schedules for this day of week
                            // Don't show recurring if there is an explicit OVERRIDE/Shift log for this day?
                            // Or merge them?
                            // Strategy: Show Scheduled (Template) UNLESS there is a shift with status='absent' or 'scheduled' (Override) for that person.
                            
                            const dayString = format(day, "yyyy-MM-dd")
                            
                            // Actual Shifts (Overrides/Logged)
                            const dayShifts = shifts.filter(s => s.date === dayString)
                            
                            // Employees who have shifts
                            const employeesWithShifts = new Set(dayShifts.map(s => s.employee_id))
        
                            // Recurring Templates (only for employees NOT in dayShifts)
                            const dayTemplates = schedules.filter(s => 
                                s.day_of_week === dayOfWeek && 
                                s.is_active && 
                                !employeesWithShifts.has(s.employee_id)
                            )
        
                            return (
                                <div 
                                    key={idx} 
                                    onClick={() => handleDayClick(day)}
                                    className={`
                                        border rounded p-1 flex flex-col gap-1 overflow-hidden hover:bg-muted/50 transition-colors cursor-pointer
                                        ${!isCurrentMonth ? 'bg-muted/20 opacity-50' : ''}
                                        ${isSameDay(day, new Date()) ? 'border-primary/50 bg-primary/5' : ''}
                                    `}
                                >
                                    <div className="text-right text-xs text-muted-foreground font-medium p-1">
                                        {format(day, "d")}
                                    </div>
        
                                    <div className="space-y-1 overflow-y-auto no-scrollbar">
                                        {/* Render Overrides/Shifts */}
                                        {dayShifts.map(shift => {
                                            const emp = employees.find(e => e.id === shift.employee_id)
                                            if (!emp) return null
                                            
                                            const isAbsent = shift.status === 'absent'
                                            
                                            return (
                                                <div 
                                                    key={shift.id} 
                                                    onClick={(e) => handleShiftClick(e, shift)}
                                                    className={`
                                                        text-[10px] p-1 rounded border truncate
                                                        ${isAbsent ? 'bg-destructive/10 border-destructive/20 text-destructive' : 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'}
                                                    `}
                                                >
                                                    <span className="font-bold">{emp.first_name}</span>
                                                    {!isAbsent && <span className="ml-1">{shift.total_hours}h</span>}
                                                    {isAbsent && <span className="ml-1">Out</span>}
                                                </div>
                                            )
                                        })}
        
                                        {/* Render Recurring Templates */}
                                        {dayTemplates.map((sched, i) => {
                                            const emp = employees.find(e => e.id === sched.employee_id)
                                            if (!emp) return null
        
                                            return (
                                                <div key={'tmpl'+i} className="bg-primary/10 text-[10px] p-1 rounded border border-primary/20 truncate text-foreground">
                                                     <span className="font-bold">{emp.first_name}</span>
                                                     <span className="ml-1 opacity-70">
                                                         {sched.start_time.slice(0,2)}-{sched.end_time.slice(0,2)}
                                                     </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </CardContent>

        <DayScheduleDialog 
            open={dialogOpen} 
            onOpenChange={setDialogOpen}
            date={selectedDate}
            employees={employees}
            currentShift={selectedShift}
        />
    </Card>
  )
}
