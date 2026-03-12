"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, KeyRound, Store, AlertCircle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

function JoinContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [code, setCode] = useState(searchParams.get("code") || "")
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [codeStatus, setCodeStatus] = useState<null | "checking" | "valid" | "invalid">(null)
  const [codeKioskName, setCodeKioskName] = useState("")
  const [codeEmail, setCodeEmail] = useState("")
  const errorParam = searchParams.get("error")

  // Check if the user is already authenticated
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setChecking(false)
    })
  }, [])

  // Auto-submit if code is pre-filled from URL
  useEffect(() => {
    const urlCode = searchParams.get("code")
    if (urlCode && user && !loading) {
      handleJoin(urlCode)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const validateCode = async (val: string) => {
    const trimmed = val.trim().toUpperCase()
    if (!trimmed || trimmed.length < 6) {
      setCodeStatus(null)
      return
    }
    setCodeStatus('checking')
    try {
      const { data: rows } = await supabase.rpc('validate_invitation_by_code', { p_code: trimmed })
      if (rows && rows.length > 0) {
        setCodeStatus('valid')
        setCodeKioskName(rows[0].kiosk_name || '')
        setCodeEmail(rows[0].email || '')
      } else {
        setCodeStatus('invalid')
        setCodeKioskName('')
        setCodeEmail('')
      }
    } catch {
      setCodeStatus('invalid')
    }
  }

  const handleJoin = async (overrideCode?: string) => {
    const finalCode = (overrideCode || code).trim().toUpperCase()
    if (!finalCode) {
      toast.error("Ingresá el código de invitación")
      return
    }

    if (!user) {
      // Not logged in — send to login and come back here
      router.push(`/login?redirect=${encodeURIComponent(`/join?code=${finalCode}`)}`)
      return
    }

    setLoading(true)
    try {
      // Navigate to the API route — it handles all the logic and redirects
      window.location.href = `/api/invite/join-by-code?code=${finalCode}`
    } catch {
      toast.error("Error al procesar el código.")
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="bg-primary/10 p-3 rounded-full">
              <Store className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Unirte a un Kiosco</CardTitle>
          <CardDescription>
            Ingresá el código que te dio el dueño del kiosco para unirte como vendedor.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error message from API redirect */}
          {errorParam && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorParam}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="invite-code">Código de Invitación</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="invite-code"
                placeholder="Ej: K3X9QA"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase())
                  setCodeStatus(null)
                }}
                onBlur={(e) => validateCode(e.target.value)}
                className={`pl-9 uppercase tracking-widest font-mono text-lg text-center ${
                  codeStatus === 'valid' ? 'border-green-500' :
                  codeStatus === 'invalid' ? 'border-red-400' : ''
                }`}
                maxLength={6}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                autoFocus
              />
            </div>
            {/* Inline validation feedback */}
            {codeStatus === 'checking' && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Verificando...
              </p>
            )}
            {codeStatus === 'valid' && (
              <div className="p-2 bg-green-50 border border-green-200 rounded-md text-xs text-green-700 space-y-0.5">
                <p className="font-semibold">✅ Kiosco: <strong>{codeKioskName}</strong></p>
                {codeEmail && <p className="text-green-600">Código enviado a <strong>{codeEmail}</strong></p>}
              </div>
            )}
            {codeStatus === 'invalid' && (
              <p className="text-xs text-red-600">❌ Código inválido o expirado. Verificá con el dueño del kiosco.</p>
            )}
            <p className="text-xs text-muted-foreground text-center">
              El código tiene 6 caracteres y te lo envió el dueño del kiosco.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={() => handleJoin()}
            disabled={loading || code.trim().length === 0}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</>
            ) : (
              "Unirme al Kiosco"
            )}
          </Button>

          {!user && (
            <p className="text-center text-sm text-muted-foreground">
              Necesitás{" "}
              <Link href="/login" className="text-primary font-semibold hover:underline">
                iniciar sesión
              </Link>{" "}
              o{" "}
              <Link href="/auth/register" className="text-primary font-semibold hover:underline">
                crear una cuenta
              </Link>{" "}
              primero.
            </p>
          )}

          {user && (
            <p className="text-center text-xs text-muted-foreground">
              Sesión iniciada como <strong>{user.email}</strong>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  )
}
