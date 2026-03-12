import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { kioskId, email, role } = body

    if (!kioskId || !email || !role) {
      return NextResponse.json({ success: false, error: 'Faltan datos requeridos' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Verify caller is owner
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'No estás autenticado' }, { status: 401 })
    }

    const { data: isOwner } = await supabase
      .rpc('is_kiosk_owner', { p_kiosk_id: kioskId })

    if (!isOwner) {
      return NextResponse.json({ success: false, error: 'No tenés permiso para invitar usuarios a este kiosco' }, { status: 403 })
    }

    // 2. Revoke any existing pending invitation for the same email+kiosk
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
      console.error('[api/invite/create] Insert error:', insertError)
      return NextResponse.json({ success: false, error: 'No se pudo crear la invitación' }, { status: 500 })
    }

    return NextResponse.json({ success: true, inviteCode: inviteCode })
  } catch (error: any) {
    console.error('[api/invite/create] Unexpected error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
