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
  customerId?: string | null     // ← NEW: for fiado
  activePriceList?: { id: string, name: string } | null
}

export function useCreateSale() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ cart, kioskId, userId, method, customerName, customerId, activePriceList }: CreateSaleVariables) => {
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
                customer_id: customerId || null,         // ← NEW
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
        for (const item of cart) {
            const { error: stockError } = await supabase.rpc('decrement_stock', { 
                p_product_id: item.product.id, 
                p_quantity: item.quantity 
            })
            
            if (stockError) {
                 const newStock = item.product.stock - item.quantity
                 await supabase
                    .from('products')
                    .update({ stock: newStock })
                    .eq('id', item.product.id)
            }
        }

        // 4. ← NEW: If fiado, register the debt charge via RPC
        if (method === 'fiado' && customerId) {
            const { error: debtError } = await supabase.rpc('record_debt_charge', {
                p_kiosk_id: kioskId,
                p_customer_id: customerId,
                p_amount: total,
                p_description: `Venta #${sale.id.slice(0, 8)} — ${cart.map(i => i.product.name).join(', ')}`
            })

            if (debtError) {
                console.error('[useCreateSale] Debt charge error:', debtError)
                // Non-fatal: sale is already registered, just log the error
                toast.warning('Venta registrada, pero no se pudo actualizar la cuenta corriente del cliente.')
            }
        }
        
        return sale
    },
    onMutate: async (newSale) => {
        await queryClient.cancelQueries({ queryKey: ['products', newSale.kioskId] })

        const previousProducts = queryClient.getQueryData<Product[]>(['products', newSale.kioskId])

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

        return { previousProducts }
    },
    onError: (err, newSale, context) => {
        if (context?.previousProducts) {
            queryClient.setQueryData(['products', newSale.kioskId], context.previousProducts)
        }
        toast.error("Error al procesar la venta. Se ha revertido el stock.")
        console.error("Link Sale Error:", err)
    },
    onSettled: (data, error, variables) => {
        queryClient.invalidateQueries({ queryKey: ['products', variables.kioskId] })
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
        queryClient.invalidateQueries({ queryKey: ['sales'] })
        queryClient.invalidateQueries({ queryKey: ['low_stock_alerts', variables.kioskId] })
        // Refresh customer debt data if fiado
        if (variables.method === 'fiado' && variables.customerId) {
            queryClient.invalidateQueries({ queryKey: ['customers', variables.kioskId] })
        }
    },
  })
}

