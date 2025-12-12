"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { revalidatePath } from "next/cache"

export async function createEmployee(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const fullName = formData.get("fullName") as string
  const kioskId = formData.get("kioskId") as string

  if (!email || !password || !kioskId) {
    return { error: "Faltan datos requeridos" }
  }

  const supabase = createAdminClient()

  try {
    // 1. Create User in Auth
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirm
      user_metadata: {
        full_name: fullName
      }
    })

    if (createError) throw createError
    if (!userData.user) throw new Error("No se pudo crear el usuario")
    
    // 2. Add to Kiosk Members
    const { error: memberError } = await supabase
        .from('kiosk_members')
        .insert({
            user_id: userData.user.id,
            kiosk_id: kioskId,
            role: 'seller'
        })
    
    if (memberError) {
        // Optional: rollback user creation if member add fails? 
        // For simpler MVP, just throw. User exists but not assigned.
        throw memberError
    }

    revalidatePath("/settings")
    return { success: true }

  } catch (error: any) {
    console.error("Create Employee Error:", error)
    return { error: error.message || "Error al crear empleado" }
  }
}
