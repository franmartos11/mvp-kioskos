"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"

export async function resetUserPassword(targetUserId: string, newPassword: string) {
    const supabase = await createClient() // standard client for auth check

    // 1. Check if caller is logged in
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: "No autenticado" }
    }

    // 2. Check if caller is an Owner (Security)
    // We check if they maintain any kiosk where they are owner. 
    // Ideally we check if they are owner of the kiosk the target user belongs to, 
    // but for now, general Owner role check is a decent baseline for this MVP, 
    // assuming Owners can manage any user they see in their list.
    // A stricter check would be: Does `user.id` own a Kiosk where `targetUserId` is a member?
    
    // Check if target user is in a kiosk owned by caller
    const { data: memberCheck } = await supabase
        .from('kiosk_members')
        .select('kiosk_id, kiosks!inner(id, members:kiosk_members!inner(user_id, role))')
        .eq('user_id', targetUserId)
        .eq('kiosks.members.user_id', user.id)
        .eq('kiosks.members.role', 'owner')
        .limit(1)

    // The query above is complex. Let's simplify:
    // Fetch kiosks owned by Caller
    const { data: ownedKiosks } = await supabase
        .from('kiosk_members')
        .select('kiosk_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
    
    const ownedKioskIds = ownedKiosks?.map(k => k.kiosk_id) || []

    if (ownedKioskIds.length === 0) {
        return { error: "No tienes permisos de administrador (Dueño)" }
    }

    // Check if Target is member of one of these kiosks
    const { data: targetMember } = await supabase
        .from('kiosk_members')
        .select('id')
        .eq('user_id', targetUserId)
        .in('kiosk_id', ownedKioskIds)
        .limit(1)
        .single()
    
    if (!targetMember) {
        return { error: "Este usuario no pertenece a tu equipo" }
    }

    // 3. Perform Update
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(
        targetUserId,
        { password: newPassword }
    )

    if (error) {
        console.error("Change Password Error:", error)
        return { error: error.message }
    }

    revalidatePath("/settings")
    return { success: true }
}
