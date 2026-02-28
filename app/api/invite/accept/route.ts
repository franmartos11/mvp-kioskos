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

    // 2. Validate token again
    const { data: invitation, error: inviteError } = await supabase
      .from('kiosk_invitations')
      .select('id, kiosk_id, email, role')
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invitation) {
      throw new Error('La invitación es inválida o ha expirado.')
    }

    // 3. (Optional) Check if email matches.
    // If you want strict matching, uncomment this:
    // if (user.email !== invitation.email) {
    //   throw new Error('El correo de la invitación no coincide con el de la cuenta.')
    // }

    // 4. Create Kiosk Member
    const { error: memberError } = await supabase
      .from('kiosk_members')
      .insert({
        kiosk_id: invitation.kiosk_id,
        user_id: user.id,
        role: invitation.role
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
