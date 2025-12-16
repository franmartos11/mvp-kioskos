"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  format, 
  isSameMonth, 
  isSameDay, 
  isWithinInterval,
  isBefore,
  isAfter
} from "date-fns"
import { es } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DateRange } from "react-day-picker"

export type CalendarProps = {
  mode?: "single" | "range" | "default" | "multiple"
  selected?: Date | DateRange | undefined
  onSelect?: (date: any) => void
  initialFocus?: boolean
  className?: string
  classNames?: any
  showOutsideDays?: boolean
  [key: string]: any
}

function Calendar({
  className,
  mode = "single",
  selected,
  onSelect,
  showOutsideDays = true,
  classNames,
  initialFocus,
  defaultMonth,
  numberOfMonths,
  ...props
}: CalendarProps) {
  // Internal navigation state
  const [currentMonth, setCurrentMonth] = React.useState(new Date())
  
  // Handle default selected month if provided and valid
  React.useEffect(() => {
    if (selected) {
       if (mode === 'single' && selected instanceof Date) {
           setCurrentMonth(selected)
       } else if (mode === 'range' && (selected as DateRange).from) {
           setCurrentMonth((selected as DateRange).from!)
       }
    }
  }, []) // Only on mount, don't jump around on every selection unless desired

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1))
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))

  // Generate days
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const handleDayClick = (day: Date) => {
    if (!onSelect) return

    if (mode === "single") {
        onSelect(day)
    } else if (mode === "range") {
        // Simple range logic handling if parent manages it, but parent usually expects { from, to }
        // If parent passed onSelect, it expects the new logic.
        // If we are implementing standard DayPicker behavior:
        const currentRange = selected as DateRange || { from: undefined, to: undefined }
        
        let newRange = { ...currentRange }
        if (!currentRange.from || (currentRange.from && currentRange.to)) {
             // Start new range
             newRange = { from: day, to: undefined }
        } else {
             // Complete range
             // Check if before
             if (isBefore(day, currentRange.from)) {
                 newRange = { from: day, to: currentRange.from }
             } else {
                 newRange = { from: currentRange.from, to: day }
             }
        }
        onSelect(newRange)
    }
  }

  // Helper to check selection status
  const isSelected = (day: Date) => {
      if (!selected) return false
      if (mode === "single") {
          return isSameDay(day, selected as Date)
      }
      if (mode === "range") {
          const range = selected as DateRange
          if (!range.from) return false
          if (range.to) {
              return isSameDay(day, range.from) || isSameDay(day, range.to) || 
                     isWithinInterval(day, { start: range.from, end: range.to })
          }
          return isSameDay(day, range.from)
      }
      return false
  }

  const isRangeStart = (day: Date) => {
      if (mode !== "range" || !selected) return false
      const range = selected as DateRange
      return range.from && isSameDay(day, range.from)
  }

  const isRangeEnd = (day: Date) => {
      if (mode !== "range" || !selected) return false
      const range = selected as DateRange
      return range.to && isSameDay(day, range.to)
  }
  
  const isInRangeMiddle = (day: Date) => {
    if (mode !== "range" || !selected) return false
    const range = selected as DateRange
    if (!range.from || !range.to) return false
    return isWithinInterval(day, { start: range.from, end: range.to }) && !isSameDay(day, range.from) && !isSameDay(day, range.to)
  }


  return (
    <div className={cn("p-3 bg-card rounded-md shadow-sm border inline-block", className)} {...props}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 space-x-2">
            <span className="text-sm font-semibold capitalize ml-2">
                {format(currentMonth, "MMMM yyyy", { locale: es })}
            </span>
            <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
          {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map(d => (
              <div key={d} className="h-9 w-9 flex items-center justify-center text-[0.8rem] text-muted-foreground font-medium">
                  {d}
              </div>
          ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-y-2 gap-x-1">
          {calendarDays.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, currentMonth)
              if (!isCurrentMonth && !showOutsideDays) return <div key={idx} className="h-9 w-9" />
              
              const selectedDay = isSelected(day)
              const rangeStart = isRangeStart(day)
              const rangeEnd = isRangeEnd(day)
              const rangeMiddle = isInRangeMiddle(day)
              const isToday = isSameDay(day, new Date())

              return (
                  <button
                    key={idx}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                        "h-9 w-9 flex items-center justify-center rounded-md text-sm transition-colors relative p-0 focus-visible:ring-1 focus-visible:outline-none",
                        !isCurrentMonth && "text-muted-foreground opacity-50",
                        // Range Middle Style
                        rangeMiddle && "bg-accent text-accent-foreground rounded-none",
                        // Range Start/End Caps
                        rangeStart && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-l-md rounded-r-none z-10",
                        rangeEnd && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-r-md rounded-l-none z-10",
                        // Single Selection or Ends collision
                        (rangeStart && rangeEnd) && "rounded-md",
                        (mode === 'single' && selectedDay) && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md",
                         // Today Style (if not selected)
                        (isToday && !selectedDay) && "bg-accent/50 text-accent-foreground font-semibold",
                        // Hover
                        !selectedDay && !rangeMiddle && "hover:bg-muted hover:text-accent-foreground"
                    )}
                  >
                      {format(day, "d")}
                  </button>
              )
          })}
      </div>
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
