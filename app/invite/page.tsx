import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { validateInvitationToken } from '../actions/invitations'

export default async function InvitePage({
  searchParams,
}: {
  searchParams: { token: string }
}) {
  const token = searchParams.token

  if (!token) {
    return <InvalidInviteMessage message="Falta el token de invitación." />
  }

  const result = await validateInvitationToken(token)

  if (!result.success || !result.invitation) {
    return <InvalidInviteMessage message={result.error || "Token inválido."} />
  }

  const { invitation } = result
  
  // Check if they are already logged in
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    // If logged in, redirect them to accept the invite via an API route
    redirect('/api/invite/accept')
  }

  // Not logged in -> go to a specialized registration/login path
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Invitación a Kiosko</CardTitle>
          <CardDescription>
            Has sido invitado a unirte a <strong>{(invitation.kiosks as any).name}</strong> como {invitation.role === 'owner' ? 'Dueño' : 'Vendedor'}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-center text-sm text-gray-600 mb-4">
            Para aceptar esta invitación, debes iniciar sesión o crear una cuenta con el correo: <strong>{invitation.email}</strong>.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild>
              <Link href={`/auth/register?email=${encodeURIComponent(invitation.email)}&invite_token=${token}`}>
                Crear nueva cuenta
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/login?email=${encodeURIComponent(invitation.email)}&redirect=${encodeURIComponent(`/api/invite/accept?token=${token}`)}`}>
                Ya tengo cuenta, Iniciar Sesión
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InvalidInviteMessage({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-red-600">Invitación Inválida</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link href="/">Volver al inicio</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
