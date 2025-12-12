"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Loader2, DollarSign } from "lucide-react"
import { useRouter } from "next/navigation"

interface Employee {
  id?: string
  ui_key?: string
  first_name: string
  last_name: string
  hourly_rate: number
  kiosk_id: string
}

interface PaySalaryDialogProps {
  employee: Employee
  owedAmount?: number
  userId: string
  onPaid?: () => void
}

export function PaySalaryDialog({ employee, owedAmount = 0, userId, onPaid }: PaySalaryDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [amount, setAmount] = useState(owedAmount.toString())
  const [description, setDescription] = useState(`Sueldo ${new Date().toLocaleString('es-ES', { month: 'long' })}`)

  const router = useRouter()

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!employee.id) {
          toast.error("Este vendedor no tiene ficha de empleado (Valor Hora). Configúralo agergándolo nuevamente o invitándolo.")
          setLoading(false)
          return
      }

      // Create Expense Record
      const { error } = await supabase
        .from('expenses')
        .insert({
            description,
            amount: parseFloat(amount),
            category: 'salaries',
            kiosk_id: employee.kiosk_id,
            user_id: userId, // The owner creating the payment
            employee_id: employee.id, // The ID of the employee details record
            date: new Date().toISOString()
        })

      if (error) throw error

      toast.success("Pago registrado correctamente")
      setOpen(false)
      
      router.refresh()
      if (onPaid) onPaid()
      
    } catch (error: any) {
      console.error(error)
      toast.error("Error al registrar pago: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2">
          <DollarSign className="h-3 w-3" />
          Pagar Sueldo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Pago a {employee.first_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handlePay} className="space-y-4">
            <div className="p-4 bg-muted rounded-md mb-4 text-sm">
                <p>Valor Hora: <strong>${employee.hourly_rate}</strong></p>
                <p>Horas Pendientes (Estimado): <strong>?</strong></p> 
                {/* Real calculation of hours pending would require more complex DB queries 
                    (Sum(shifts) - Sum(salary expenses / rate)). 
                    For now we let user input amount but default to provided prop if we calculate it in parent list 
                */}
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Detalle</Label>
                <Input 
                    id="description" 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="amount">Monto a Pagar ($)</Label>
                <Input 
                    id="amount" 
                    type="number" 
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar Pago
            </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
