"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

export async function deleteKioskAction(kioskId: string) {
    const supabase = await createClient()

    // Verify ownership
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "No autenticado" }

    // Check if user is owner of this kiosk
    const { data: member } = await supabase
        .from('kiosk_members')
        .select('role')
        .eq('kiosk_id', kioskId)
        .eq('user_id', user.id)
        .single()
    
    try {
        const { data, error } = await supabase.rpc('delete_kiosk_fully', {
            target_kiosk_id: kioskId
        })

        if (error) throw error
        
        // Handle custom JSON return from RPC
        if (data && !data.success) {
            return { error: data.error }
        }

        revalidatePath("/settings")
        return { success: true }

    } catch (error: any) {
        console.error("Delete Kiosk Error:", error)
        return { error: error.message }
    }
}
