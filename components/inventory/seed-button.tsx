"use client"

import { Button } from "@/components/ui/button"
import { supabase } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Database } from "lucide-react"

export function SeedButton() {
  const handleSeed = async () => {
    const products = [
      { name: "Coca Cola Original 2.25L", price: 2800, cost: 2100, stock: 24, barcode: "7790895000997" },
      { name: "Agua Mineral Villavicencio 1.5L", price: 1200, cost: 800, stock: 36, barcode: "7790480008581" },
      { name: "Galletitas Oreo 117g", price: 1500, cost: 1100, stock: 48, barcode: "7622300720462" },
      { name: "Cerveza Andes Origen Rubia 473ml", price: 1800, cost: 1350, stock: 120, barcode: "7791234567890" },
      { name: "Yerba Mate Playadito 500g", price: 2600, cost: 2000, stock: 20, barcode: "7792222000018" },
      { name: "Alfajor Guaymallén Dulce de Leche", price: 400, cost: 200, stock: 200, barcode: "7791234567891" },
      { name: "Chicles Beldent Menta", price: 300, cost: 150, stock: 50, barcode: "7791234567892" },
      { name: "Fernet Branca 750ml", price: 9500, cost: 7800, stock: 12, barcode: "7790895001000" },
      { name: "Pan Lactal Blanco 550g", price: 2200, cost: 1800, stock: 15, barcode: "7791234567893" },
      { name: "Leche La Serenisima 1L", price: 1400, cost: 1100, stock: 60, barcode: "7793940305009" },
    ]

    const { error } = await supabase.from('products').insert(products)
    
    if (error) {
      toast.error("Error al crear productos: " + error.message)
    } else {
      toast.success("Productos agregados correctamente")
      window.location.reload()
    }
  }

  return (
    <Button onClick={handleSeed} variant="outline" className="gap-2">
      <Database className="w-4 h-4" />
      Cargar Datos Prueba
    </Button>
  )
}
