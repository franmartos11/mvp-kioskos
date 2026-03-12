import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cookieStore = await cookies()
  
  // Token comes from URL param (primary) or cookie (legacy fallback)
  const token = searchParams.get('token') || cookieStore.get('kiosk_invite_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const supabase = await createClient()

  try {
    // 1. Check if user is logged in
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      throw new Error('Debes iniciar sesión para aceptar la invitación.')
    }

    // 2. Validate token via SECURITY DEFINER RPC (consistent with join-by-code)
    const { data: rows, error: inviteError } = await supabase
      .rpc('validate_invitation_by_token', { p_token: token })

    const invitation = rows?.[0]

    if (inviteError || !invitation) {
      throw new Error('La invitación es inválida o ha expirado.')
    }

    // 3. (Removed) Email strict check
    // We used to block if user.email !== invitation.email.
    // However, if the owner sends an invite to 'test@gmail.com' and the user signs up
    // as 'testxyz@gmail.com', the token/link itself is proof of invitation.

    // 4. Create Kiosk Member with correct default permissions based on role
    const defaultPermissions = invitation.role === 'owner'
      ? {
          view_dashboard: true, view_finance: true, manage_products: true,
          view_costs: true, manage_stock: true, manage_members: true, view_reports: true
        }
      : {
          view_dashboard: false, view_finance: false, manage_products: false,
          view_costs: false, manage_stock: true, manage_members: false, view_reports: false
        }

    const { error: memberError } = await supabase
      .from('kiosk_members')
      .insert({
        kiosk_id: invitation.kiosk_id,
        user_id: user.id,
        role: invitation.role,
        permissions: defaultPermissions
      })

    // It's possible the user is already a member (e.g. they clicked the link twice)
    // We ignore unique constraint errors (code 23505) but throw others.
    if (memberError && memberError.code !== '23505') {
       throw memberError
    }

    // 5. Mark invitation as accepted
    await supabase
      .from('kiosk_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id)

    // 6. Clear cookie
    cookieStore.delete('kiosk_invite_token')

    // 7. Redirect to pos (dashboard main screen)
    return NextResponse.redirect(new URL('/pos', request.url))

  } catch (error: any) {
    // Handle error, maybe redirect to an error page or back to /invite?error
    console.error('Error accepting invitation:', error)
    return NextResponse.redirect(new URL('/dashboard?error=' + encodeURIComponent(error.message), request.url))
  }
}
