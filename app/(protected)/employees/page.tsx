import { createClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"
import { InviteSellerDialog } from "@/components/employees/invite-seller-dialog"
import { EmployeesList } from "@/components/employees/employees-list"
import { ShiftLogger } from "@/components/employees/shift-logger"
import { ShiftCalendar } from "@/components/employees/shift-calendar"
import { PendingInvitationsList } from "@/components/employees/pending-invitations-list"

export default async function EmployeesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  // Fetch Kiosks (User must be owner to see this presumably, or standard member)
  const { data: members } = await supabase
    .from('kiosk_members')
    .select(`
        kiosk_id,
        role,
        kiosks (
            id,
            name
        )
    `)
    .eq('user_id', user.id)

  const kiosks = (members || []).map((m: any) => ({
      id: m.kiosks.id,
      name: m.kiosks.name,
      role: m.role
  }))

  const kioskIds = kiosks.map((k: any) => k.id)

  // Fetch "Employees" defined as Sellers in these kiosks
  // We need to fetch kiosk_members where role='seller' for these kiosks
  // And join with 'profiles' (for name) and 'employees' (for rate)
  
  let employees: any[] = []
  let shifts: any[] = []
  let pendingInvitations: any[] = []

  if (kioskIds.length > 0) {
      
      // 1. Fetch Members (Sellers)
      const { data: sellers } = await supabase
        .from('kiosk_members')
        .select('*')
        .in('kiosk_id', kioskIds)
        // .eq('role', 'seller') // Keep implicit for now or add back if owners shouldn't be here

      // Also Fetch Pending Invitations
      const { data: invites } = await supabase
        .from('kiosk_invitations')
        .select('*')
        .in('kiosk_id', kioskIds)
        .eq('status', 'pending')
        
      if (invites) {
          pendingInvitations = invites
      }

      const userIds = (sellers || []).map((s: any) => s.user_id)

      // 2. Fetch Profiles for these users
      let profilesMap: Record<string, any> = {}
      if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds)
          
          profiles?.forEach((p: any) => {
              profilesMap[p.id] = p
          })
      }

      // 3. Fetch Employee Details (Rate, etc)
      let employeesDetailsMap: Record<string, any> = {}
      if (userIds.length > 0) {
          const { data: details } = await supabase
            .from('employees')
            .select('*')
            .in('user_id', userIds)
            .in('kiosk_id', kioskIds)
          
          details?.forEach((d: any) => {
              employeesDetailsMap[`${d.user_id}-${d.kiosk_id}`] = d
          })
      }

      // 4. Merge & Calculate Monthly Hours
      const currentMonthPrefix = new Date().toISOString().slice(0, 7) // YYYY-MM
      
      // Move Shifts Fetch UP to populate this!
      try {
          const { data: shiftData } = await supabase
            .from('work_shifts')
            .select('*')
            .order('date', { ascending: false })
            .limit(500)
          
          if (shiftData) shifts = shiftData
      } catch (e) { console.error(e) }

      employees = (sellers || []).map((seller: any) => {
          const profile = profilesMap[seller.user_id]
          const details = employeesDetailsMap[`${seller.user_id}-${seller.kiosk_id}`]
          
          // Generate a unique ID for the UI key even if DB id is missing
          const uiKey = details?.id || seller.id || `temp-${seller.user_id}`

          // Calculate hours
          const empShifts = shifts.filter((s: any) => s.employee_id === details?.id && s.date.startsWith(currentMonthPrefix))
          const total = empShifts.reduce((acc: number, curr: any) => acc + (curr.total_hours || 0), 0)
          
          return {
              id: details?.id, 
              ui_key: uiKey,
              user_id: seller.user_id,
              kiosk_id: seller.kiosk_id,
              first_name: profile?.full_name || "Usuario", 
              last_name: "", 
              email: profile?.email || "Sin email",
              hourly_rate: details?.hourly_rate || 0,
              alias: details?.alias,
              monthly_hours: total // Populated
          }
      })
  }

      // 5. Fetch Schedules (Safely, in case table doesn't exist yet)
      let schedules: any[] = []
      try {
          const { data: schedData, error: schedError } = await supabase
            .from('employee_schedules')
            .select('*')
           
           if (!schedData && schedError) {
               // ignore
           } else if (schedData) {
               schedules = schedData
           }
      } catch (e) {
          console.error("Schedules table likely missing or error:", e)
      }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Empleados & Horarios</h1>
            <p className="text-muted-foreground">
                Gestión de vendedores, turnos y liquidación de sueldos.
            </p>
        </div>
        <div className="flex gap-2">
            <ShiftLogger employees={employees} kiosks={kiosks} />
            <InviteSellerDialog kiosks={kiosks} />
        </div>
      </div>

      {/* Calendar / Schedules Section */}
      <ShiftCalendar employees={employees} schedules={schedules} shifts={shifts} />

      {/* Pending Invitations Section */}
      {pendingInvitations.length > 0 && (
          <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Invitaciones Pendientes</h2>
              <PendingInvitationsList invitations={pendingInvitations} />
          </div>
      )}

      {/* List Section */}
      <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Listado de Personal</h2>
          <EmployeesList employees={employees} userId={user.id} />
      </div>
    </div>
  )
}

