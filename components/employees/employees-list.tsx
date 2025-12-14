"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PaySalaryDialog } from "./pay-salary-dialog"
import { ScheduleManager } from "./schedule-manager"
import { Phone, Mail } from "lucide-react"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { cn } from "@/lib/utils"

// Update interface to accept ui_key if id is potentially missing
interface Employee {
    id?: string // Making optional as fetch might not have details yet
    ui_key?: string
    user_id?: string
    first_name: string
    last_name: string
    email: string
    phone?: string
    hourly_rate: number
    kiosk_id: string
    monthly_hours?: number
}

interface EmployeesListProps {
  employees: Employee[]
  userId: string
}

export function EmployeesList({ employees, userId }: EmployeesListProps) {
  const { currentKiosk } = useKiosk()

  if (!currentKiosk) return null

  const isOwner = currentKiosk.role === 'owner'
  
  // Filter by Kiosk
  let filteredEmployees = employees.filter(e => e.kiosk_id === currentKiosk.id)

  // If not owner, show ONLY themselves
  if (!isOwner) {
      filteredEmployees = filteredEmployees.filter(e => e.user_id === userId)
  }
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredEmployees.map(employee => (
            <Card key={employee.ui_key || employee.id || Math.random()}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg font-bold">
                        {employee.first_name} {employee.last_name}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-sm text-muted-foreground space-y-1 mb-4">
                        {employee.email && (
                            <div className="flex items-center gap-2">
                                <Mail className="h-3 w-3" /> {employee.email}
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {isOwner && (
                            <div className="p-2 bg-muted rounded flex flex-col">
                                <span className="text-[10px] uppercase text-muted-foreground font-bold">Valor Hora</span>
                                <span className="font-bold text-lg">${employee.hourly_rate}</span>
                            </div>
                        )}
                        <div className={cn("p-2 bg-primary/10 border border-primary/20 rounded flex flex-col", !isOwner && "col-span-2")}>
                            <span className="text-[10px] uppercase text-muted-foreground font-bold">Horas Mes</span>
                            <span className="font-bold text-lg text-primary">
                                {employee.monthly_hours || 0} hs
                            </span>
                        </div>
                    </div>
                        
                    <div className="flex gap-2">
                            <div className="flex-1">
                            <ScheduleManager employee={employee} />
                            </div>
                            {isOwner && (
                                <PaySalaryDialog 
                                    employee={employee} 
                                    userId={userId} 
                                />
                            )}
                    </div>
                </CardContent>
            </Card>
        ))}
        {filteredEmployees.length === 0 && (
            <div className="col-span-full text-center py-10 text-muted-foreground">
                No hay empleados registrados en este kiosco.
            </div>
        )}
    </div>
  )
}
