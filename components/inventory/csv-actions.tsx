"use client"

import { ChangeEvent, useState } from "react"
import Papa from "papaparse"
import * as XLS from "xlsx"
import { Download, Upload, Loader2, FileSpreadsheet } from "lucide-react"
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
      if (!kioskId) {
          toast.error("No hay un kiosco activo seleccionado.")
          return
      }

      // 1. Obtener todas las categorías del kiosco para mapear nombres a IDs
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .eq('kiosk_id', kioskId)

      const categoryMap = new Map((categories || []).map(c => [c.name.toLowerCase(), c.id]))
      const newCategories = new Set<string>()

      const getCategory = (r: any) => r.category || r.Category || r.Categoria || r.categoria || r['Categoría'] || r['categoría'];

      const cleanNumber = (val: string | number) => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          return parseFloat(val.toString().replace(/[^0-9.-]+/g,"")) || 0;
      };

      // 2. Mapear y recolectar categorías nuevas
      const preMappedProducts = rows.map((row) => {
        // Mapeo inteligente de campos según el Excel de la dueña
        const rawName = row.name || row.Nombre || row.nombre || row.NOMBRE || "Sin Nombre"
        const rawBarcode = row.barcode || row.Codigo || row.codigo || row.CODIGO || row["Código"] || null
        const rawPrice = row.price || row.Precio || row.precio || row.PRECIO || row['Precio unitario'] || row['precio unitario'] || row['Precio Unitario'] || "0"
        const rawCost = row.cost || row.Costo || row.costo || row.COSTO || row['Costo unitario'] || row['costo unitario'] || row['Costo Unitario'] || "0"
        const rawStock = row.stock || row.Stock || row.stock || row.STOCK || row.Cant || row["Cant."] || "0"
        const categoryName = getCategory(row)
        return { 
          name: rawName, 
          barcode: rawBarcode, 
          price: cleanNumber(rawPrice), 
          cost: cleanNumber(rawCost), 
          stock: parseInt(cleanNumber(rawStock).toString(), 10) || 0, 
          categoryName, 
          is_weighable: row.is_weighable === true || row.is_weighable === 'true' || row.Pesable === true || row.Pesable === 'true' || false,
          kiosk_id: kioskId 
        }
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

      // Split: upsert products WITH barcode (requires unique constraint on kiosk_id,barcode)
      // and plain insert products WITHOUT barcode
      const withBarcode = productsToInsert.filter(p => p.barcode)
      const withoutBarcode = productsToInsert.filter(p => !p.barcode)

      let error = null

      if (withBarcode.length > 0) {
        const { error: upsertError } = await supabase.from("products").upsert(withBarcode, {
          onConflict: 'kiosk_id,barcode',
          ignoreDuplicates: false
        })
        if (upsertError) error = upsertError
      }

      if (!error && withoutBarcode.length > 0) {
        const { error: insertError } = await supabase.from("products").insert(withoutBarcode)
        if (insertError) error = insertError
      }

      if (error) throw error

      toast.success(`${productsToInsert.length} productos importados correctamente`)
      router.refresh()
    } catch (error: any) {
      // Log all error details - Supabase errors have non-enumerable properties
      console.error('CSV Import Error:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        raw: error
      })
      const msg = error?.message || error?.details || 'Error desconocido'
      toast.error(`Error al importar: ${msg}`)
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
          const workbook = XLS.read(data, { type: 'binary' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const json = XLS.utils.sheet_to_json(worksheet)
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
          accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
