import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/utils/supabase/client"
import { subDays, format } from "date-fns"

interface DashboardStatsParams {
  userId: string
  from: Date | undefined
  to: Date | undefined
}

export function useDashboardStats({ userId, from, to }: DashboardStatsParams, initialData?: any) {
  return useQuery({
    queryKey: ['dashboard-stats', userId, from, to],
    queryFn: async () => {
        let startDate = subDays(new Date(), 30)
        let endDate = new Date()

        if (from) {
            startDate = from
            endDate = to || from
        }

        // Call v2 stats which includes expenses
        const { data, error } = await supabase.rpc('get_dashboard_stats_v2', {
            p_user_id: userId,
            p_start_date: startDate.toISOString(),
            p_end_date: endDate.toISOString()
        })

        if (error || !data) {
            console.warn("RPC failed, falling back to client-side calculation", error)
            
            // Fallback: Fetch manually
            const [salesRes, expensesRes] = await Promise.all([
                supabase.from('sales').select('total, created_at, kiosk_id, kiosks(name)')
                    .gte('created_at', startDate.toISOString())
                    .lte('created_at', endDate.toISOString())
                ,
                supabase.from('expenses').select('amount, date')
                    .gte('date', startDate.toISOString())
                    .lte('date', endDate.toISOString())
            ])

            if (salesRes.error || expensesRes.error) {
                throw new Error("Fallback fetch failed")
            }

            const sales = salesRes.data || []
            const expenses = expensesRes.data || []

            const totalSales = sales.length
            const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0)
            const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0)
            const grossProfit = totalRevenue // Fallback assumption
            const netIncome = totalRevenue - totalExpenses

            // Calculate Top Kiosk
            const kioskMap = new Map<string, number>()
            sales.forEach(s => {
                // @ts-ignore
                const name = s.kiosks?.name || 'Unknown'
                kioskMap.set(name, (kioskMap.get(name) || 0) + s.total)
            })
            let topKiosk = "N/A"
            if (kioskMap.size > 0) {
                 topKiosk = [...kioskMap.entries()].reduce((a, b) => b[1] > a[1] ? b : a)[0]
            }

            const trendMap = new Map<string, number>()
            sales.forEach(s => {
                const d = format(new Date(s.created_at), 'dd/MM')
                trendMap.set(d, (trendMap.get(d) || 0) + s.total)
            })
            const trend = Array.from(trendMap.entries()).map(([date, amount]) => ({ date, amount }))
                .sort((a,b) => a.date.localeCompare(b.date))

            const pie = Array.from(kioskMap.entries()).map(([name, value]) => ({ name, value }))

            return {
                totalRevenue,
                totalSales,
                totalExpenses,
                grossProfit,
                netIncome,
                topKiosk,
                trend,
                pie
            }
        }

        // Transform date format for charts
        // @ts-ignore
        const trend = (data.trend || []).map((t: any) => ({
            date: format(new Date(t.date), 'dd/MM'),
            amount: t.amount
        }))

        return {
            totalRevenue: data.totalRevenue,
            totalSales: data.totalSales,
            totalExpenses: data.totalExpenses,
            grossProfit: data.grossProfit,
            netIncome: data.netIncome,
            topKiosk: data.topKiosk,
            trend,
            pie: data.pie || []
        }
    },
    initialData: initialData,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
