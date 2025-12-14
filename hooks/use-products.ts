import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase/client'
import { Product } from "@/types/inventory"

export function useProducts(kioskId: string | undefined | null) {
  return useQuery({
    queryKey: ['products', kioskId],
    queryFn: async () => {
      if (!kioskId) return []
      
      const { data, error } = await supabase
        .from('products')
        .select(`
            *,
            category:categories(name),
            supplier:suppliers(name)
        `)
        .eq('kiosk_id', kioskId)
        .order('name')
      
      if (error) {
        throw error
      }
      
      return data as Product[]
    },
    enabled: !!kioskId, // Only fetch if kioskId exists
  })
}
