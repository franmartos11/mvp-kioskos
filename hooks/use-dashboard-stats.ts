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

        // Call v3 stats which includes expenses and new metrics
        const { data, error } = await supabase.rpc('get_dashboard_stats_v3', {
            p_user_id: userId,
            p_start_date: startDate.toISOString(),
            p_end_date: endDate.toISOString()
        })

        if (error || !data) {
            console.warn("RPC v3 failed", error)
            // Return safe empty defaults if RPC fails
            return {
                totalRevenue: 0,
                totalSales: 0,
                totalExpenses: 0,
                grossProfit: 0,
                netIncome: 0,
                ticketAvg: 0,
                margin: 0,
                trend: [],
                pie: [],
                topProducts: [],
                stockAlerts: 0
            }
        }

        // Transform date format for charts
        // @ts-ignore
        const trend = (data.trend || []).map((t: any) => ({
            date: format(new Date(t.date), 'dd/MM'),
            amount: t.amount
        }))

        return {
            totalRevenue: Number(data.totalRevenue) || 0,
            totalSales: Number(data.totalSales) || 0,
            totalExpenses: Number(data.totalExpenses) || 0,
            grossProfit: Number(data.grossProfit) || 0,
            netIncome: Number(data.netIncome) || 0,
            ticketAvg: Number(data.ticketAvg) || 0,
            margin: Number(data.margin) || 0,
            trend,
            pie: data.pie || [],
            topProducts: data.topProducts || [],
            stockAlerts: Number(data.stockAlerts) || 0
        }
    },
    initialData: initialData,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
