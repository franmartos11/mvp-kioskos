"use client"

import { useState } from "react"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, LockKeyhole } from "lucide-react"

export function ChangePasswordForm() {
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [loading, setLoading] = useState(false)

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            toast.error("Las contraseñas no coinciden")
            return
        }

        if (password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres")
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            })

            if (error) {
                toast.error("Error al actualizar: " + error.message)
            } else {
                toast.success("Contraseña actualizada exitosamente")
                setPassword("")
                setConfirmPassword("")
            }
        } catch (error) {
            console.error(error)
            toast.error("Ocurrió un error inesperado")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="border-b bg-muted/40 p-6">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/30 dark:text-blue-400">
                        <LockKeyhole className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-semibold">Cambiar Contraseña</CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">
                            Asegura tu cuenta con una contraseña fuerte.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <form onSubmit={handleUpdatePassword}>
                <CardContent className="p-6 space-y-4">
                    <div className="grid gap-5">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">Nueva Contraseña</Label>
                            <Input
                                id="new-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="max-w-md"
                                placeholder="••••••••"
                                required
                            />
                            <p className="text-[0.8rem] text-muted-foreground">
                                Mínimo 6 caracteres.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                            <Input
                                id="confirm-password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="max-w-md"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="px-6 py-4 bg-muted/40 border-t flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                        La sesión se mantendrá activa después del cambio.
                    </p>
                    <Button type="submit" disabled={loading} className="min-w-[140px]">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Actualizar
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
