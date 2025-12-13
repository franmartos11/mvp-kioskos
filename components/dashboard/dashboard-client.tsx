"use client"

import { useState } from "react"
import { OverviewStats } from "@/components/dashboard/overview-stats"
import { KioskDetailView } from "@/components/dashboard/kiosk-detail-view"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DatePickerWithRange } from "@/components/ui/date-range-picker"
import { addDays, subDays } from "date-fns"
import { DateRange } from "react-day-picker"

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
  
  // Default range: Last 30 days
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })

  return (
    <div className="flex flex-col gap-6 p-4 w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
            <p className="text-muted-foreground">
                Bienvenido, {user?.email}
            </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <DatePickerWithRange date={date} setDate={setDate} />
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-sm font-medium whitespace-nowrap">Vista:</span>
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
                dateRange={date} 
              />
          ) : (
              selectedKiosk && (
                  <KioskDetailView 
                    kioskId={selectedKiosk.id} 
                    kioskName={selectedKiosk.name} 
                  />
              )
          )}
      </div>
    </div>
  )
}
