import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase/client'
import { Product } from "@/types/inventory"

// POS and other places that need ALL products (for cart, etc.) - keeps 1000 row limit
// This is fine for POS since it does its own search for product discovery
export function useProducts(kioskId: string | undefined | null) {
  return useQuery({
    queryKey: ['products', kioskId],
    queryFn: async () => {
      if (!kioskId) return []
      
      // NOTE: supplier join removed from main query to avoid RLS filtering issues.
      const { data, error } = await supabase
        .from('products')
        .select(`*, category:categories(name)`)
        .eq('kiosk_id', kioskId)
        .order('name')
        .limit(5000) // Increase limit to handle large kiosks
      
      if (error) {
        console.error('[useProducts] Error fetching products:', error)
        throw error
      }
      
      console.log('[useProducts] Fetched', data?.length ?? 0, 'products for kiosk', kioskId)
      return data as Product[]
    },
    enabled: !!kioskId,
  })
}

// Inventory-specific hook with server-side search and pagination
export function useInventoryProducts(
  kioskId: string | undefined | null,
  searchTerm: string,
  page: number,
  pageSize: number = 10
) {
  return useQuery({
    queryKey: ['inventory_products', kioskId, searchTerm, page, pageSize],
    queryFn: async () => {
      if (!kioskId) return { data: [], count: 0 }
      
      let query = supabase
        .from('products')
        .select(`*, category:categories(name)`, { count: 'exact' })
        .eq('kiosk_id', kioskId)
        .order('name')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      // Apply server-side search filter
      if (searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`)
      }
      
      const { data, error, count } = await query
      
      if (error) {
        console.error('[useInventoryProducts] Error:', error)
        throw error
      }
      
      console.log('[useInventoryProducts] Fetched', data?.length, 'of', count, 'products')
      return { data: (data ?? []) as Product[], count: count ?? 0 }
    },
    enabled: !!kioskId,
    placeholderData: (prev) => prev, // Keep previous data while loading new page
  })
}

