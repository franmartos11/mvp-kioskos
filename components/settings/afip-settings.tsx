"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck, CalendarClock } from "lucide-react"

export function AfipSettings() {
    return (
        <div className="space-y-6">
            <Card className="opacity-80">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                             <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                                Configuración ARCA (AFIP)
                             </CardTitle>
                             <CardDescription>
                                Conecta tu Kiosco con AFIP para emitir facturas electrónicas válidas.
                             </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/20 rounded-xl border border-dashed">
                        <CalendarClock className="h-16 w-16 text-muted-foreground/40 mb-4" />
                        <h3 className="text-lg font-semibold">Próximamente disponible</h3>
                        <p className="text-muted-foreground max-w-sm mt-2">
                            Estamos finalizando la integración oficial. Pronto podrás subir tus certificados digitales y facturar automáticamente.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
