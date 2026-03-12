import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/utils/supabase/client'

export interface LowStockProduct {
  id: string
  name: string
  stock: number
  min_stock: number
  barcode: string | null
}

/**
 * Hook that returns products below or at their min_stock threshold.
 * Uses a 5-minute stale time so it doesn't refetch on every render.
 */
export function useLowStockAlerts(kioskId: string | undefined | null) {
  return useQuery({
    queryKey: ['low_stock_alerts', kioskId],
    queryFn: async (): Promise<LowStockProduct[]> => {
      if (!kioskId) return []

      const { data, error } = await supabase
        .from('products')
        .select('id, name, stock, min_stock, barcode')
        .eq('kiosk_id', kioskId)
        .gt('min_stock', 0)            // Only products with a defined min_stock
        .order('stock', { ascending: true })
        .limit(100)

      if (error) throw error

      // Filter client-side: stock <= min_stock
      return ((data || []) as LowStockProduct[]).filter(
        p => p.stock <= (p.min_stock ?? 5)
      )
    },
    enabled: !!kioskId,
    staleTime: 5 * 60 * 1000,   // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  })
}
