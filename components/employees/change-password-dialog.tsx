"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { resetUserPassword } from "@/app/actions/reset-password"

interface ChangePasswordDialogProps {
    userId: string
    userName: string
}

export function ChangePasswordDialog({ userId, userName }: ChangePasswordDialogProps) {
    const [open, setOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [password, setPassword] = useState("")

    const handleSave = async () => {
        if (password.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres")
            return
        }

        setIsLoading(true)
        const result = await resetUserPassword(userId, password)
        
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success(`Contraseña de ${userName} actualizada`)
            setOpen(false)
            setPassword("")
        }
        setIsLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Cambiar Contraseña</DialogTitle>
                    <DialogDescription>
                        Asigna una nueva contraseña para <strong>{userName}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Nueva Contraseña</Label>
                        <Input 
                            type="text" 
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                         <p className="text-xs text-muted-foreground">
                            Se recomienda usar una contraseña segura.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isLoading || !password}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Actualizar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
