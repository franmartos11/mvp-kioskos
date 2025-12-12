import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { subDays } from "date-fns"

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. Get User
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/auth")
  }

  // 2. Fetch Kiosks & Stats in Parallel
  const endDate = new Date()
  const startDate = subDays(endDate, 30)

  // We can fetch kiosks and stats in parallel since we have user.id
  const [kiosksRes, statsRes] = await Promise.all([
    supabase
        .from('kiosk_members')
        .select(`
            kiosk_id,
            role,
            kiosks (
                id,
                name
            )
        `)
        .eq('user_id', user.id),
    
    // We can call the RPC directly via Supabase client
    supabase.rpc('get_dashboard_stats', {
        p_user_id: user.id,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString()
    })
  ])

  const kiosks = (kiosksRes.data || []).map((m: any) => ({
        id: m.kiosks.id,
        name: m.kiosks.name,
        role: m.role
  }))

  const initialStats = statsRes.data || null

  return (
    <DashboardClient 
        user={user} 
        kiosks={kiosks}
        initialStats={initialStats} 
    />
  )
}
