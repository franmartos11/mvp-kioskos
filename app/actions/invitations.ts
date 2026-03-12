'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'

export async function inviteUser(kioskId: string, email: string, role: string) {
  console.log('[inviteUser ACTION START] kioskid:', kioskId, 'email:', email, 'role:', role)
  try {
    const supabase = await createClient()

    // 1. Verify caller is owner
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No estás autenticado')

    const { data: isOwner } = await supabase
      .rpc('is_kiosk_owner', { p_kiosk_id: kioskId })

    if (!isOwner) throw new Error('No tenés permiso para invitar usuarios a este kiosco')

    // 2. Revoke any existing pending invitation for the same email+kiosk
    // (required by the unique partial index on (kiosk_id, email) WHERE status='pending')
    await supabase
      .from('kiosk_invitations')
      .update({ status: 'revoked' })
      .eq('kiosk_id', kioskId)
      .eq('email', email)
      .eq('status', 'pending')

    // 3. Generate a short human-readable invite code via DB function
    const { data: codeData } = await supabase.rpc('generate_invite_code')
    const inviteCode: string = codeData || ''

    // 4. Create new invitation record in DB
    const token = uuidv4()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)

    console.log('[inviteUser] Ready to insert. Token:', token, 'Code:', inviteCode)

    const { error: insertError } = await supabase
      .from('kiosk_invitations')
      .insert({
        kiosk_id: kioskId,
        email,
        role,
        token,
        invite_code: inviteCode,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        invited_by: user.id
      })

    if (insertError) {
      console.error('[invite] Insert error:', insertError)
      throw new Error('No se pudo crear la invitación')
    }

    // 3. Fetch kiosk name
    const { data: kioskData } = await supabase
      .from('kiosks')
      .select('name')
      .eq('id', kioskId)
      .single()
    const kioskName = kioskData?.name || 'el Kiosco'

    // 4. Build invite link pointing to production
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mvp-kioskos.vercel.app'
    const inviteLink = `${siteUrl}/invite/accept?token=${token}`
    const roleLabel = role === 'owner' ? 'Dueño' : 'Vendedor'

    // We removed Resend emails as requested by the user, we just generate the code.
    // The UI handles WhatsApp sharing.

    revalidatePath('/employees')
    console.log('[inviteUser] Success. Returning code.')
    return { success: true, inviteCode: inviteCode }
  } catch (error: any) {
    console.error('[invite] Unexpected error in action body:', error)
    return { success: false, error: error.message }
  }
}

export async function validateInvitationToken(token: string) {
  const supabase = await createClient()

  // Use the SECURITY DEFINER RPC to look up by token.
  // This avoids exposing all pending invitations via direct table access.
  const { data, error } = await supabase
    .rpc('validate_invitation_by_token', { p_token: token })

  if (error || !data || data.length === 0) {
    return { success: false, error: 'Token inválido o expirado' }
  }

  const row = data[0]
  // Shape data to match what the invite page expects: invitation + nested kiosks.name
  const invitation = {
    id: row.id,
    kiosk_id: row.kiosk_id,
    email: row.email,
    role: row.role,
    expires_at: row.expires_at,
    kiosks: { name: row.kiosk_name }
  }

  return { success: true, invitation }
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
