"use client"

import { useState, useEffect } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2, Plus, ScanBarcode, Upload, Image as ImageIcon } from "lucide-react"
import { BarcodeScanner } from "./barcode-scanner"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/utils/supabase/client"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { useSubscription } from "@/hooks/use-subscription"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import Link from "next/link"

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
  category_id: z.string().optional(),
  is_weighable: z.boolean().optional().default(false),
})

type ProductFormValues = z.infer<typeof productSchema>

import { Product } from "@/types/inventory"

interface CreateProductDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  productToEdit?: Product | null
}

export function CreateProductDialog({ 
  open: controlledOpen, 
  onOpenChange, 
  onSuccess,
  productToEdit 
}: CreateProductDialogProps = {}) {
  const { currentKiosk } = useKiosk()
  const queryClient = useQueryClient()
  const [internalOpen, setInternalOpen] = useState(false)
  
  // Use controlled state if provided, otherwise internal
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange : setInternalOpen

  const [showScanner, setShowScanner] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const { plan, isPro } = useSubscription()
  const [productCount, setProductCount] = useState(0)
  const [limitReached, setLimitReached] = useState(false)
  
  useEffect(() => {
    async function checkLimit() {
        if (!currentKiosk || isPro) {
            setLimitReached(false)
            return
        }
        
        const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('kiosk_id', currentKiosk.id)
            
        setProductCount(count || 0)
        
        if (plan === 'free' && (count || 0) >= 50) {
            setLimitReached(true)
        } else {
            setLimitReached(false)
        }
    }
    
    if (open) checkLimit()
  }, [open, currentKiosk, isPro, plan])
  
  useEffect(() => {
    if (open && productToEdit) {
        form.reset({
            name: productToEdit.name,
            barcode: productToEdit.barcode || "",
            price: productToEdit.price,
            cost: productToEdit.cost,
            stock: productToEdit.stock,
            min_stock: productToEdit.min_stock || 5,
            image_url: productToEdit.image_url,
            supplier_id: productToEdit.supplier_id || "",
            category_id: productToEdit.category_id || "",
            is_weighable: productToEdit.is_weighable || false,
        })
        setPreview(productToEdit.image_url)
    } else if (open && !productToEdit) {
        form.reset({
            name: "",
            barcode: "",
            price: 0,
            cost: 0,
            stock: 0,
            min_stock: 5,
            image_url: null,
            supplier_id: "",
            category_id: "",
            is_weighable: false,
        })
        setPreview(null)
    }
  }, [open, productToEdit])
  
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
      category_id: "",
      is_weighable: false,
    },
  })

  const [suppliers, setSuppliers] = useState<{id: string, name: string}[]>([])
  const [categories, setCategories] = useState<{id: string, name: string}[]>([])

  useEffect(() => {
    async function getData() {
       const { data: supData } = await supabase.from('suppliers').select('id, name').order('name')
       if (supData) setSuppliers(supData)
       
       const { data: catData } = await supabase.from('categories').select('id, name').order('name')
       if (catData) setCategories(catData)
    }
    if (open) getData()
  }, [open])

  async function onSubmit(values: z.infer<typeof productSchema>) {
    if (!currentKiosk) {
        toast.error("Debes seleccionar un kiosco para crear productos")
        return
    }

    try {
      const productData = {
          name: values.name,
          barcode: values.barcode || null,
          price: values.price,
          cost: values.cost || 0,
          stock: values.stock,
          min_stock: values.min_stock,
          image_url: values.image_url || null,
          supplier_id: (values.supplier_id === "none" || !values.supplier_id) ? null : values.supplier_id,
          category_id: (values.category_id === "none" || !values.category_id) ? null : values.category_id,
          kiosk_id: currentKiosk.id,
          is_weighable: values.is_weighable,
      }

      let error
      if (productToEdit) {
          const { error: updateError } = await supabase
              .from("products")
              .update(productData)
              .eq('id', productToEdit.id)
          error = updateError
      } else {
          const { error: insertError } = await supabase
            .from("products")
            .insert(productData)
          error = insertError
      }
      
      if (error) throw error

      toast.success(productToEdit ? "Producto actualizado" : "Producto creado correctamente")
      
      if (setOpen) setOpen(false) // Safe call if using internal/external toggle
      
      // Invalidate TanStack Query cache so inventory & POS refresh automatically
      await queryClient.invalidateQueries({ queryKey: ['products'] })
      
      if (onSuccess) onSuccess()
      
      if (!productToEdit) {
          form.reset()
          setPreview(null)
      }
    } catch (error) {
      console.error(error)
      toast.error(productToEdit ? "Error al actualizar" : "Error al crear el producto")
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
          <DialogTitle>{productToEdit ? "Editar Producto" : "Crear Nuevo Producto"}</DialogTitle>
        </DialogHeader>
        
        {!productToEdit && limitReached ? (
            <div className="space-y-4 py-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Límite Alcanzado</AlertTitle>
                    <AlertDescription>
                        Los planes gratuitos solo permiten hasta 50 productos.
                    </AlertDescription>
                </Alert>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen && setOpen(false)}>Cancelar</Button>
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
            
            <FormField
              control={form.control}
              name="is_weighable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Se vende por peso</FormLabel>
                    <p className="text-[0.8rem] text-muted-foreground">
                      Activa si el producto puede venderse en fracciones (ej: 0.5 kg).
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin categoría</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor (Opcional)</FormLabel>
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
                {productToEdit ? "Actualizar Producto" : "Crear Producto"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        )}
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
