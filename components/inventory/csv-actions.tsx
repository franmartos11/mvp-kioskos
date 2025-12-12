"use client"

import { ChangeEvent, useState } from "react"
import Papa from "papaparse"
import { Download, Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { supabase } from "@/utils/supabase/client"
import { Product } from "@/types/inventory"

export function CsvActions({ products }: { products: Product[] }) {
  const [isImporting, setIsImporting] = useState(false)
  const router = useRouter()

  const handleExport = () => {
    const csv = Papa.unparse(products.map(({ id, created_at, image_url, ...rest }) => rest))
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "inventario_kioskapp.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data as any[]
          // Mapear y validar data básica
          const productsToInsert = rows.map((row) => ({
            name: row.name || row.Nombre || "Sin Nombre",
            barcode: row.barcode || row.Codigo || null,
            price: parseFloat(row.price || row.Precio || "0"),
            cost: parseFloat(row.cost || row.Costo || "0"),
            stock: parseInt(row.stock || row.Stock || "0"),
          }))

          if (productsToInsert.length === 0) {
            toast.error("El archivo parece estar vacío o mal formateado")
            return
          }

          const { error } = await supabase.from("products").insert(productsToInsert)

          if (error) throw error

          toast.success(`${productsToInsert.length} productos importados correctamente`)
          router.refresh()
        } catch (error) {
          console.error(error)
          toast.error("Error al importar productos")
        } finally {
          setIsImporting(false)
          // Limpiar input
          event.target.value = ""
        }
      },
      error: (error) => {
        console.error(error)
        toast.error("Error al leer el archivo CSV")
        setIsImporting(false)
      }
    })
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleExport}>
        <Download className="mr-2 h-4 w-4" /> Exportar CSV
      </Button>
      <div className="relative">
        <input
          type="file"
          accept=".csv"
          onChange={handleImport}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isImporting}
        />
        <Button variant="outline" disabled={isImporting}>
          {isImporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Importar CSV
        </Button>
      </div>
    </div>
  )
}
