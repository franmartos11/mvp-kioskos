'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'

export async function inviteUser(kioskId: string, email: string, role: string) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // 1. Verify caller is owner
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No estás autenticado')

    const { data: isOwner } = await supabase
      .rpc('is_kiosk_owner', { p_kiosk_id: kioskId })
    
    if (!isOwner) throw new Error('No tenés permiso para invitar usuarios a este kiosco')

    // 2. Create invitation record in our DB (generates the token to track acceptance)
    const token = uuidv4()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)

    const { error: insertError } = await supabase
      .from('kiosk_invitations')
      .insert({
        kiosk_id: kioskId,
        email,
        role,
        token,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        invited_by: user.id
      })

    if (insertError) {
      console.error('[invite] Insert error:', insertError)
      throw new Error('No se pudo crear la invitación')
    }

    // 3. Fetch kiosk name for context
    const { data: kioskData } = await supabase
      .from('kiosks')
      .select('name')
      .eq('id', kioskId)
      .single()
    const kioskName = kioskData?.name || 'el Kiosco'

    // 4. Build the redirect URL that Supabase will send in the email link.
    //    Flow: email link → /auth/callback?code=...&next=/invite?token=X
    //          → callback exchanges code → redirects to /invite?token=X
    //          → /invite validates token & session → /api/invite/accept
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(`/invite?token=${token}`)}`

    // 5. Use Supabase Auth admin to invite the user.
    //    - If user already exists: sends a magic link (OTP) to sign them in
    //    - If user doesn't exist: sends an invite email to create their account
    //    Either way, Supabase handles the email delivery with its own SMTP.
    const { data: authData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        invited_to_kiosk: kioskName,
        invited_as: role === 'owner' ? 'Dueño' : 'Vendedor',
      }
    })

    if (authError) {
      console.error('[invite] Supabase auth invite error:', authError)

      // If user already exists, Supabase returns an error for invite but the user IS in the system.
      // In that case, try sending a magic link (OTP) instead so they can sign in and accept.
      if (authError.message?.includes('already been registered') || authError.code === 'email_exists') {
        const { error: otpError } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo }
        })
        if (otpError) {
          console.error('[invite] OTP fallback error:', otpError)
          // Invitation was created in DB, they can use the link from a future email
          // Don't throw - the db record is fine, just notify about email
          console.log('[invite] Invitation saved to DB. Could not send email to existing user:', email)
        } else {
          console.log('[invite] Magic link sent to existing user:', email)
        }
      } else {
        // For other errors, log but don't throw - the invitation record was created
        console.error('[invite] Could not send invite email:', authError.message)
      }
    } else {
      console.log('[invite] Invitation email sent successfully to:', email)
    }

    revalidatePath('/employees')
    return { success: true }
  } catch (error: any) {
    console.error('[invite] Error:', error)
    return { success: false, error: error.message }
  }
}

export async function validateInvitationToken(token: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('kiosk_invitations')
    .select('*, kiosks(name)')
    .eq('token', token)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single()
    
  if (error || !data) {
    return { success: false, error: 'Token inválido o expirado' }
  }
  
  return { success: true, invitation: data }
}

export async function cancelInvitation(invitationId: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('kiosk_invitations')
      .update({ status: 'revoked' })
      .eq('id', invitationId)
      
    if (error) throw error
    revalidatePath('/employees')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
