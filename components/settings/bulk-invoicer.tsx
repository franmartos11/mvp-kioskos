"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { Loader2, FileCheck, AlertCircle } from "lucide-react"

interface SaleResult {
    id: string
    created_at: string
    total: number
    payment_method: string
    invoice_number: string | null
    metadata: any
}

export function BulkInvoicer() {
    const { currentKiosk } = useKiosk()
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState(false)
    const [sales, setSales] = useState<SaleResult[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (currentKiosk) fetchUninvoicedSales()
    }, [currentKiosk])

    const fetchUninvoicedSales = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .eq('kiosk_id', currentKiosk?.id)
            .is('invoice_number', null)
            .order('created_at', { ascending: false })
            .limit(50) // Reasonable batch size

        if (error) {
            toast.error("Error cargando ventas: " + error.message)
        } else {
            setSales(data || [])
            // Auto-select all? Maybe not.
        }
        setLoading(false)
    }

    const toggleSelect = (id: string) => {
        const newSet = new Set(selected)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelected(newSet)
    }

    const toggleAll = () => {
        if (selected.size === sales.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(sales.map(s => s.id)))
        }
    }

    const handleBulkInvoice = async () => {
        if (selected.size === 0) return
        setProcessing(true)
        
        try {
            // Here we would call the API route to process AFIP options
            // const res = await fetch('/api/afip/bulk-invoice', { 
            //    method: 'POST', 
            //    body: JSON.stringify({ saleIds: Array.from(selected) }) 
            // })
            
            // For now, SIMULATE success to show UI functionality as backend is complex
            // We'll update the records locally to "simulated" invoice
            
            // Mock delay
            await new Promise(r => setTimeout(r, 2000))

            const now = new Date()
            const updates = Array.from(selected).map(id => ({
                id,
                invoice_number: `00001-${Math.floor(Math.random() * 100000)}`, // Mock
                invoice_type: 'B', // Consumer Final
                cae: 'SIMULATED_CAE',
                cae_expiration: new Date(now.setDate(now.getDate() + 10)).toISOString()
            }))

            for (const update of updates) {
                 await supabase.from('sales').update({
                     invoice_number: update.invoice_number,
                     invoice_type: update.invoice_type,
                     cae: update.cae,
                     cae_expiration: update.cae_expiration
                 }).eq('id', update.id)
            }

            toast.success(`Se enviaron a facturar ${selected.size} ventas.`)
            setSelected(new Set())
            fetchUninvoicedSales()

        } catch (err) {
            toast.error("Error en proceso de facturación")
        } finally {
            setProcessing(false)
        }
    }

    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto text-muted-foreground" /></div>

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span>Facturación Masiva</span>
                    {selected.size > 0 && (
                        <Button 
                            onClick={() => toast.info("Funcionalidad disponible próximamente en la próxima versión.")} 
                            disabled={false} // Keep clickable to show toast
                            variant="secondary"
                        >
                            <FileCheck className="mr-2 h-4 w-4" />
                            Facturar ({selected.size})
                        </Button>
                    )}
                </CardTitle>
                <CardDescription>
                    Selecciona las ventas pendientes para generar Factura Electrónica (AFIP).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded-lg text-sm flex items-center gap-2 border border-blue-100 dark:border-blue-900/30">
                    <AlertCircle className="h-4 w-4" />
                    Esta sección muestra tus ventas reales pendientes. La emisión de facturas fiscales estará habilitada en la próxima actualización.
                </div>

                {sales.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-lg">
                        <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No hay ventas pendientes de facturación.</p>
                    </div>
                ) : (
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox 
                                            checked={selected.size === sales.length && sales.length > 0} 
                                            onCheckedChange={toggleAll}
                                        />
                                    </TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Método</TableHead>
                                    <TableHead>Total</TableHead>
                                    <TableHead>Detalle</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sales.map((sale) => (
                                    <TableRow key={sale.id} className={selected.has(sale.id) ? "bg-muted/50" : ""}>
                                        <TableCell>
                                            <Checkbox 
                                                checked={selected.has(sale.id)} 
                                                onCheckedChange={() => toggleSelect(sale.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{format(new Date(sale.created_at), 'dd MMM yyyy', { locale: es })}</span>
                                                <span className="text-xs text-muted-foreground">{format(new Date(sale.created_at), 'HH:mm')}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">{sale.payment_method}</Badge>
                                        </TableCell>
                                        <TableCell className="font-bold">
                                            ${sale.total.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                            {/* We might display items count or preview here if we joined sale_items */}
                                            {sale.metadata?.price_list?.name ? `Lista: ${sale.metadata.price_list.name}` : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
