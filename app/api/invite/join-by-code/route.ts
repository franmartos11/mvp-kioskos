import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.trim().toUpperCase()

  if (!code) {
    return NextResponse.redirect(new URL('/join?error=' + encodeURIComponent('Falta el código de invitación.'), request.url))
  }

  const supabase = await createClient()

  try {
    // 1. Require authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      // Not logged in — send them to login, preserving the code
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(`/join?code=${code}`)}`, request.url)
      )
    }

    // 2. Validate code via SECURITY DEFINER RPC
    const { data: rows, error: rpcError } = await supabase
      .rpc('validate_invitation_by_code', { p_code: code })

    if (rpcError || !rows || rows.length === 0) {
      return NextResponse.redirect(
        new URL('/join?error=' + encodeURIComponent('El código es inválido o ya expiró.'), request.url)
      )
    }

    const invitation = rows[0]

    // 3. SECURITY: Verify the user's email matches the invitation
    // Only do this if the invitation has an email set (it always should)
    if (invitation.email && user.email && user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.redirect(
        new URL(
          '/join?error=' + encodeURIComponent(
            `Este código fue enviado a ${invitation.email}. Iniciá sesión con esa cuenta.`
          ),
          request.url
        )
      )
    }

    // 4. Default permissions by role
    const defaultPermissions = invitation.role === 'owner'
      ? {
          view_dashboard: true, view_finance: true, manage_products: true,
          view_costs: true, manage_stock: true, manage_members: true, view_reports: true
        }
      : {
          view_dashboard: false, view_finance: false, manage_products: false,
          view_costs: false, manage_stock: true, manage_members: false, view_reports: false
        }

    // 5. Create kiosk_member (idempotent — ignore duplicate)
    const { error: memberError } = await supabase
      .from('kiosk_members')
      .insert({
        kiosk_id: invitation.kiosk_id,
        user_id: user.id,
        role: invitation.role,
        permissions: defaultPermissions
      })

    if (memberError && memberError.code !== '23505') {
      throw memberError
    }

    // 6. Mark invitation as accepted
    await supabase
      .from('kiosk_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id)

    // 7. Redirect to POS
    return NextResponse.redirect(new URL('/pos', request.url))

  } catch (error: any) {
    console.error('[join-by-code] Error:', error)
    return NextResponse.redirect(
      new URL('/join?error=' + encodeURIComponent('Ocurrió un error al procesar el código.'), request.url)
    )
  }
}
