import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { subDays } from "date-fns"
import { Suspense } from "react"
import { Loader2 } from "lucide-react"

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

  const isAnyOwner = kiosks.some((k: any) => k.role === 'owner')
  
  if (!isAnyOwner) {
      return redirect("/pos")
  }

  const initialStats = statsRes.data || null

  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <DashboardClient 
          user={user} 
          kiosks={kiosks}
          initialStats={initialStats} 
      />
    </Suspense>
  )
}
