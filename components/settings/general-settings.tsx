"use client"

import { useState, useEffect } from "react"
// import { useUser } from "@/hooks/use-user"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Store, Users, Lock, UserCog, Shield } from "lucide-react"
import { CreateKioskDialog } from "@/components/layout/create-kiosk-dialog"
import { InviteSellerDialog } from "@/components/employees/invite-seller-dialog"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { PermissionsDialog } from "@/components/employees/permissions-dialog"
import { ChangePasswordDialog } from "@/components/employees/change-password-dialog"
import { EditKioskDialog } from "@/components/settings/edit-kiosk-dialog"
import { toast } from "sonner"

export function GeneralSettings() {
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const { allKiosks } = useKiosk()
    const [employees, setEmployees] = useState<any[]>([])

    // Password state
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [updatingPassword, setUpdatingPassword] = useState(false)

    useEffect(() => {
        async function loadData() {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)

            if (user) {
                // Fetch employees (kiosk members with role seller)
                // We show ALL employees across all owned kiosks
                const ownedKioskIds = allKiosks.filter(k => k.role === 'owner').map(k => k.id)
                if (ownedKioskIds.length > 0) {
                    const { data: members } = await supabase
                        .from('kiosk_members')
                        .select('*, profile:profiles(*), kiosk:kiosks(name)')
                        .in('kiosk_id', ownedKioskIds)
                        .eq('role', 'seller')
                    
                    setEmployees(members || [])
                }
            }
            setLoading(false)
        }
        loadData()
    }, [allKiosks])

    const handlePasswordUpdate = async () => {
        if (!password) return
        if (password !== confirmPassword) {
            toast.error("Las contraseñas no coinciden")
            return
        }
        if (password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres")
            return
        }

        setUpdatingPassword(true)
        const { error } = await supabase.auth.updateUser({ password })
        
        if (error) {
            toast.error("Error al actualizar contraseña")
        } else {
            toast.success("Contraseña actualizada correctamente")
            setPassword("")
            setConfirmPassword("")
        }
        setUpdatingPassword(false)
    }

    if (loading) {
        return <div className="p-4">Cargando información...</div>
    }

    // Filter to only owned kiosks for management
    const ownedKiosks = allKiosks.filter(k => k.role === 'owner')

    return (
        <div className="space-y-6">
            
            {/* PROFILE SECTION */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <UserCog className="h-5 w-5 text-primary" />
                        <CardTitle>Mi Perfil</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input value={user?.email || ""} disabled readOnly className="bg-muted" />
                    </div>
                    {/* Add Full Name edit here later if requested */}
                </CardContent>
            </Card>

            {/* KIOSKS SECTION */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <Store className="h-5 w-5 text-primary" />
                            <CardTitle>Mis Kioscos</CardTitle>
                        </div>
                        <CardDescription>Gestiona tus sucursales.</CardDescription>
                    </div>
                    <CreateKioskDialog />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {ownedKiosks.length === 0 && (
                            <p className="text-sm text-muted-foreground">No tienes kioscos propios.</p>
                        )}
                        {ownedKiosks.map(kiosk => (
                            <div key={kiosk.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                        <Store className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{kiosk.name}</p>
                                        <Badge variant="outline">Propietario</Badge>
                                    </div>
                                </div>
                                <EditKioskDialog kiosk={kiosk} />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* TEAM SECTION */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                     <div>
                        <div className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            <CardTitle>Equipo</CardTitle>
                        </div>
                        <CardDescription>Usuarios con acceso a tus kioscos.</CardDescription>
                    </div>
                    {/* Reusing the Invite Dialog which has limits! */}
                    <InviteSellerDialog kiosks={ownedKiosks} onAdded={() => window.location.reload()} />
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {employees.length === 0 && (
                            <p className="text-sm text-muted-foreground">No tienes empleados registrados.</p>
                        )}
                        {employees.map((member: any) => (
                            <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-secondary rounded-full flex items-center justify-center font-bold">
                                        {(member.profile?.full_name || member.profile?.email || "U")[0].toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{member.profile?.full_name || "Sin nombre"}</p>
                                        <p className="text-sm text-muted-foreground truncate">{member.profile?.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <Badge variant="secondary" className="hidden sm:inline-flex mr-1 max-w-[120px] truncate">
                                        {member.kiosk?.name}
                                    </Badge>
                                    
                                    <ChangePasswordDialog 
                                        userId={member.user_id}
                                        userName={member.profile?.full_name || "Usuario"}
                                    />

                                    <PermissionsDialog 
                                        employeeId={member.user_id} 
                                        employeeName={member.profile?.full_name || "Sin nombre"}
                                        kioskId={member.kiosk_id}
                                        trigger={
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <Shield className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        }
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* SECURITY SECTION */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                         <Lock className="h-5 w-5 text-primary" />
                        <CardTitle>Seguridad</CardTitle>
                    </div>
                    <CardDescription>Actualizar contraseña.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label>Nueva Contraseña</Label>
                        <Input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Confirmar Contraseña</Label>
                        <Input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                        />
                    </div>
                    <Button onClick={handlePasswordUpdate} disabled={updatingPassword || !password}>
                        {updatingPassword ? "Actualizando..." : "Actualizar Contraseña"}
                    </Button>
                </CardContent>
            </Card>

        </div>
    )
}
