"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, Eye, RotateCcw, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"

type Audit = {
    id: string
    created_at: string
    completed_at: string | null
    status: 'in_progress' | 'completed' | 'cancelled'
    performed_by: string
    user_email?: string
}

type AuditItem = {
    id: string
    product_name: string
    expected_stock: number
    counted_stock: number
    difference: number
}

interface AuditHistoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AuditHistoryDialog({ open, onOpenChange }: AuditHistoryDialogProps) {
    const [audits, setAudits] = useState<Audit[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedAudit, setSelectedAudit] = useState<string | null>(null)
    const [auditDetails, setAuditDetails] = useState<AuditItem[]>([])
    const [loadingDetails, setLoadingDetails] = useState(false)
    const [processingRevert, setProcessingRevert] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (open) {
            fetchAudits()
        }
    }, [open])

    useEffect(() => {
        if (selectedAudit) {
            fetchAuditDetails(selectedAudit)
        } else {
            setAuditDetails([])
        }
    }, [selectedAudit])


    async function fetchAudits() {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: members } = await supabase.from('kiosk_members').select('kiosk_id').eq('user_id', user.id)
        if (!members?.length) {
            setLoading(false)
            return
        }
        const kioskIds = members.map(m => m.kiosk_id)

        const { data } = await supabase
            .from('stock_audits')
            .select('*')
            .in('kiosk_id', kioskIds)
            .order('created_at', { ascending: false })
        
        if (data) {
            setAudits(data as Audit[])
            // Auto-select first if available and none selected? 
            // Better to let user choose, or auto-select the latest one.
            if (data.length > 0 && !selectedAudit) {
                // optional: setSelectedAudit(data[0].id) 
            }
        }
        setLoading(false)
    }

    async function fetchAuditDetails(auditId: string) {
        setLoadingDetails(true)
        const { data } = await supabase
            .from('stock_audit_items')
            .select(`
                *,
                products (name)
            `)
            .eq('audit_id', auditId)
        
        if (data) {
            setAuditDetails(data.map(item => ({
                id: item.id,
                product_name: item.products?.name || 'Producto Desconocido',
                expected_stock: item.expected_stock,
                counted_stock: item.counted_stock,
                difference: item.counted_stock - item.expected_stock 
            })))
        }
        setLoadingDetails(false)
    }

    async function handleRevert(auditId: string) {
        if (!confirm("¿Estás seguro de cancelar esta auditoría? Se revertirán todos los ajustes de stock.")) return

        setProcessingRevert(true)
        try {
            const { error } = await supabase.rpc('revert_stock_audit', { p_audit_id: auditId })
            if (error) throw error
            
            toast.success("Auditoría cancelada y stock revertido")
            fetchAudits()
            setSelectedAudit(null)
            setAuditDetails([])
        } catch (error) {
            console.error(error)
            toast.error("Error al revertir auditoría")
        } finally {
            setProcessingRevert(false)
        }
    }

    const currentAudit = audits.find(a => a.id === selectedAudit)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[90vw] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden sm:max-w-screen-xl">
                <DialogHeader className="p-6 border-b shrink-0 bg-muted/5">
                    <DialogTitle className="text-2xl font-semibold tracking-tight">Historial de Auditorías</DialogTitle>
                    <DialogDescription className="text-base">
                        Registro histórico detallado de los controles de stock.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar / List - Fixed width or percentage */}
                    <aside className="w-80 lg:w-96 border-r bg-muted/10 flex flex-col shrink-0">
                         <div className="p-4 border-b bg-muted/20 flex justify-between items-center">
                            <h4 className="font-medium text-sm text-foreground">Auditorías ({audits.length})</h4>
                         </div>
                         <ScrollArea className="flex-1">
                            {loading ? (
                                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted-foreground w-6 h-6" /></div>
                            ) : audits.length === 0 ? (
                                <div className="p-10 text-center text-muted-foreground text-sm">No hay registros aún.</div>
                            ) : (
                                <div className="flex flex-col">
                                    {audits.map(audit => (
                                        <button
                                            key={audit.id}
                                            onClick={() => setSelectedAudit(audit.id)}
                                            className={`
                                                flex flex-col gap-2 p-5 text-left transition-all border-b border-border/50
                                                hover:bg-muted/60 focus:outline-none relative
                                                ${selectedAudit === audit.id ? 'bg-background shadow-sm z-10' : 'text-muted-foreground'}
                                            `}
                                        >
                                            {selectedAudit === audit.id && (
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                            )}
                                            <div className="flex justify-between items-center w-full">
                                                <span className={`font-medium ${selectedAudit === audit.id ? 'text-foreground' : ''}`}>
                                                    {format(new Date(audit.created_at), "EEEE d 'de' MMMM", { locale: es })}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={
                                                        audit.status === 'completed' ? 'outline' : 
                                                        audit.status === 'in_progress' ? 'secondary' : 'destructive'
                                                    } className={`
                                                        ${audit.status === 'completed' ? 'border-green-600/20 text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400' : ''}
                                                    `}>
                                                        {audit.status === 'completed' ? 'Completada' : audit.status === 'in_progress' ? 'En Curso' : 'Cancelada'}
                                                    </Badge>
                                                    <span className="text-xs opacity-70">
                                                        {format(new Date(audit.created_at), "HH:mm")} hs
                                                    </span>
                                                </div>
                                                {selectedAudit === audit.id && <ChevronRight className="h-4 w-4 text-primary opacity-50" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                         </ScrollArea>
                    </aside>

                    {/* Main Content / Details */}
                    <main className="flex-1 flex flex-col bg-background relative min-w-0">
                        {selectedAudit ? (
                            <>
                                <header className="p-6 border-b flex justify-between items-center shrink-0 bg-card/50">
                                    <div className="space-y-1">
                                        <h2 className="text-xl font-bold flex items-center gap-2">
                                            Detalle de la Auditoría
                                        </h2>
                                        <div className="text-sm text-muted-foreground flex gap-4">
                                            <span>ID: <code className="bg-muted px-1 rounded">{selectedAudit}</code></span>
                                            <span>•</span>
                                            <span>{currentAudit && format(new Date(currentAudit.created_at), "PPP 'a las' HH:mm", { locale: es })}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        {/* Stats Summary Small */}
                                        <div className="text-right text-sm hidden xl:block">
                                            <div className="text-muted-foreground">Productos Auditados</div>
                                            <div className="font-medium text-foreground">{auditDetails.length}</div>
                                        </div>
                                        <div className="w-px h-8 bg-border hidden xl:block mx-2"></div>
                                        
                                        {currentAudit?.status === 'completed' && (
                                             <Button 
                                                variant="destructive" 
                                                className="shadow-sm"
                                                onClick={() => handleRevert(selectedAudit)}
                                                disabled={processingRevert}
                                            >
                                                <RotateCcw className="w-4 h-4 mr-2" />
                                                {processingRevert ? "Revirtiendo..." : "Revertir Auditoría"}
                                            </Button>
                                        )}
                                    </div>
                                </header>
                                
                                {loadingDetails ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="flex flex-col items-center gap-3 text-muted-foreground animate-pulse">
                                            <div className="bg-muted h-10 w-10 rounded-full" />
                                            <p>Cargando información...</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-auto bg-muted/5">
                                        <div className="min-w-[600px] p-6">
                                            <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-muted/30">
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead className="w-[40%] pl-6 py-4 text-base">Producto</TableHead>
                                                            <TableHead className="text-center py-4 text-base">Stock Esperado</TableHead>
                                                            <TableHead className="text-center py-4 text-base">Conteo Real</TableHead>
                                                            <TableHead className="text-right pr-6 py-4 text-base">Diferencia</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {auditDetails.map((item) => {
                                                            const hasDiff = item.difference !== 0;
                                                            return (
                                                                <TableRow key={item.id} className={`
                                                                    group transition-colors
                                                                    ${hasDiff ? "bg-amber-50/50 hover:bg-amber-100/50 dark:bg-amber-950/20" : "hover:bg-muted/30"}
                                                                `}>
                                                                    <TableCell className="pl-6 py-4 font-medium text-base text-foreground/90 group-hover:text-foreground">
                                                                        {item.product_name}
                                                                        <div className="text-xs text-muted-foreground font-normal mt-0.5">ID: {item.id.slice(0,8)}</div>
                                                                    </TableCell>
                                                                    <TableCell className="text-center py-4 text-muted-foreground font-mono text-base">
                                                                        {item.expected_stock}
                                                                    </TableCell>
                                                                    <TableCell className="text-center py-4 font-bold text-base">
                                                                        {item.counted_stock}
                                                                    </TableCell>
                                                                    <TableCell className="text-right pr-6 py-4">
                                                                        <Badge variant="outline" className={`
                                                                            text-sm px-3 py-1 font-medium border-0
                                                                            ${item.difference === 0 
                                                                                ? "text-muted-foreground bg-transparent" 
                                                                                : item.difference > 0 
                                                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                                                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                                            }
                                                                        `}>
                                                                            {item.difference > 0 ? `+${item.difference}` : item.difference}
                                                                        </Badge>
                                                                    </TableCell>
                                                                </TableRow>
                                                            )
                                                        })}
                                                        {auditDetails.length === 0 && (
                                                            <TableRow>
                                                                <TableCell colSpan={4} className="h-40 text-center text-muted-foreground text-lg">
                                                                    No se encontraron items en esta auditoría.
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-10 bg-muted/5">
                                <div className="bg-background p-8 rounded-full shadow-sm mb-6 border">
                                     <Eye className="h-12 w-12 opacity-20" />
                                </div>
                                <h3 className="font-semibold text-2xl text-foreground tracking-tight">Selecciona una auditoría</h3>
                                <p className="text-muted-foreground/80 mt-2 text-center max-w-sm text-lg">
                                    Selecciona un registro del menú lateral para ver los detalles completos.
                                </p>
                            </div>
                        )}
                    </main>
                </div>
            </DialogContent>
        </Dialog>
    )
}
