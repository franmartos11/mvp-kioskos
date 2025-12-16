"use client"

import { useState, useEffect, useMemo } from "react"
import { OverviewStats } from "@/components/dashboard/overview-stats"
import { KioskDetailView } from "@/components/dashboard/kiosk-detail-view"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { addDays, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, format, addMonths, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import { DateRange } from "react-day-picker"
import { cn } from "@/lib/utils"

interface Kiosk {
  id: string
  name: string
  role: 'owner' | 'seller'
}

interface DashboardClientProps {
    user: any
    kiosks: Kiosk[]
    initialStats: any
}

export function DashboardClient({ user, kiosks, initialStats }: DashboardClientProps) {
  const [selectedView, setSelectedView] = useState<string>("overview")
  const selectedKiosk = kiosks.find(k => k.id === selectedView)
  
  // Advanced Date Filter State
  const [period, setPeriod] = useState("month")
  // Default custom range to last 7 days initially if needed, or empty
  const [customRange, setCustomRange] = useState<DateRange | undefined>({
      from: subDays(new Date(), 7),
      to: new Date()
  })
  const [customMonth, setCustomMonth] = useState<Date | undefined>(new Date())

  // Calculate DateRange based on period
  const dateRange = useMemo<DateRange | undefined>(() => {
      const now = new Date()
      if (period === 'today') {
          return { from: startOfDay(now), to: endOfDay(now) }
      }
      if (period === 'yesterday') {
          const yest = subDays(now, 1)
          return { from: startOfDay(yest), to: endOfDay(yest) }
      }
      if (period === 'month') {
          return { from: startOfMonth(now), to: endOfDay(now) }
      }
      if (period === 'custom-range' && customRange?.from) {
            // Respect the range. If 'to' is undefined, it's just 'from' (single day start).
            // We usually want endOfDay for the 'to' date.
            const from = startOfDay(customRange.from)
            const to = customRange.to ? endOfDay(customRange.to) : endOfDay(customRange.from)
            return { from, to }
      }
      if (period === 'custom-month' && customMonth) {
          return { from: startOfMonth(customMonth), to: endOfMonth(customMonth) }
      }
      return { from: startOfMonth(now), to: endOfDay(now) } // default fallback (month)
  }, [period, customRange, customMonth])

  return (
    <div className="flex flex-col gap-6 p-4 w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
            <p className="text-muted-foreground">
                Bienvenido, {user?.email}
            </p>
        </div>
        <div className="flex flex-col xl:flex-row items-center gap-2 w-full md:w-auto">
            
            <div className="flex items-center gap-2 w-full md:w-auto">
                 {/* Month Picker Control */}
                 {period === 'custom-month' && customMonth && (
                    <div className="flex items-center bg-card border rounded-md shadow-sm">
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCustomMonth(subMonths(customMonth, 1))}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="w-32 text-center font-medium capitalize text-sm">
                            {format(customMonth, "MMMM yyyy", { locale: es })}
                        </div>
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCustomMonth(addMonths(customMonth, 1))}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                 )}

                 {/* Date Range Picker Control */}
                 {period === 'custom-range' && (
                     <Popover>
                         <PopoverTrigger asChild>
                             <Button
                                 variant={"outline"}
                                 className={cn(
                                     "w-[260px] justify-start text-left font-normal h-9",
                                     !customRange?.from && "text-muted-foreground"
                                 )}
                             >
                                 <CalendarIcon className="mr-2 h-4 w-4" />
                                 {customRange?.from ? (
                                     customRange.to ? (
                                         <>
                                             {format(customRange.from, "LLL dd, y", { locale: es })} -{" "}
                                             {format(customRange.to, "LLL dd, y", { locale: es })}
                                         </>
                                     ) : (
                                         format(customRange.from, "LLL dd, y", { locale: es })
                                     )
                                 ) : (
                                     <span>Seleccionar periodo</span>
                                 )}
                             </Button>
                         </PopoverTrigger>
                         <PopoverContent className="w-auto p-0" align="end">
                             <Calendar
                                 initialFocus
                                 mode="range"
                                 defaultMonth={customRange?.from}
                                 selected={customRange}
                                 onSelect={setCustomRange}
                                 numberOfMonths={2}
                             />
                         </PopoverContent>
                     </Popover>
                 )}

                <div className="w-[180px]">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Hoy</SelectItem>
                            <SelectItem value="yesterday">Ayer</SelectItem>
                            <SelectItem value="month">Este Mes</SelectItem>
                            <SelectItem value="custom-range">Rango Personalizado...</SelectItem>
                            <SelectItem value="custom-month">Elegir Mes...</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-sm font-medium whitespace-nowrap sr-only">Vista:</span>
                <Select value={selectedView} onValueChange={setSelectedView}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                        <SelectValue placeholder="Seleccionar vista" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="overview">Panorama General</SelectItem>
                        {kiosks.map(k => (
                            <SelectItem key={k.id} value={k.id}>
                                {k.name} ({k.role === 'owner' ? 'Dueño' : 'Vendedor'})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
      </div>

      <div className="min-h-[500px]">
          {selectedView === "overview" ? (
              <OverviewStats 
                userId={user.id} 
                initialData={initialStats} 
                dateRange={dateRange} // Use new memo
              />
          ) : (
              selectedKiosk && (
                  <KioskDetailView 
                    kioskId={selectedKiosk.id} 
                    kioskName={selectedKiosk.name} 
                    dateRange={dateRange}
                  />
              )
          )}
      </div>
    </div>
  )
}
