"use client"

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { Product } from "@/types/inventory";
import { CreateProductDialog } from "@/components/inventory/create-product-dialog";
import { CsvActions } from "@/components/inventory/csv-actions";
import { SeedButton } from "@/components/inventory/seed-button";
import { useState, useEffect } from "react";

export default function InventoryPage() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchProducts(page);
  }, [page]);

  async function fetchProducts(pageIndex: number) {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
         // Get total count
         const { count: total, error: countError } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
         
         if (total !== null) setCount(total);

         // Get paginated data
         const from = pageIndex * ITEMS_PER_PAGE;
         const to = from + ITEMS_PER_PAGE - 1;

         const { data: products } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to);
         
         if (products) {
            setProductList(products as Product[]);
         }
    }
    setLoading(false);
  }

  // ... rest of the render

  return (
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* ... Header and controls ... */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
            <p className="text-muted-foreground">Gestiona tus productos y stock.</p>
          </div>
          <div className="flex gap-2">
              <SeedButton />
              <CsvActions products={productList} />
              <CreateProductDialog />
          </div>
        </div>

        <div className="flex items-center space-x-2">
           {/* ... Search ... */}
           <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input
               type="search"
               placeholder="Buscar por nombre o código..."
               className="pl-8"
             />
           </div>
        </div>

        <div className="border rounded-md">
          <Table>
             {/* ... Table Header ... */}
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Imagen</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Precio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    Cargando productos...
                  </TableCell>
                </TableRow>
              ) : productList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No hay productos cargados.
                  </TableCell>
                </TableRow>
              ) : (
                  productList.map((product) => {
                      const isLowStock = product.stock <= (product.min_stock ?? 5);
                      return (
                      <TableRow key={product.id} className={isLowStock ? "bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40" : ""}>
                          <TableCell>
                            {product.image_url ? (
                               /* eslint-disable-next-line @next/next/no-img-element */
                              <img 
                                src={product.image_url} 
                                alt={product.name} 
                                className="h-10 w-10 rounded-md object-cover" 
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {product.name}
                            {isLowStock && <span className="ml-2 text-xs text-red-600 dark:text-red-400 font-bold">(Bajo Stock)</span>}
                          </TableCell>
                          <TableCell>{product.barcode || '-'}</TableCell>
                          <TableCell className={isLowStock ? "text-red-600 dark:text-red-400 font-bold" : ""}>{product.stock}</TableCell>
                          <TableCell className="text-right text-muted-foreground">${product.cost || 0}</TableCell>
                          <TableCell className="text-right font-bold">${product.price}</TableCell>
                      </TableRow>
                  )})
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-end space-x-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
            >
                Anterior
            </Button>
            <div className="text-sm text-muted-foreground">
                Página {page + 1} de {Math.ceil(count / ITEMS_PER_PAGE) || 1}
            </div>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * ITEMS_PER_PAGE >= count || loading}
            >
                Siguiente
            </Button>
        </div>
      </div>
  );
}
