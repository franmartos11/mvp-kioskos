'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function inviteUser(kioskId: string, email: string, role: string) {
  try {
    const supabase = await createClient()

    // 1. Verify caller is owner
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No estás autenticado')

    const { data: isOwner } = await supabase
      .rpc('is_kiosk_owner', { p_kiosk_id: kioskId })

    if (!isOwner) throw new Error('No tenés permiso para invitar usuarios a este kiosco')

    // 2. Create invitation record in DB
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

    // 3. Fetch kiosk name
    const { data: kioskData } = await supabase
      .from('kiosks')
      .select('name')
      .eq('id', kioskId)
      .single()
    const kioskName = kioskData?.name || 'el Kiosco'

    // 4. Build invite link — goes to /invite page which handles new & existing users
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const inviteLink = `${siteUrl}/invite?token=${token}`
    const roleLabel = role === 'owner' ? 'Dueño' : 'Vendedor'

    // 5. Send email via Resend (no rate limits like Supabase SMTP)
    const { error: emailError } = await resend.emails.send({
      from: 'KioskApp <onboarding@resend.dev>',
      to: email,
      subject: `Te invitaron a unirte a ${kioskName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #2563eb; font-size: 28px; margin: 0;">KioskApp</h1>
          </div>
          <h2 style="font-size: 20px;">Fuiste invitado a unirte a <strong>${kioskName}</strong></h2>
          <p>Alguien te invitó a ser <strong>${roleLabel}</strong> en <strong>${kioskName}</strong>.</p>
          <p>
            Hacé clic en el botón de abajo para aceptar la invitación.<br>
            <span style="color: #555;">Si todavía no tenés cuenta, podés crear una gratuitamente.</span>
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteLink}"
              style="background-color: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Aceptar invitación
            </a>
          </div>
          <p style="color: #888; font-size: 13px;">O copiá este enlace en tu navegador:</p>
          <p style="color: #2563eb; font-size: 13px; word-break: break-all;">${inviteLink}</p>
          <p style="color: #666; font-size: 13px;">Este enlace expirará en 48 horas.</p>
          <p style="color: #666; font-size: 13px;">Si no esperabas esta invitación, podés ignorar este correo.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">KioskApp — Sistema de gestión para kioscos</p>
        </body>
        </html>
      `
    })

    if (emailError) {
      console.error('[invite] Resend error:', emailError)
      // Invitation is saved in DB anyway, but warn about email failure
      console.warn('[invite] Invitation saved to DB but email could not be sent to:', email)
      // Don't throw — the DB record exists, admin can resend manually
    } else {
      console.log('[invite] Invitation email sent via Resend to:', email)
    }

    revalidatePath('/employees')
    return { success: true }
  } catch (error: any) {
    console.error('[invite] Unexpected error:', error)
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
