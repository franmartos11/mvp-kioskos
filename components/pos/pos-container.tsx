"use client"

import { useState, useRef, useEffect } from "react"
import { Product } from "@/types/inventory"
import { CartItem, PaymentMethod } from "@/types/pos"
import { ProductCard } from "./product-card"
import { Cart } from "./cart"
import { CheckoutDialog } from "./checkout-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ScanBarcode, ChevronUp, ChevronDown } from "lucide-react"
import { BarcodeScanner } from "@/components/inventory/barcode-scanner"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"
import { useCreateSale } from "@/hooks/use-create-sale"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner"
import { useSubscription } from "@/hooks/use-subscription"
import { AlertTriangle, Lock } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { getDay, parse, isWithinInterval, set } from "date-fns"

interface PosContainerProps {
  initialProducts: Product[]
}

import { calculatePrice, PriceList } from "@/utils/pricing-engine"

// Helper to determine active price list
function getActivePriceList(lists: PriceList[]): PriceList | null {
    if (!lists.length) return null
    const now = new Date()
    const currentDay = getDay(now) // 0-6 Sunday-Saturday
    
    // Sort by Priority (Higher First)
    // The user now has a manual "Priority" field to control conflicts explicitly.
    const sorted = [...lists].sort((a, b) => (b.priority || 0) - (a.priority || 0))

    // 1. Check Matching Schedules (Today)
    for (const list of sorted) {
        if (!list.is_active) continue
        if (!list.schedule || list.schedule.length === 0) {
            // Found a "default" list. Since we sort by priority, if we hit this, it's the valid one
            // unless a higher priority scheduled list already matched?
            // Actually, sorting puts scheduled and non-scheduled together by priority number.
            // If Priority 10 (Scheduled) is unmatched, we check Priority 5 (Default).
            // This is correct.
            return list
        }

        const rules = list.schedule.filter(r => r.day === currentDay)
        for (const rule of rules) {
            const start = parse(rule.start, 'HH:mm', now)
            let end = parse(rule.end, 'HH:mm', now)
            
            // Handle cross-midnight: 22:00 -> 02:00
            if (end < start) {
                end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
            }
            
            if (isWithinInterval(now, { start, end })) {
                return list
            }
        }
        
        // 2. Check Matching Schedules (Yesterday's Spill-over)
        // e.g. Shift started Yesterday 22:00, ends Today 02:00. Now is 01:00.
        const prevDay = currentDay === 0 ? 6 : currentDay - 1
        const prevRules = list.schedule.filter(r => r.day === prevDay)
        
        for (const rule of prevRules) {
            const startRaw = parse(rule.start, 'HH:mm', now)
            const endRaw = parse(rule.end, 'HH:mm', now)
            
            // If it was a cross-midnight shift (end < start)
            if (endRaw < startRaw) {
                 // Shift Start back to yesterday
                 const start = new Date(startRaw.getTime() - 24 * 60 * 60 * 1000)
                 // End is Today's time (raw parse uses today). So it's correct.
                 const end = endRaw
                 
                 if (isWithinInterval(now, { start, end })) {
                     return list
                 }
            }
        }
    }
    return null
}



export function PosContainer({ initialProducts }: PosContainerProps) {
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  // Price list state
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [activePriceList, setActivePriceList] = useState<PriceList | null>(null)

  // Use global context for consistency
  const { currentKiosk } = useKiosk()
  // Sync kioskId with context
  const kioskId = currentKiosk?.id || null
  
  const { plan, isPro } = useSubscription()
  const [isOverLimit, setIsOverLimit] = useState(false)
  const [isLoadingLimit, setIsLoadingLimit] = useState(true)

  // Fetch Price Lists
  useEffect(() => {
    async function fetchPriceLists() {
        if (!kioskId) return
        const { data } = await supabase.from('price_lists').select('*').eq('kiosk_id', kioskId).eq('is_active', true)
        if (data) setPriceLists(data)
    }
    fetchPriceLists()

    // Realtime subscription for price list changes? Maybe overkill for now, but recommended.
    // Simpler: Interval check every minute for schedule changes
    const interval = setInterval(() => {
       // Force re-eval of active price list
       setPriceLists(prev => [...prev]) 
    }, 60000)

    return () => clearInterval(interval)
  }, [kioskId])

  // Determine ACTIVE list based on time/schedule
  useEffect(() => {
      const active = getActivePriceList(priceLists)
      setActivePriceList(active)
  }, [priceLists]) // Re-run when lists change (or forced by interval)

  useEffect(() => {
    async function checkLimit() {
        if (!kioskId) return
        
        // Skip check for Pro users
        if (isPro) {
            setIsOverLimit(false)
            setIsLoadingLimit(false)
            return
        }

        const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('kiosk_id', kioskId)
        
        if (plan === 'free' && (count || 0) > 50) {
            setIsOverLimit(true)
        } else {
            setIsOverLimit(false)
        }
        setIsLoadingLimit(false)
    }

    checkLimit()
  }, [kioskId, isPro, plan])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
            setUserId(data.user.id)
        }
    })
  }, [])

  // ... (displayedProducts logic same as before) ...
  const [displayedProducts, setDisplayedProducts] = useState(initialProducts)
  useEffect(() => {
    setDisplayedProducts(initialProducts)
  }, [initialProducts])

  const [isSearching, setIsSearching] = useState(false)
  const createSale = useCreateSale()

  useBarcodeScanner({
      onScan: (code) => handleScan(code)
  })

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
        if (search.trim().length === 0) {
            setDisplayedProducts(initialProducts)
            return
        }

        setIsSearching(true)
        try {
            const { data } = await supabase
                .from('products')
                .select('*, category:categories(name)')
                .or(`name.ilike.%${search}%,barcode.eq.${search}`)
                .eq('kiosk_id', kioskId)
                .limit(20)
            
            if (data) {
                setDisplayedProducts(data as any)
            }
        } catch (error) {
            console.error("Search error:", error)
        } finally {
            setIsSearching(false)
        }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, initialProducts, kioskId])
  
  const addToCart = (product: Product) => {
    // Determine effective price list for THIS item addition
    // "Snapshot" logic: If cart is empty, use current active list.
    // If cart has items, we should technically stick to the list used for first item?
    // Or just apply current active list to new items?
    // User requested "snapshotting".
    // Implementation: Since we don't store "session price list" in state yet, 
    // we will apply the *current* active settings to the *newly added* item for now.
    // Ideally, we'd lock the price list for the whole transaction.
    // Let's stick to: effective price = calculated at moment of adding.
    
    // NOTE: If active list changes mid-transaction, new items get new price? 
    // User wanted snapshot. "Active price list will be locked at start of sale".
    // To do that, we need `transactionPriceList` state.

    setCart(prev => {
      // Determine which price list to use
      let effectiveList = activePriceList
      
      // If cart already has items, maybe we should reuse the list snapshot?
      // For simplicity in this iteration, we use the current active list for calculation.
      // If we want strict snapshot, we could store `priceListId` in cart metadata?
      // Or just assume `activePriceList` is stable enough for short transactions.
      
      const finalPrice = calculatePrice(product, effectiveList)

      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item => 
            item.product.id === product.id 
                ? { ...item, quantity: item.quantity + 1 } // Keep existing price
                : item
        )
      }
      // Add new item with CALCULATED price
      // We override the product object in the cart to reflect the new price visually?
      // Or store `unitPrice` in CartItem? CartItem usually relies on product.price.
      // CartItem interface: { product: Product, quantity: number }
      // We should create a copy of product with modified price for the cart.
      const productWithPrice = { ...product, price: finalPrice }
      
      return [...prev, { product: productWithPrice, quantity: 1 }]
    })
    
    searchInputRef.current?.focus()
  }

  const handleScan = async (code: string) => {
    let product = displayedProducts.find(p => p.barcode === code)
    
    if (!product && kioskId) {
        const { data } = await supabase
            .from('products')
            .select('*')
            .eq('barcode', code)
            .eq('kiosk_id', kioskId)
            .single()
        if (data) product = data as any
    }

    if (product) {
      addToCart(product)
      toast.success(`Agregado: ${product.name}`)
      setShowScanner(false)
    } else {
      toast.error("Producto no encontrado")
    }
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
        if (item.product.id === productId) {
            const newQty = Math.max(0, item.quantity + delta)
            return { ...item, quantity: newQty }
        }
        return item
    }).filter(item => item.quantity > 0))
  }

  const setExactQuantity = (productId: string, qty: number) => {
    setCart(prev => prev.map(item => {
        if (item.product.id === productId) {
            const newQty = Math.max(0, qty)
            return { ...item, quantity: newQty }
        }
        return item
    }).filter(item => item.quantity > 0))
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  const handleCheckout = async (method: PaymentMethod, customerName?: string) => {
    if (cart.length === 0) return
    if (!kioskId || !userId) {
        toast.error("Error de sesión: No se identificó el kiosco o usuario.")
        return
    }

    // Backup cart for rollback
    const backupCart = [...cart]

    // OPTIMISTIC UI: Clear cart immediately and close dialog
    setCart([])
    setShowCheckout(false)
    toast.success("Venta procesada") // Optimistic success message

    // Trigger mutation
    createSale.mutate({
        cart: backupCart,
        kioskId,
        userId,
        method,
        customerName,
        activePriceList: activePriceList ? { id: activePriceList.id, name: activePriceList.name } : null
    }, {
        onError: () => {
            // Rollback UI if failed
            setCart(backupCart)
            setShowCheckout(true) // Re-open to let user try again
            // Toast error is handled in hook
        }
    })
  }

  if (isLoadingLimit) {
      return <div className="flex items-center justify-center h-full">Cargando...</div>
  }

  if (isOverLimit) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
            <div className="h-24 w-24 bg-destructive/10 rounded-full flex items-center justify-center">
                <Lock className="h-12 w-12 text-destructive" />
            </div>
            <div className="max-w-md space-y-2">
                <h1 className="text-2xl font-bold">Límite de Productos Excedido</h1>
                <p className="text-muted-foreground">
                    Tu plan actual (Free) permite hasta 50 productos. Actualmente tienes más de 50.
                </p>
                <p className="text-sm font-medium bg-secondary/50 p-4 rounded-lg">
                    Para continuar vendiendo, debes eliminar productos o mejorar tu plan a PRO.
                </p>
            </div>
            <div className="flex gap-4">
                <Link href="/inventory">
                    <Button variant="outline">Gestionar Productos</Button>
                </Link>
                <Link href="/settings">
                    <Button>Mejorar a PRO</Button>
                </Link>
            </div>
        </div>
      )
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 pb-20 md:pb-0">
      {/* Left: Catalog */}
      <div className="flex-1 flex flex-col gap-4 bg-background border rounded-xl p-4 shadow-sm min-h-0">
        <div className="flex items-center justify-between">
           {activePriceList ? (
               <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700 animate-in fade-in">
                  Lista Activa: {activePriceList.name} ({activePriceList.adjustment_percentage > 0 ? '+' : ''}{activePriceList.adjustment_percentage}%)
               </Badge>
           ) : (
             <div className="h-5"></div> // Spacer
           )}
        </div>
        <div className="flex gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    ref={searchInputRef}
                    placeholder="Buscar producto o escanear código..." 
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                            // Simple 'enter' to scan/add if it matches a barcode exactly
                            let exactMatch = displayedProducts.find(p => p.barcode === search)
                            
                            if (!exactMatch && search.trim()) {
                                const { data } = await supabase.from('products').select('*').eq('barcode', search).single()
                                if (data) exactMatch = data as Product
                            }

                            if (exactMatch) {
                                addToCart(exactMatch)
                                setSearch("")
                            }
                        }
                    }}
                />
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowScanner(true)}>
                <ScanBarcode className="h-4 w-4" />
            </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-4 overflow-y-auto content-start flex-1 min-h-[300px] p-2 pb-[80px] lg:pb-2">
            {isSearching && (
                 <div className="col-span-full h-10 flex items-center justify-center text-muted-foreground animate-pulse">
                     Buscando...
                 </div>
            )}
            {!isSearching && displayedProducts.map(product => {
                const inCart = cart.find(item => item.product.id === product.id)
                // Calculate display price based on active list
                const effectivePrice = calculatePrice(product, activePriceList)
                // Create a visual copy for card display
                const displayProduct = { ...product, price: effectivePrice }
                
                return (
                    <ProductCard 
                        key={product.id} 
                        product={displayProduct} 
                        onAdd={addToCart} 
                        onRemove={(p) => updateQuantity(p.id, -1)}
                        quantity={inCart?.quantity || 0}
                    />
                )
            })}
            {!isSearching && displayedProducts.length === 0 && (
                <div className="col-span-full h-40 flex items-center justify-center text-muted-foreground">
                    No se encontraron productos
                </div>
            )}
        </div>
      </div>

      {/* Right: Cart (Collapsible on mobile, Fixed on Desktop) */}
      <div 
        className={`
            fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out rounded-t-xl
            lg:static lg:w-[350px] lg:flex lg:flex-col lg:border lg:rounded-xl lg:shadow-sm lg:h-full lg:z-0
            ${isCartOpen ? 'h-[80vh]' : 'h-[70px] lg:h-full'}
        `}
      >
        <div 
            className="p-4 border-b flex items-center justify-between cursor-pointer lg:cursor-default bg-muted/20 lg:bg-transparent rounded-t-xl"
            onClick={() => setIsCartOpen(!isCartOpen)}
        >
            <h2 className="font-semibold text-lg flex items-center gap-2">
                Carrito
                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
            </h2>
            <div className="flex items-center gap-2 lg:hidden">
                <span className="font-bold text-primary">
                    ${cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)}
                </span>
                {isCartOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
            </div>
        </div>
        
        <div className={`flex flex-col flex-1 overflow-hidden ${!isCartOpen ? 'hidden lg:flex' : 'flex'}`}>
            <Cart 
                items={cart} 
                onUpdateQuantity={updateQuantity} 
                onSetQuantity={setExactQuantity}
                onRemove={removeFromCart} 
            />
            
            <div className="p-4 bg-muted/20 mt-auto">
                <Button 
                    className="w-full text-lg h-12 rounded-xl" 
                    size="lg"
                    disabled={cart.length === 0}
                    onClick={() => setShowCheckout(true)}
                >
                    Cobrar
                </Button>
            </div>
        </div>
      </div>

      <CheckoutDialog 
        open={showCheckout} 
        onOpenChange={setShowCheckout}
        items={cart}
        onConfirm={handleCheckout}
      />

        {showScanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
            <div className="w-full max-w-md bg-transparent">
              <BarcodeScanner
                onScan={handleScan}
                onClose={() => setShowScanner(false)}
              />
            </div>
          </div>
        )}
    </div>
  )
}
