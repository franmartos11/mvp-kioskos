"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, PlusCircle, AlertCircle } from "lucide-react"
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
import { useSubscription } from "@/hooks/use-subscription"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

const kioskSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  address: z.string().optional(),
})

export function CreateKioskDialog() {
  const [open, setOpen] = useState(false)
  const [kioskCount, setKioskCount] = useState(0)
  const [limitReached, setLimitReached] = useState(false)
  const { plan, isPro, isEnterprise } = useSubscription()
  const { allKiosks } = useKiosk() // Get count from context directly? Or fetch?
  const router = useRouter()

  const form = useForm<z.infer<typeof kioskSchema>>({
    resolver: zodResolver(kioskSchema),
    defaultValues: {
      name: "",
      address: "",
    },
  })

  // Check limits when opening
  useEffect(() => {
    if (open) {
        // We can use allKiosks.length if we assume the context has all owned kiosks.
        // But context filters by role? 'allKiosks' usually returns all user has access to.
        // Let's assume for now owner=creator.
        const count = allKiosks?.filter(k => k.role === 'owner').length || 0
        setKioskCount(count)

        let limit = 1 // Free
        if (isEnterprise) limit = 999
        else if (isPro) limit = 2

        if (count >= limit) {
            setLimitReached(true)
        } else {
            setLimitReached(false)
        }
    }
  }, [open, allKiosks, plan, isPro, isEnterprise])

  async function onSubmit(values: z.infer<typeof kioskSchema>) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Create Kiosk
      const { data: kiosk, error: kioskError } = await supabase
        .from("kiosks")
        .insert({
          name: values.name,
          address: values.address,
          owner_id: user.id
        })
        .select()
        .single()

      if (kioskError) throw kioskError

      // Create User-Kiosk Relation (Owner)
      const { error: relError } = await supabase
        .from("kiosk_members")
        .insert({
            user_id: user.id,
            kiosk_id: kiosk.id,
            role: 'owner',
            permissions: {
                view_dashboard: true,
                view_finance: true,
                manage_products: true,
                view_costs: true,
                manage_stock: true,
                manage_members: true,
                view_reports: true
            }
        })
      
      if (relError) {
          console.error("Error linking owner", relError)
          // Try to cleanup kiosk if relation failed?
          await supabase.from("kiosks").delete().eq("id", kiosk.id)
          throw new Error("Error al asignar propietario: " + relError.message)
      }

      toast.success("Kiosco creado correctamente")
      setOpen(false)
      form.reset()
      router.refresh()
      window.location.reload() 

    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Error al crear el kiosco")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm w-full">
            <PlusCircle className="mr-2 h-4 w-4" />
            <span>Crear Nuevo Kiosco</span>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Kiosco</DialogTitle>
          <DialogDescription>
            Agrega una nueva sucursal o punto de venta.
          </DialogDescription>
        </DialogHeader>

        {limitReached ? (
             <div className="space-y-4 py-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Límite Alcanzado</AlertTitle>
                    <AlertDescription>
                        Tu plan actual ({plan}) solo permite {isPro ? '2' : '1'} kiosco(s).
                        Has creado {kioskCount}.
                    </AlertDescription>
                </Alert>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Link href="/settings">
                        <Button>Mejorar Plan</Button>
                    </Link>
                </div>
            </div>
        ) : (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nombre del Kiosco</FormLabel>
                    <FormControl>
                        <Input placeholder="Ej: Sucursal Centro" {...field} />
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
                    <FormLabel>Dirección (Opcional)</FormLabel>
                    <FormControl>
                        <Input placeholder="Calle 123" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Crear Kiosco
                </Button>
                </DialogFooter>
            </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
