"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { supabase } from "@/utils/supabase/client"
import { Loader2, TrendingUp, Trophy } from "lucide-react"

interface EmployeeSale {
    userId: string
    name: string
    totalSales: number
    totalAmount: number
}

export function EmployeeSalesStats() {
    const [stats, setStats] = useState<EmployeeSale[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchStats() {
            try {
                // 1. Fetch Sales for this month (or all time?) - Let's do this month
                const startOfMonth = new Date()
                startOfMonth.setDate(1)
                startOfMonth.setHours(0,0,0,0)
                
                const { data: sales, error } = await supabase
                    .from('sales')
                    .select('user_id, total')
                    .gte('created_at', startOfMonth.toISOString())
                
                if (error) throw error
                if (!sales) return

                // 2. Aggregate
                const agg: Record<string, { count: number, start: number }> = {}
                sales.forEach(s => {
                    if (!s.user_id) return
                    if (!agg[s.user_id]) agg[s.user_id] = { count: 0, start: 0 }
                    agg[s.user_id].count++
                    agg[s.user_id].start += s.total
                })

                if (Object.keys(agg).length === 0) {
                    setLoading(false)
                    return
                }

                // 3. Fetch Names
                const userIds = Object.keys(agg)
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds)
                
                const profilesMap: Record<string, string> = {}
                profiles?.forEach(p => { profilesMap[p.id] = p.full_name })

                // 4. Transform to Array
                const result = userIds.map(uid => ({
                    userId: uid,
                    name: profilesMap[uid] || 'Usuario',
                    totalSales: agg[uid].count,
                    totalAmount: agg[uid].start
                })).sort((a,b) => b.totalAmount - a.totalAmount)

                setStats(result)
            } catch (e) {
                console.error("Error fetching stats:", e)
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    if (loading) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle>Ventas por Empleado</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px] flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="col-span-1">
             <CardHeader>
                <CardTitle>Rendimiento del Mes</CardTitle>
                <CardDescription>Ventas realizadas por cada vendedor</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {stats.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">Sin ventas este mes.</p>
                    )}
                    {stats.map((stat, index) => (
                        <div key={stat.userId} className="flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                 <div className={`flex items-center justify-center h-8 w-8 rounded-full font-bold text-xs ${index === 0 ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-muted text-muted-foreground'}`}>
                                     {index === 0 ? <Trophy className="h-4 w-4" /> : index + 1}
                                 </div>
                                 <div className="space-y-0.5">
                                     <p className="text-sm font-medium leading-none">{stat.name}</p>
                                     <p className="text-xs text-muted-foreground">{stat.totalSales} ventas</p>
                                 </div>
                             </div>
                             <div className="font-bold flex items-center gap-1">
                                 {index === 0 && <TrendingUp className="h-3 w-3 text-green-500" />}
                                 ${stat.totalAmount.toLocaleString('es-AR')}
                             </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
