"use client"

import { useState, useRef, useEffect } from "react"
import { Product } from "@/types/inventory"
import { CartItem, PaymentMethod } from "@/types/pos"
import { ProductCard } from "./product-card"
import { Cart } from "./cart"
import { CheckoutDialog } from "./checkout-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, ScanBarcode } from "lucide-react"
import { BarcodeScanner } from "@/components/inventory/barcode-scanner"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"

interface PosContainerProps {
  initialProducts: Product[]
}

export function PosContainer({ initialProducts }: PosContainerProps) {
  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [kioskId, setKioskId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
            setUserId(data.user.id)
            // Fetch kiosk associated with user
            supabase.from('kiosk_members')
                .select('kiosk_id')
                .eq('user_id', data.user.id)
                .maybeSingle()
                .then(({ data: member }) => {
                    if (member) setKioskId(member.kiosk_id)
                })
        }
    })
  }, [])

  // Products state to display
  const [displayedProducts, setDisplayedProducts] = useState(initialProducts)
  const [isSearching, setIsSearching] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
        if (search.trim().length === 0) {
            setDisplayedProducts(initialProducts)
            return
        }

        setIsSearching(true)
        try {
            // Check if it's a barcode (numeric and long?)
            // Just search both for simplicity using OR syntax
            // Supabase: name.ilike.%query%, barcode.eq.query
            // But barcode usually exact match.
            
            const { data } = await supabase
                .from('products')
                .select('*')
                .or(`name.ilike.%${search}%,barcode.eq.${search}`)
                .limit(20)
            
            if (data) {
                setDisplayedProducts(data as Product[])
                
                // If exact barcode match, we might want to propose adding it directly? 
                // The existing logic had enter-key scan. We can keep that or enhance.
            }
        } catch (error) {
            console.error("Search error:", error)
        } finally {
            setIsSearching(false)
        }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, initialProducts])

  // Removed client-side filteredProducts, using displayedProducts now
  
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item => 
            item.product.id === product.id 
                ? { ...item, quantity: item.quantity + 1 }
                : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    
    // Clear search after exact match scan or selection if desired, 
    // but maybe user wants to add multiple. Let's keep focus on search.
    searchInputRef.current?.focus()
  }

  const handleScan = async (code: string) => {
    // Try finding in current list first
    let product = displayedProducts.find(p => p.barcode === code)
    
    // If not found, fetch from DB directly
    if (!product) {
        const { data } = await supabase.from('products').select('*').eq('barcode', code).single()
        if (data) product = data as Product
    }

    if (product) {
      addToCart(product)
      toast.success(`Agregado: ${product.name}`)
      // Optional: beep sound
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

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  const handleCheckout = async (method: PaymentMethod) => {
    if (cart.length === 0) return

    const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
    
    if (!kioskId || !userId) {
        toast.error("Error de sesión: No se identificó el kiosco o usuario.")
        return
    }

    // 1. Create Sale
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
            total,
            payment_method: method,
            kiosk_id: kioskId,
            user_id: userId
        })
        .select()
        .single()
    
    if (saleError) {
        toast.error("Error al crear venta")
        console.error("Sale Creation Error:", JSON.stringify(saleError, null, 2))
        return
    }

    // 2. Create Sale Items
    const saleItems = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price,
        cost: item.product.cost || 0, // Capture historical cost
        subtotal: item.product.price * item.quantity
    }))

    const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems)

    if (itemsError) {
        toast.error("Error al guardar items")
        console.error(itemsError)
        // Ideally rollback sale here, but simplified for now
        return
    }

    // 3. Update Stock (One by one for now, or could use RPC)
    // Using a loop is not atomic but works for basic implementation
    for (const item of cart) {
        const newStock = item.product.stock - item.quantity
        await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.product.id)
    }
    
    toast.success("Venta realizada con éxito")
    setCart([])
    setShowCheckout(false)
    // Refresh products to show new stock
    // In a real app we might use realtime subscription or optimistic updates
    // For now, let's just update local state.
    setDisplayedProducts(prev => prev.map(p => {
        const inCart = cart.find(c => c.product.id === p.id)
        if (inCart) {
            return { ...p, stock: p.stock - inCart.quantity }
        }
        return p
    }))
  }

  return (
    <div className="flex flex-col lg:flex-row h-full gap-4 pb-20 md:pb-0">
      {/* Left: Catalog */}
      <div className="flex-1 flex flex-col gap-4 bg-background border rounded-lg p-4 shadow-sm min-h-0">
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

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto content-start flex-1 min-h-[300px]">
            {isSearching && (
                 <div className="col-span-full h-10 flex items-center justify-center text-muted-foreground animate-pulse">
                     Buscando...
                 </div>
            )}
            {!isSearching && displayedProducts.map(product => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} />
            ))}
            {!isSearching && displayedProducts.length === 0 && (
                <div className="col-span-full h-40 flex items-center justify-center text-muted-foreground">
                    No se encontraron productos
                </div>
            )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-full lg:w-[350px] flex flex-col bg-background border rounded-lg shadow-sm h-[300px] lg:h-full">
        <div className="p-4 border-b">
            <h2 className="font-semibold text-lg flex items-center gap-2">
                Carrito
                <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
            </h2>
        </div>
        
        <Cart 
            items={cart} 
            onUpdateQuantity={updateQuantity} 
            onRemove={removeFromCart} 
        />
        
        <div className="p-4 bg-muted/20">
            <Button 
                className="w-full text-lg h-12" 
                size="lg"
                disabled={cart.length === 0}
                onClick={() => setShowCheckout(true)}
            >
                Cobrar
            </Button>
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
