"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Trash2, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { cancelInvitation } from "@/app/actions/invitations"
import { toast } from "sonner"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Invitation {
  id: string
  email: string
  role: string
  created_at: string
  expires_at: string
  kiosk_id: string
}

interface PendingInvitationsListProps {
  invitations: Invitation[]
}

export function PendingInvitationsList({ invitations }: PendingInvitationsListProps) {
  const { currentKiosk } = useKiosk()
  const [isCancelling, setIsCancelling] = useState<string | null>(null)

  if (!currentKiosk) return null
  const isOwner = currentKiosk.role === 'owner'
  
  if (!isOwner) return null

  const filteredInvites = invitations.filter(i => i.kiosk_id === currentKiosk.id)

  if (filteredInvites.length === 0) return null

  const handleCancel = async (id: string) => {
    setIsCancelling(id)
    try {
      const result = await cancelInvitation(id)
      if (result.success) {
        toast.success("Invitación revocada correctamente")
      } else {
        toast.error("Error al revocar: " + result.error)
      }
    } catch (error: any) {
      toast.error("Error al revocar: " + error.message)
    } finally {
      setIsCancelling(null)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {filteredInvites.map(invite => {
        const isExpired = new Date() > new Date(invite.expires_at)
        
        return (
          <Card key={invite.id} className="border-dashed border-muted-foreground/50 bg-muted/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-bold text-muted-foreground">
                Pendiente de aceptar
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="text-sm text-foreground space-y-1 mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> 
                  <span className="font-medium">{invite.email}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="p-2 bg-muted/50 rounded flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">Rol</span>
                  <span className="font-semibold text-sm">
                    {invite.role === 'owner' ? 'Dueño' : 'Vendedor'}
                  </span>
                </div>
                <div className="p-2 bg-muted/50 rounded flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold">Expira</span>
                  <span className="font-semibold text-sm flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {isExpired ? 'Expirada' : formatDistanceToNow(new Date(invite.expires_at), { addSuffix: true, locale: es })}
                  </span>
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-2">
                      <Trash2 className="h-4 w-4" />
                      Revocar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Revocar invitación?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción invalidará el enlace enviado a <strong>{invite.email}</strong> y no podrá ser utilizado.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={(e) => {
                          e.preventDefault()
                          handleCancel(invite.id)
                        }}
                        disabled={isCancelling === invite.id}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        {isCancelling === invite.id ? 'Revocando...' : 'Sí, revocar'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
