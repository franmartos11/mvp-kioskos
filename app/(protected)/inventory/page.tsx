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
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { updateProductPricesBulk, updateProductPricesBySupplier } from "@/app/actions/bulk-actions";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ChevronDown, BoxSelect, Users, History } from "lucide-react";
import { BulkSupplierDialog } from "@/components/inventory/bulk-supplier-dialog";
import { BulkPriceDialog } from "@/components/inventory/bulk-price-dialog";
import { PriceHistoryDialog } from "@/components/inventory/price-history-dialog";
import { ProductDetailsDialog } from "@/components/inventory/product-details-dialog";


export default function InventoryPage() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const ITEMS_PER_PAGE = 10;
  
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Details Modal State
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);

  const handleProductClick = (product: Product) => {
    if (!isSelectionMode) {
      setSelectedProductForDetails(product);
      setDetailsOpen(true);
    }
  };

  const toggleProduct = (id: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedProducts(newSelected);
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(selectedProducts);
      productList.forEach(p => newSelected.add(p.id));
      setSelectedProducts(newSelected);
    } else {
      const newSelected = new Set(selectedProducts);
      productList.forEach(p => newSelected.delete(p.id));
      setSelectedProducts(newSelected);
    }
  };

  const handleBulkUpdate = async (percentage: number) => {
    const ids = Array.from(selectedProducts);
    const result = await updateProductPricesBulk(ids, percentage);
    if (result.error) {
      toast.error(result.error);
    } else {
      if ((result as any).warning) {
          toast.warning((result as any).warning);
      } else {
          toast.success("Precios actualizados correctamente");
      }
      fetchProducts(page);
      setSelectedProducts(new Set());
    }
  };

  const handleSupplierUpdate = async (supplierId: string, percentage: number) => {
    const result = await updateProductPricesBySupplier(supplierId, percentage);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Precios actualizados para ${result.count} productos`);
      fetchProducts(page);
    }
  };


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

  return (
      <div className="p-4 w-full space-y-6">
        {/* ... Header and controls ... */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
            <p className="text-muted-foreground">Gestiona tus productos y stock.</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Acciones Masivas <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Actualizar Precios</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowSupplierDialog(true)}>
                    <Users className="mr-2 h-4 w-4" /> Por Proveedor
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowHistoryDialog(true)}>
                    <History className="mr-2 h-4 w-4" /> Historial de Cambios
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsSelectionMode(!isSelectionMode)}>
                    <BoxSelect className="mr-2 h-4 w-4" /> {isSelectionMode ? "Ocultar Selección" : "Selección Manual"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

             {isSelectionMode && selectedProducts.size > 0 && (
                 <Button 
                    variant="secondary" 
                    onClick={() => setShowBulkDialog(true)}
                 >
                    Actualizar {selectedProducts.size} productos
                 </Button>
             )}

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

        <Card>
            <CardHeader>
                <CardTitle>Productos</CardTitle>
                <CardDescription>
                    Lista completa de productos en inventario.
                </CardDescription>
            </CardHeader>
            <CardContent>
            <Table>
             {/* ... Table Header ... */}
            <TableHeader>
              <TableRow>
                {isSelectionMode && (
                  <TableHead className="w-[40px]">
                      <Checkbox 
                          checked={productList.length > 0 && productList.every(p => selectedProducts.has(p.id))}
                          onCheckedChange={(checked) => toggleAll(checked as boolean)}
                      />
                  </TableHead>
                )}
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
                  <TableCell colSpan={8} className="h-24 text-center">
                    Cargando productos...
                  </TableCell>
                </TableRow>
              ) : productList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    No hay productos cargados.
                  </TableCell>
                </TableRow>
              ) : (
                  productList.map((product) => {
                      const isLowStock = product.stock <= (product.min_stock ?? 5);
                      return (
                      <TableRow 
                        key={product.id} 
                        className={`transition-colors ${isSelectionMode ? 'hover:bg-muted/50' : 'cursor-pointer hover:bg-muted/50'}`}
                        onClick={() => handleProductClick(product)}
                      >
                          {isSelectionMode && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox 
                                    checked={selectedProducts.has(product.id)}
                                    onCheckedChange={() => toggleProduct(product.id)}
                                />
                            </TableCell>
                          )}
                          <TableCell>
                            {product.image_url ? (
                               /* eslint-disable-next-line @next/next/no-img-element */
                              <img 
                                src={product.image_url} 
                                alt={product.name} 
                                className="h-10 w-10 rounded-md object-cover border" 
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {product.name}
                            {isLowStock && <Badge variant="destructive" className="ml-2">Bajo Stock</Badge>}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{product.barcode || '-'}</TableCell>
                          <TableCell>
                              {isLowStock ? (
                                  <span className="text-red-600 dark:text-red-400 font-bold">{product.stock}</span>
                              ) : (
                                  <span>{product.stock}</span>
                              )}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">${product.cost || 0}</TableCell>
                          <TableCell className="text-right font-bold text-lg">${product.price}</TableCell>
                      </TableRow>
                  )})
              )}
            </TableBody>
          </Table>
          </CardContent>
        </Card>
        
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

        <BulkPriceDialog 
          open={showBulkDialog} 
          onOpenChange={setShowBulkDialog}
          selectedCount={selectedProducts.size}
          onConfirm={handleBulkUpdate}
        />

        <BulkSupplierDialog
          open={showSupplierDialog}
          onOpenChange={setShowSupplierDialog}
          onConfirm={handleSupplierUpdate}
        />

        <PriceHistoryDialog 
            open={showHistoryDialog}
            onOpenChange={setShowHistoryDialog}
        />

        <ProductDetailsDialog 
           open={detailsOpen}
           onOpenChange={setDetailsOpen}
           product={selectedProductForDetails}
           onProductUpdated={() => fetchProducts(page)}
        />
      </div>
  );
}
