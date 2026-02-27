import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase/client'
import { Product } from "@/types/inventory"

export function useProducts(kioskId: string | undefined | null) {
  return useQuery({
    queryKey: ['products', kioskId],
    queryFn: async () => {
      if (!kioskId) return []
      
      // NOTE: supplier join removed from main query to avoid RLS filtering issues.
      // Suppliers have their own RLS that can silently exclude products rows.
      // Supplier name is loaded separately in product details if needed.
      const { data, error } = await supabase
        .from('products')
        .select(`
            *,
            category:categories(name)
        `)
        .eq('kiosk_id', kioskId)
        .order('name')
      
      if (error) {
        console.error('[useProducts] Error fetching products:', error)
        throw error
      }
      
      console.log('[useProducts] Fetched', data?.length ?? 0, 'products for kiosk', kioskId)
      return data as Product[]
    },
    enabled: !!kioskId, // Only fetch if kioskId exists
  })
}
