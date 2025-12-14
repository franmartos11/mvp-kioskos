"use client"

import { useState, useEffect } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Plus, ScanBarcode, Upload, Image as ImageIcon } from "lucide-react"
import { BarcodeScanner } from "./barcode-scanner"
import { toast } from "sonner"
import { X as IconX } from "lucide-react"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useKiosk } from "@/components/providers/kiosk-provider"

// ... existing code

const productSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  barcode: z.string().optional(),
  price: z.coerce.number().min(0, "El precio no puede ser negativo"),
  cost: z.coerce.number().min(0, "El costo no puede ser negativo").optional().default(0),
  stock: z.coerce.number().int().min(0, "El stock no puede ser negativo"),
  min_stock: z.coerce.number().int().min(0).optional().default(5),
  image_url: z.string().optional().nullable(),
  supplier_id: z.string().optional(),
})

type ProductFormValues = z.infer<typeof productSchema>

export function CreateProductDialog() {
  const { currentKiosk } = useKiosk()
  const [open, setOpen] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const router = useRouter()
  
  // Remove explicit generic to allow inference and avoid "Type mismatch" with zodResolver
  const form = useForm({
    resolver: zodResolver(productSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      name: "",
      barcode: "",
      price: 0,
      cost: 0,
      stock: 0,
      min_stock: 5,
      image_url: null,
      supplier_id: "",
    },
  })

  const [suppliers, setSuppliers] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    async function getSuppliers() {
       const { data } = await supabase.from('suppliers').select('id, name').order('name')
       if (data) setSuppliers(data)
    }
    if (open) getSuppliers()
  }, [open])

  async function onSubmit(values: z.infer<typeof productSchema>) {
    if (!currentKiosk) {
        toast.error("Debes seleccionar un kiosco para crear productos")
        return
    }

    try {
      const { error } = await supabase
        .from("products")
        .insert({
          name: values.name,
          barcode: values.barcode || null,
          price: values.price,
          cost: values.cost || 0,
          stock: values.stock,
          min_stock: values.min_stock,
          image_url: values.image_url || null,
          supplier_id: (values.supplier_id === "none" || !values.supplier_id) ? null : values.supplier_id,
          kiosk_id: currentKiosk.id,
        })
      
      if (error) throw error

      toast.success("Producto creado correctamente")
      setOpen(false)
      form.reset()
      setPreview(null)
      router.refresh()
      // Optional: Explicitly refresh inventory list if passed as prop, or reliance on router.refresh
    } catch (error) {
      console.error(error)
      toast.error("Error al crear el producto")
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      if (!e.target.files || e.target.files.length === 0) return

      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      setUploading(true)

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data } = supabase.storage.from('products').getPublicUrl(filePath)
      
      form.setValue('image_url', data.publicUrl)
      setPreview(data.publicUrl)
      toast.success("Imagen cargada")
    } catch (error) {
      console.error(error)
      toast.error("Error al cargar la imagen")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo Producto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Producto</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Producto</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Coca Cola 500ml" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormItem>
              <FormLabel>Imagen del Producto</FormLabel>
                <div className="flex items-center gap-4">
                  {preview ? (
                    <div className="relative h-20 w-20 rounded-md overflow-hidden border">
                       {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-0 right-0 h-5 w-5 rounded-none"
                        onClick={() => {
                          setPreview(null)
                          form.setValue('image_url', null)
                        }}
                      >
                       <IconX className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-md border bg-muted">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                    <p className="text-[0.8rem] text-muted-foreground mt-1">
                      {uploading ? "Subiendo..." : "Formatos: JPG, PNG, WEBP"}
                    </p>
                  </div>
                </div>
            </FormItem>


            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de Barras (Opcional)</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input placeholder="Escanear..." {...field} />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowScanner(true)}
                      >
                        <ScanBarcode className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio Venta</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value as string | number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo Unitario</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value as string | number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Inicial</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value as string | number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="min_stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock Min. (Alerta)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} value={field.value as string | number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>
             <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar proveedor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin proveedor</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Crear Producto
              </Button>
            </DialogFooter>
          </form>
        </Form>
        {showScanner && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-md">
              <BarcodeScanner
                onScan={(code) => {
                  form.setValue("barcode", code)
                  setShowScanner(false)
                  toast.success("Código escaneado")
                }}
                onClose={() => setShowScanner(false)}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
