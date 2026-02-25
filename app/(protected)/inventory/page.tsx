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
import { RefreshCw, Search, Plus, Filter, MoreHorizontal, Pencil, Trash, PackageCheck, History as HistoryIcon, Image as ImageIcon } from "lucide-react";
import { useProducts } from "@/hooks/use-products";
import { supabase } from "@/utils/supabase/client";
import { Product } from "@/types/inventory";
import { CreateProductDialog } from "@/components/inventory/create-product-dialog";
import { CategoriesManager } from "@/components/inventory/categories-manager";
import { CsvActions } from "@/components/inventory/csv-actions";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { updateProductPricesBulk, updateProductPricesBySupplier, deleteProductsBulk } from "@/app/actions/bulk-actions";
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
import { ChevronDown, BoxSelect, Users, ClipboardList } from "lucide-react";
import { BulkSupplierDialog } from "@/components/inventory/bulk-supplier-dialog";
import { BulkPriceDialog } from "@/components/inventory/bulk-price-dialog";
import { PriceHistoryDialog } from "@/components/inventory/price-history-dialog";
import { ProductDetailsDialog } from "@/components/inventory/product-details-dialog";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { StockHistoryDialog } from "@/components/inventory/stock-history-dialog";
import { AuditHistoryDialog } from "@/components/inventory/audit-history-dialog";
import { BulkDeleteDialog } from "@/components/inventory/bulk-delete-dialog";
import { useKiosk } from "@/components/providers/kiosk-provider";
import { calculatePrice, PriceList } from "@/utils/pricing-engine";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { PriceSimulator } from "@/components/inventory/price-simulator"; // Removed as per user request

// ... existing imports

export default function InventoryPage() {
  const { currentKiosk } = useKiosk()
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(0)
  const ITEMS_PER_PAGE = 10

  // Use TanStack Query
  const {
    data: allProducts = [],
    isLoading: isQueryLoading,
    isError,
    error,
    refetch
  } = useProducts(currentKiosk?.id)

  // Price List View State
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [viewLimitId, setViewLimitId] = useState<string>("base") // "base" or UUID

  useEffect(() => {
    if (currentKiosk?.id) {
      supabase
        .from('price_lists')
        .select('*')
        .eq('kiosk_id', currentKiosk.id)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .then(({ data }) => {
          if (data) setPriceLists(data as any)
        })
    }
  }, [currentKiosk?.id])

  const selectedList = viewLimitId === "base" ? null : priceLists.find(l => l.id === viewLimitId) || null

  const isLoading = isQueryLoading || !currentKiosk

  useEffect(() => {
    if (isError && error) {
      toast.error("Error al cargar productos: " + error.message)
    }
  }, [isError, error])



  // Reset page when search term changes
  useEffect(() => {
    setPage(0)
  }, [searchTerm])

  // Filter products client-side for search
  const filteredProducts = allProducts.filter(product => {
    const searchLower = searchTerm.toLowerCase()
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.barcode?.toLowerCase().includes(searchLower) ||
      (product as any).category?.name?.toLowerCase().includes(searchLower)
    )
  })

  // Client-side pagination
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1
  const paginatedProducts = filteredProducts.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  )

  // Determine user role
  const isOwner = currentKiosk?.role === 'owner'

  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
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
      filteredProducts.forEach(p => newSelected.add(p.id));
      setSelectedProducts(newSelected);
    } else {
      const newSelected = new Set(selectedProducts);
      filteredProducts.forEach(p => newSelected.delete(p.id));
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
      refetch();
      setSelectedProducts(new Set());
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedProducts);
    const result = await deleteProductsBulk(ids);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${ids.length} productos eliminados correctamente`);
      refetch();
      setSelectedProducts(new Set());
    }
  };

  const handleSupplierUpdate = async (supplierId: string, percentage: number) => {
    const result = await updateProductPricesBySupplier(supplierId, percentage);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Precios actualizados para ${result.count} productos`);
      refetch();
    }
  };

  return (
    <div className="p-4 w-full space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
          <p className="text-muted-foreground">Gestiona tus productos y stock.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
           {/* 1. SELECTION ACTION (Only appears when items selected) */}
           {isSelectionMode && selectedProducts.size > 0 && isOwner && (
               <div className="flex items-center gap-2">
                   <Button 
                      variant="default" // Primary style for the main active context action
                      onClick={() => setShowBulkDialog(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                   >
                      Actualizar {selectedProducts.size} productos
                   </Button>
                   <Button
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      size="icon"
                      title="Eliminar seleccionados"
                   >
                      <Trash className="h-4 w-4" />
                   </Button>
               </div>
           )}

          {/* 2. STOCK CONTROL GROUP */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Control de Stock
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Auditorías</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => window.location.href = '/inventory/audit'}>
                <ClipboardList className="mr-2 h-4 w-4" /> Iniciar Recuento Ciego
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAuditHistory(true)}>
                <HistoryIcon className="mr-2 h-4 w-4" /> Historial de Auditorías
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 3. TOOLS / BULK ACTIONS GROUP (OWNER ONLY) */}
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <BoxSelect className="h-4 w-4" />
                  Herramientas
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Gestión</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-2">
                  <CategoriesManager />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Precios y Edición</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setIsSelectionMode(!isSelectionMode)}>
                  <BoxSelect className="mr-2 h-4 w-4" />
                  {isSelectionMode ? "Desactivar Selección" : "Selección Manual"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSupplierDialog(true)}>
                  <Users className="mr-2 h-4 w-4" /> Actualizar por Proveedor
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Datos</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setShowHistoryDialog(true)}>
                  <HistoryIcon className="mr-2 h-4 w-4" /> Historial de Precios
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* 4. CSV ACTIONS (OWNER ONLY) */}
          {isOwner && currentKiosk && <CsvActions products={allProducts} kioskId={currentKiosk.id} />}

          {/* 5. PRIMARY CREATE BUTTON */}
          <CreateProductDialog onSuccess={refetch} />
        </div>
      </div>

      {/* View Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-muted/20 p-2 rounded-lg border">
        <div className="flex items-center gap-2 flex-1 w-full">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="h-8 border-none bg-transparent focus-visible:ring-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Price List View Switcher */}
        <div className="flex items-center gap-2 border-l pl-4">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Ver Precios:</span>
          <Select value={viewLimitId} onValueChange={setViewLimitId}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Precio Base (Costo + Margen)</SelectItem>
              {priceLists.map(list => (
                <SelectItem key={list.id} value={list.id}>{list.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                      checked={paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProducts.has(p.id))}
                      onCheckedChange={(checked) => toggleAll(checked as boolean)}
                    />
                  </TableHead>
                )}
                <TableHead className="w-[80px]">Imagen</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Stock</TableHead>
                {isOwner && <TableHead className="text-right">Costo</TableHead>}
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // ... loading rows ...
                <TableRow>
                  <TableCell colSpan={isOwner ? 9 : 8} className="h-24 text-center">
                    <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2" />
                    Cargando productos...
                  </TableCell>
                </TableRow>
              ) : filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isOwner ? 9 : 8} className="h-24 text-center">
                    No hay productos cargados o coincidencia.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => {
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
                        {/* ... Image ... */}
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
                      <TableCell>
                        {product.category ? (
                          <Badge variant="secondary">{product.category.name}</Badge>
                        ) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{product.barcode || '-'}</TableCell>
                      <TableCell>
                        {isLowStock ? (
                          <span className="text-red-600 dark:text-red-400 font-bold">{product.stock}</span>
                        ) : (
                          <span>{product.stock}</span>
                        )}
                      </TableCell>
                      {isOwner && <TableCell className="text-right text-muted-foreground">${product.cost || 0}</TableCell>}
                      <TableCell className="text-right font-bold text-lg">
                        <div className="flex flex-col items-end">
                          <span>${calculatePrice(product, selectedList)}</span>
                          {selectedList && (
                            <span className="text-[10px] text-muted-foreground line-through decoration-red-500/50">
                              Base: ${product.price}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <StockAdjustmentDialog
                            product={product}
                            onSuccess={() => refetch()}
                          />
                          <StockHistoryDialog product={product} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
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
          disabled={page === 0 || isLoading}
        >
          Anterior
        </Button>
        <div className="text-sm text-muted-foreground">
          Página {page + 1} de {totalPages}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => p + 1)}
          disabled={page + 1 >= totalPages || isLoading}
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

      <BulkDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedCount={selectedProducts.size}
        onConfirm={handleBulkDelete}
      />

      <PriceHistoryDialog 
        open={showHistoryDialog}
        onOpenChange={setShowHistoryDialog}
      />



      <ProductDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        product={selectedProductForDetails}
        onProductUpdated={() => refetch()}
      />

      <AuditHistoryDialog
        open={showAuditHistory}
        onOpenChange={setShowAuditHistory}
      />
    </div>
  );
}
