"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, FileText, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"

interface BillingDialogProps {
    saleId: string
    total: number
    onSuccess: () => void
}

export function BillingDialog({ saleId, total, onSuccess }: BillingDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [docNumber, setDocNumber] = useState("")
    
    // In a real implementation this would call the API route
    const handleBill = async () => {
        if (!docNumber) return toast.error("Ingresa el DNI o CUIT")
        
        setLoading(true)
        try {
            // Mock API call for now until backend route is ready
            // const res = await fetch('/api/afip/invoice', { ... })
            
            // For UI Demo: Simulate delay and success
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            // Simulate update to DB so UI updates instantly
            await supabase.from('sales').update({
                cae: '12345678901234',
                invoice_number: 123,
                invoice_type: 'B'
            }).eq('id', saleId)

            toast.success("Factura Generada Correctamente")
            onSuccess()
            setOpen(false)
        } catch (error) {
            toast.error("Error al facturar con AFIP")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                    <FileText className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Generar Factura AFIP</DialogTitle>
                    <DialogDescription>
                        Ingresa el documento del cliente para facturar esta venta de <span className="font-bold">${total}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {total < 344488 && (
                        <Button 
                            variant="secondary" 
                            className="w-full mb-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                            onClick={() => {
                                setDocNumber("0")
                                // Small timeout to allow state update then trigger
                                setTimeout(() => document.getElementById("billing-submit")?.click(), 100)
                            }}
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Facturar Rápido (Sin DNI)
                        </Button>
                    )}
                    <div className="space-y-2">
                         <Label>DNI o CUIT del Cliente</Label>
                         <Input 
                            placeholder="Ej: 20123456789 (Opcional si es monto bajo)" 
                            value={docNumber}
                            onChange={(e) => setDocNumber(e.target.value)}
                            autoFocus
                         />
                         <p className="text-xs text-muted-foreground">Límite para DNI 0 (Consumidor Final): $344.488</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button id="billing-submit" onClick={handleBill} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generar Factura
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
