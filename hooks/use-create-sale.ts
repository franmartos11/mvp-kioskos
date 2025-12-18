import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/utils/supabase/client"
import { CartItem, PaymentMethod } from "@/types/pos"
import { Product } from "@/types/inventory"
import { toast } from "sonner"

interface CreateSaleVariables {
  cart: CartItem[]
  kioskId: string
  userId: string
  method: PaymentMethod
  customerName?: string
  activePriceList?: { id: string, name: string } | null
}

export function useCreateSale() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ cart, kioskId, userId, method, customerName, activePriceList }: CreateSaleVariables) => {
        // 1. Create Sale
        const total = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
        
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert({
                total,
                payment_method: method,
                kiosk_id: kioskId,
                user_id: userId,
                customer_name: customerName || null,
                metadata: activePriceList ? { price_list: activePriceList } : {}
            })
            .select()
            .single()
        
        if (saleError) throw saleError

        // 2. Create Sale Items
        const saleItems = cart.map(item => ({
            sale_id: sale.id,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.product.price,
            cost: item.product.cost || 0,
            subtotal: item.product.price * item.quantity
        }))

        const { error: itemsError } = await supabase
            .from('sale_items')
            .insert(saleItems)

        if (itemsError) throw itemsError

        // 3. Update Stock
        // Using a loop for now (or could use an RPC if strict atomicity needed)
        for (const item of cart) {
            const { error: stockError } = await supabase.rpc('decrement_stock', { 
                p_product_id: item.product.id, 
                p_quantity: item.quantity 
            })
            
            // Fallback to normal update if RPC doesn't exist (it should, but safety first)
            if (stockError) {
                 const newStock = item.product.stock - item.quantity
                 await supabase
                    .from('products')
                    .update({ stock: newStock })
                    .eq('id', item.product.id)
            }
        }
        
        return sale
    },
    onMutate: async (newSale) => {
        // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
        await queryClient.cancelQueries({ queryKey: ['products', newSale.kioskId] })

        // Snapshot the previous value
        const previousProducts = queryClient.getQueryData<Product[]>(['products', newSale.kioskId])

        // Optimistically update to the new value
        if (previousProducts) {
             queryClient.setQueryData<Product[]>(['products', newSale.kioskId], (old) => {
                 if (!old) return []
                 return old.map(product => {
                     const inCart = newSale.cart.find(c => c.product.id === product.id)
                     if (inCart) {
                         return { ...product, stock: product.stock - inCart.quantity }
                     }
                     return product
                 })
             })
        }

        // Return a context object with the snapshotted value
        return { previousProducts }
    },
    onError: (err, newSale, context) => {
        // If the mutation fails, use the context returned from onMutate to roll back
        if (context?.previousProducts) {
            queryClient.setQueryData(['products', newSale.kioskId], context.previousProducts)
        }
        toast.error("Error al procesar la venta. Se ha revertido el stock.")
        console.error("Link Sale Error:", err)
    },
    onSettled: (data, error, variables) => {
        // Always refetch after error or success:
        queryClient.invalidateQueries({ queryKey: ['products', variables.kioskId] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })
}
