"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Trash2, Save } from "lucide-react"
import { toast } from "sonner"
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { supabase } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
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

const editKioskSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  address: z.string().optional(),
})

interface EditKioskDialogProps {
    kiosk: {
        id: string
        name: string
        address?: string | null
    }
}

export function EditKioskDialog({ kiosk }: EditKioskDialogProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const form = useForm<z.infer<typeof editKioskSchema>>({
    resolver: zodResolver(editKioskSchema),
    defaultValues: {
      name: kiosk.name,
      address: kiosk.address || "",
    },
  })

  async function onSubmit(values: z.infer<typeof editKioskSchema>) {
    try {
      const { error } = await supabase
        .from("kiosks")
        .update({
          name: values.name,
          address: values.address,
        })
        .eq('id', kiosk.id)

      if (error) throw error

      toast.success("Kiosco actualizado")
      setOpen(false)
      router.refresh()
      
      // Delay reload to let toast show? Or use client state.
      // Reload ensures all contexts update.
      setTimeout(() => window.location.reload(), 500)

    } catch (error) {
      console.error(error)
      toast.error("Error al actualizar el kiosco")
    }
  }

  async function handleDelete() {
    try {
        const { deleteKioskAction } = await import("@/app/actions/delete-kiosk")
        
        toast.promise(deleteKioskAction(kiosk.id), {
            loading: 'Eliminando kiosco y sus datos...',
            success: (data) => {
                if (data.error) throw new Error(data.error)
                setOpen(false)
                router.refresh()
                setTimeout(() => window.location.reload(), 1000)
                return "Kiosco eliminado correctamente"
            },
            error: (err) => {
                return err.message
            }
        })

    } catch (error: any) {
        console.error(error)
        toast.error("Error inesperado al eliminar")
    }
  }

  const [confirmName, setConfirmName] = useState("")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">Editar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Kiosco</DialogTitle>
          <DialogDescription>
            Modifica los datos de tu sucursal.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del Kiosco" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección</FormLabel>
                  <FormControl>
                    <Input placeholder="Dirección del local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="flex justify-between sm:justify-between items-center gap-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" size="sm" onClick={() => setConfirmName("")}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Está seguro? Esta acción es irreversible.</AlertDialogTitle>
                            <AlertDialogDescription>
                                Se eliminarán permanentemente el kiosco <strong>{kiosk.name}</strong> y todos sus datos asociados (ventas, stock, empleados).
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        
                        <div className="space-y-2 py-4">
                            <label className="text-sm font-medium text-foreground">
                                Escribe <span className="font-bold select-all">{kiosk.name}</span> para confirmar:
                            </label>
                            <Input 
                                value={confirmName}
                                onChange={(e) => setConfirmName(e.target.value)}
                                placeholder={kiosk.name}
                                className="font-mono"
                            />
                        </div>

                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={(e) => {
                                    if (confirmName !== kiosk.name) {
                                        e.preventDefault()
                                        return
                                    }
                                    handleDelete()
                                }} 
                                disabled={confirmName !== kiosk.name}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirmar Eliminación
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Guardar Cambios
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
