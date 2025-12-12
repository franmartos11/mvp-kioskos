"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const formSchema = z.object({
  name: z.string().min(2, {
    message: "El nombre debe tener al menos 2 caracteres.",
  }),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  visit_days: z.string().optional(),
})

interface AddSupplierDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    supplierToEdit?: any | null
}

export function AddSupplierDialog({ open, onOpenChange, onSuccess, supplierToEdit }: AddSupplierDialogProps) {
    const [loading, setLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            contact_name: "",
            phone: "",
            email: "",
            address: "",
            visit_days: "",
        },
    })

    useEffect(() => {
        if (supplierToEdit) {
            form.reset({
                name: supplierToEdit.name,
                contact_name: supplierToEdit.contact_name || "",
                phone: supplierToEdit.phone || "",
                email: supplierToEdit.email || "",
                address: supplierToEdit.address || "",
                visit_days: supplierToEdit.visit_days || "",
            })
        } else {
            form.reset({
                 name: "",
                 contact_name: "",
                 phone: "",
                 email: "",
                 address: "",
                 visit_days: "",
            })
        }
    }, [supplierToEdit, open, form])

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setLoading(true)
        try {
            // Get current kiosk (assuming user has one, or use a context)
            // For now, assume we fetch the first kiosk of the user or rely on backend default if not strict.
            // But table requires kiosk_id.
            // We fetch the kiosk_id first.
            
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Get a valid kiosk for this user. TODO: Better kiosk selection context.
            const { data: kiosks } = await supabase.from('kiosk_members').select('kiosk_id').eq('user_id', user.id).limit(1)
            const kioskId = kiosks?.[0]?.kiosk_id

            if (!kioskId) {
                toast.error("No tienes un kiosco asignado")
                setLoading(false)
                return
            }

            const payload = {
                ...values,
                email: values.email === "" ? null : values.email,
                phone: values.phone === "" ? null : values.phone,
                contact_name: values.contact_name === "" ? null : values.contact_name,
                address: values.address === "" ? null : values.address,
                visit_days: values.visit_days === "" ? null : values.visit_days,
            }

            if (supplierToEdit) {
                const { error } = await supabase
                    .from('suppliers')
                    .update(payload)
                    .eq('id', supplierToEdit.id)
                
                if (error) throw error
                toast.success("Proveedor actualizado")
            } else {
                const { error } = await supabase
                    .from('suppliers')
                    .insert({
                        ...payload,
                        kiosk_id: kioskId,
                        user_id: user.id
                    })

                if (error) throw error
                toast.success("Proveedor creado")
            }

            onSuccess()
            onOpenChange(false)
        } catch (error) {
            console.error(error)
            toast.error("Error al guardar proveedor")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{supplierToEdit ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
                    <DialogDescription>
                        Ingresa los datos del proveedor.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre de la Empresa</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Distribuidora X" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                             <FormField
                                control={form.control}
                                name="contact_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contacto</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Juan Pérez" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Teléfono</FormLabel>
                                        <FormControl>
                                            <Input placeholder="11 1234..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                         <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="contacto@empresa.com" {...field} />
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
                                        <Textarea placeholder="Calle Falsa 123" {...field} className="resize-none h-18" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="visit_days"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Días de Visita</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej: Lunes y Jueves" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : "Guardar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
