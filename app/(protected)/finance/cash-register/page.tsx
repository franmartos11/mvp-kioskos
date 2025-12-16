"use client"

import { useState, useEffect } from "react"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { supabase } from "@/utils/supabase/client"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, AlertCircle, CheckCircle2, RefreshCcw, Inbox } from "lucide-react"
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CashSessionDetails } from "@/components/finance/cash-session-details"
import { cn } from "@/lib/utils"

export default function CashRegisterHistoryPage() {
    const {currentKiosk} = useKiosk()
    const [sessions, setSessions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedSession, setSelectedSession] = useState<any>(null)

    useEffect(() => {
        if (!currentKiosk) return
        fetchSessions(currentKiosk.id)
    }, [currentKiosk])

    async function fetchSessions(kioskId: string) {
        setLoading(true)
        const { data, error } = await supabase
            .from('cash_sessions')
            .select(`
                *,
                opener:profiles!fk_cash_sessions_profiles_opener(full_name),
                closer:profiles!cash_sessions_closed_by_fkey(full_name)
            `)
            .eq('kiosk_id', kioskId)
            .order('opened_at', { ascending: false })
            .limit(50)

        if (error) {
            console.error(error)
        } else {
            setSessions(data || [])
        }
        setLoading(false)
    }

    if (loading) {
        return (
            <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
                        <div className="h-4 w-64 bg-muted animate-pulse rounded" />
                    </div>
                    <div className="h-10 w-10 bg-muted animate-pulse rounded" />
                </div>
                <div className="rounded-md border p-4">
                    <div className="space-y-4">
                         <div className="h-8 w-32 bg-muted animate-pulse rounded" />
                         {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <div className="h-12 w-full bg-muted animate-pulse rounded" />
                            </div>
                         ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Historial de Caja</h2>
                    <p className="text-muted-foreground">Registro de aperturas y cierres de turno.</p>
                </div>
                <Button variant="outline" size="icon" onClick={() => currentKiosk && fetchSessions(currentKiosk.id)} disabled={loading}>
                    <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Turnos Recientes</CardTitle>
                    <CardDescription>Mostrando los últimos 50 turnos. Haz clic en una fila para ver detalles.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Estado</TableHead>
                                <TableHead>Apertura</TableHead>
                                <TableHead>Cierre</TableHead>
                                <TableHead>Abierto Por</TableHead>
                                <TableHead>Inicial</TableHead>
                                <TableHead>Final</TableHead>
                                <TableHead>Diferencia</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sessions.map((session) => (
                                <TableRow 
                                    key={session.id} 
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => setSelectedSession(session)}
                                >
                                    <TableCell>
                                        <Badge variant={session.status === 'open' ? 'default' : 'secondary'} 
                                            className={cn(
                                                session.status === 'open' ? "bg-green-500 hover:bg-green-600" : ""
                                            )}
                                        >
                                            {session.status === 'open' ? 'Abierto' : 'Cerrado'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {format(new Date(session.opened_at), "dd/MM/yyyy HH:mm", { locale: es })}
                                    </TableCell>
                                    <TableCell>
                                        {session.closed_at 
                                            ? format(new Date(session.closed_at), "dd/MM/yyyy HH:mm", { locale: es })
                                            : '-'
                                        }
                                    </TableCell>
                                    <TableCell>{session.opener?.full_name || 'Desconocido'}</TableCell>
                                    <TableCell>${session.initial_cash}</TableCell>
                                    <TableCell>
                                        {session.final_cash !== null ? `$${session.final_cash}` : '-'}
                                    </TableCell>
                                    <TableCell>
                                        {session.difference !== null ? (
                                            <span className={cn(
                                                "font-bold flex items-center gap-1",
                                                session.difference === 0 ? "text-green-600" :
                                                session.difference > 0 ? "text-blue-600" : "text-red-600"
                                            )}>
                                                {session.difference === 0 && <CheckCircle2 className="h-4 w-4" />}
                                                {session.difference !== 0 && <AlertCircle className="h-4 w-4" />}
                                                {session.difference > 0 ? "+" : ""}{session.difference}
                                            </span>
                                        ) : '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {sessions.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Inbox className="h-8 w-8 opacity-50" />
                                            <p>No hay registros de caja encontrados.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <CashSessionDetails 
                session={selectedSession} 
                open={!!selectedSession} 
                onOpenChange={(open) => !open && setSelectedSession(null)} 
            />
        </div>
    )
}
