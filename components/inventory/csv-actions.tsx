"use client"

import { ChangeEvent, useState } from "react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { Download, Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { supabase } from "@/utils/supabase/client"
import { Product } from "@/types/inventory"

export function CsvActions({ products, kioskId }: { products: Product[], kioskId: string }) {
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

  const processData = async (rows: any[]) => {
    try {
      // 1. Obtener todas las categorías del kiosco para mapear nombres a IDs
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('kiosk_id', kioskId)

      const categoryMap = new Map((categories || []).map(c => [c.name.toLowerCase(), c.id]))
      const newCategories = new Set<string>()

      // 2. Mapear y recolectar categorías nuevas
      const preMappedProducts = rows.map((row) => {
        // Mapeo inteligente de campos según el Excel de la dueña
        const name = row.name || row.Nombre || row.nombre || "Sin Nombre"
        const barcode = row.barcode || row.Codigo || row.codigo || row["Código"] || null
        const price = parseFloat(row.price || row.Precio || row["Precio unitario"] || row.precio || "0")
        const cost = parseFloat(row.cost || row.Costo || row["Costo unitario"] || row.costo || "0")
        const stock = parseInt(row.stock || row.Stock || row.Cant || row["Cant."] || row.stock || "0")
        const categoryName = row.category || row.Categoría || row["Categoría"] || row.categoria || null
        const description = row.description || row.Notas || row.notas || row.description || null

        return { name, barcode, price, cost, stock, categoryName, description, kiosk_id: kioskId }
      })

      // Identificar categorías que no existen
      preMappedProducts.forEach(p => {
        if (p.categoryName && !categoryMap.has(p.categoryName.toLowerCase())) {
          newCategories.add(p.categoryName)
        }
      })

      // 3. Crear categorías faltantes
      if (newCategories.size > 0) {
        const categoriesToInsert = Array.from(newCategories).map(name => ({
          name,
          kiosk_id: kioskId
        }))

        const { data: insertedCats, error: catError } = await supabase
          .from('categories')
          .insert(categoriesToInsert)
          .select()

        if (!catError && insertedCats) {
          insertedCats.forEach(c => categoryMap.set(c.name.toLowerCase(), c.id))
        }
      }

      // 4. Asignar IDs de categorías finales
      const productsToInsert = preMappedProducts.map(({ categoryName, ...rest }) => ({
        ...rest,
        category_id: categoryName ? categoryMap.get(categoryName.toLowerCase()) : null
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
    }
  }

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data),
        error: (error) => {
          console.error(error)
          toast.error("Error al leer el archivo CSV")
          setIsImporting(false)
        }
      })
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const workbook = XLSX.read(data, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const json = XLSX.utils.sheet_to_json(worksheet)
          processData(json)
        } catch (error) {
          console.error(error)
          toast.error("Error al leer el archivo Excel")
          setIsImporting(false)
        }
      }
      reader.onerror = () => {
        toast.error("Error al leer el archivo")
        setIsImporting(false)
      }
      reader.readAsBinaryString(file)
    } else {
      toast.error("Formato de archivo no soportado. Use CSV o Excel.")
      setIsImporting(false)
    }

    // Limpiar input
    event.target.value = ""
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={handleExport}>
        <Download className="mr-2 h-4 w-4" /> Exportar CSV
      </Button>
      <div className="relative">
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
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
          Importar Datos
        </Button>
      </div>
    </div>
  )
}
