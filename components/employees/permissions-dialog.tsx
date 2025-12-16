"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Shield, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"

interface PermissionsDialogProps {
    employeeId: string // This is the user_id (profile id)
    employeeName: string
    kioskId: string
    trigger?: React.ReactNode
}

type PermissionsState = {
    view_dashboard: boolean
    view_finance: boolean
    manage_products: boolean
    view_costs: boolean
    manage_stock: boolean
    manage_members: boolean
    view_reports: boolean
}

const DEFAULT_PERMISSIONS: PermissionsState = {
    view_dashboard: false,
    view_finance: false,
    manage_products: false,
    view_costs: false,
    manage_stock: true,
    manage_members: false,
    view_reports: false
}

export function PermissionsDialog({ employeeId, employeeName, kioskId, trigger }: PermissionsDialogProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [permissions, setPermissions] = useState<PermissionsState>(DEFAULT_PERMISSIONS)

    // Load permissions when dialog opens
    useEffect(() => {
        if (open) {
            loadPermissions()
        }
    }, [open])

    const loadPermissions = async () => {
        setIsLoading(true)
        const { data, error } = await supabase
            .from('kiosk_members')
            .select('permissions, role')
            .eq('kiosk_id', kioskId)
            .eq('user_id', employeeId)
            .single()

        if (error) {
            console.error(error)
            toast.error("Error al cargar permisos")
        } else {
            // Merge defaults in case new keys were added
            setPermissions({ ...DEFAULT_PERMISSIONS, ...(data.permissions || {}) })
        }
        setIsLoading(false)
    }

    const handleSave = async () => {
        setIsSaving(true)
        const { error } = await supabase
            .from('kiosk_members')
            .update({ permissions: permissions })
            .eq('kiosk_id', kioskId)
            .eq('user_id', employeeId)

        if (error) {
            toast.error("Error al guardar permisos")
        } else {
            toast.success("Permisos actualizados")
            setOpen(false)
        }
        setIsSaving(false)
    }

    const toggle = (key: keyof PermissionsState) => {
        setPermissions(prev => ({ ...prev, [key]: !prev[key] }))
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm" className="w-full mt-2">
                        <Shield className="h-4 w-4 mr-2" />
                        Permisos
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Permisos de Acceso</DialogTitle>
                    <DialogDescription>
                        Configura qué puede hacer {employeeName} en este kiosco.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <Label>Panel de Control</Label>
                                <span className="text-xs text-muted-foreground">Ver ventas del día y gráficas</span>
                            </div>
                            <Switch checked={permissions.view_dashboard} onCheckedChange={() => toggle('view_dashboard')} />
                        </div>
                        
                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <Label>Ver Finanzas</Label>
                                <span className="text-xs text-muted-foreground">Acceso a Caja, Gastos y Balance</span>
                            </div>
                            <Switch checked={permissions.view_finance} onCheckedChange={() => toggle('view_finance')} />
                        </div>

                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <Label>Administrar Productos</Label>
                                <span className="text-xs text-muted-foreground">Crear, editar y eliminar productos</span>
                            </div>
                            <Switch checked={permissions.manage_products} onCheckedChange={() => toggle('manage_products')} />
                        </div>

                        <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <Label>Ver Costos</Label>
                                <span className="text-xs text-muted-foreground">Ver precio de costo y ganancia</span>
                            </div>
                            <Switch checked={permissions.view_costs} onCheckedChange={() => toggle('view_costs')} />
                        </div>

                         <div className="flex items-center justify-between space-x-2">
                            <div className="flex flex-col space-y-1">
                                <Label>Gestionar Stock</Label>
                                <span className="text-xs text-muted-foreground">Ajustar stock e inventario</span>
                            </div>
                            <Switch checked={permissions.manage_stock} onCheckedChange={() => toggle('manage_stock')} />
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button type="submit" onClick={handleSave} disabled={isSaving || isLoading}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar Cambios
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
