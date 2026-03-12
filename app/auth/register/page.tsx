"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, ShoppingCart, KeyRound, Store, Users } from "lucide-react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function RegisterAsSellerForm() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get("email") || ""
  const inviteToken = searchParams.get("invite_token") || ""
  const inviteCodeFromUrl = searchParams.get("invite_code") || ""
  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [inviteCode, setInviteCode] = useState(inviteCodeFromUrl)
  const [activeTab, setActiveTab] = useState<"create" | "join">(initialEmail || inviteCodeFromUrl ? "join" : "create")
  const [loading, setLoading] = useState(false)
  // Code validation state: null = not validated, 'valid' | 'invalid' | 'checking'
  const [codeStatus, setCodeStatus] = useState<null | "checking" | "valid" | "invalid">(null)
  const [codeKioskName, setCodeKioskName] = useState("")
  const [codeEmail, setCodeEmail] = useState("")

  const isInviteFlow = !!initialEmail && !!inviteToken

  // Validate code on-blur by querying Supabase directly
  const validateCode = async (code: string) => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed || trimmed.length < 6) {
      setCodeStatus(null)
      return
    }
    setCodeStatus("checking")
    try {
      const { data: rows } = await supabase.rpc('validate_invitation_by_code', { p_code: trimmed })
      if (rows && rows.length > 0) {
        setCodeStatus("valid")
        setCodeKioskName(rows[0].kiosk_name || "")
        setCodeEmail(rows[0].email || "")
      } else {
        setCodeStatus("invalid")
        setCodeKioskName("")
        setCodeEmail("")
      }
    } catch {
      setCodeStatus("invalid")
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mvp-kioskos.vercel.app'

      // Determine where Supabase should redirect after email confirmation
      let emailRedirectTo: string
      // Always treat it as join flow if the user provided an invite token OR is in the join tab WITH an invite code
      const isActuallyJoining = isInviteFlow || (activeTab === "join" && inviteCode.trim())

      if (isInviteFlow) {
        // Came from invite link — accept the token-based invitation
        emailRedirectTo = `${siteUrl}/invite/accept?token=${inviteToken}`
      } else if (isActuallyJoining) {
        // User entered a short code — redirect to /join after confirming email
        emailRedirectTo = `${siteUrl}/join?code=${inviteCode.trim().toUpperCase()}`
      } else {
        // Normal registration (create tab) — go to dashboard (owner will create kiosk there via onboarding)
        emailRedirectTo = `${siteUrl}/dashboard`
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo,
        }
      })

      if (authError) {
        toast.error("Error al registrarse: " + authError.message)
        return
      }

      if (!authData.user) {
        toast.error("No se pudo crear el usuario")
        return
      }

      // Duplicated email check (Supabase returns empty identities when email exists)
      if (authData.user.identities && authData.user.identities.length === 0) {
        toast.error("Este email ya está registrado. Por favor inicia sesión.")
        return
      }

      if (isInviteFlow && inviteToken) {
        toast.success("¡Cuenta creada! Revisá tu email para confirmar tu cuenta y aceptar la invitación.")
      } else if (isActuallyJoining) {
        toast.success("¡Cuenta creada! Revisá tu email para confirmarla y unirte al kiosco.")
      } else {
        toast.success("¡Cuenta creada! Revisá tu email para confirmar tu cuenta.")
        router.push("/login")
      }
    } catch (error) {
      toast.error("Ocurrió un error inesperado")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <Link
        href="/login"
        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Volver</span>
      </Link>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <ShoppingCart className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Crear cuenta</CardTitle>
          <CardDescription>
            {isInviteFlow
              ? "Creá tu cuenta para aceptar la invitación."
              : activeTab === "create"
              ? "Registrate gratis para empezar a gestionar tu kiosco"
              : "Registrate e ingresá el código para unirte a un equipo"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {!isInviteFlow ? (
            <Tabs 
              value={activeTab} 
              onValueChange={(val) => {
                setActiveTab(val as "create" | "join")
                // Clear code if switching to create
                if (val === "create") setInviteCode("")
              }} 
              className="mb-8"
            >
              <TabsList className="grid w-full grid-cols-2 mb-2">
                <TabsTrigger value="create" className="gap-2">
                  <Store className="h-4 w-4" />
                  <span className="hidden sm:inline">Crear Kiosco</span>
                  <span className="sm:hidden">Crear</span>
                </TabsTrigger>
                <TabsTrigger value="join" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">Unirme a uno</span>
                  <span className="sm:hidden">Unirme</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Invite code field shown ONLY in join tab when not an invite flow */}
            {!isInviteFlow && activeTab === "join" && (
              <div className="space-y-2 p-4 bg-primary/5 border border-primary/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="invite-code" className="flex items-center gap-1.5 font-bold text-primary">
                  <KeyRound className="h-4 w-4" />
                  Código de Invitación <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  El dueño o administrador debe pasarte este código (Ej: K3X9QA).
                </p>
                <Input
                  id="invite-code"
                  type="text"
                  placeholder="K3X9QA"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value.toUpperCase())
                    setCodeStatus(null) // reset on change
                  }}
                  onBlur={(e) => validateCode(e.target.value)}
                  maxLength={6}
                  required={activeTab === "join"}
                  className={`uppercase tracking-widest font-mono text-center text-lg bg-background ${
                    codeStatus === 'valid' ? 'border-green-500 focus-visible:ring-green-400' :
                    codeStatus === 'invalid' ? 'border-red-400 focus-visible:ring-red-300' : ''
                  }`}
                />
                {/* Feedback messages */}
                {codeStatus === 'checking' && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Verificando código...
                  </p>
                )}
                {codeStatus === 'valid' && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md text-xs text-green-700 space-y-0.5">
                    <p className="font-semibold">✅ Código válido — Kiosco: <strong>{codeKioskName}</strong></p>
                    {codeEmail && (
                      <p className="text-green-600">
                        Este código fue enviado a <strong>{codeEmail}</strong>. 
                        Asegurate de registrarte con ese email.
                      </p>
                    )}
                  </div>
                )}
                {codeStatus === 'invalid' && (
                  <p className="mt-1 text-xs text-red-600">
                    ❌ Código inválido o expirado. Verificá con el dueño del kiosco.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Nombre completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Juan Pérez"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                // If coming from an invite link, lock the email field
                readOnly={isInviteFlow}
                className={isInviteFlow ? "bg-muted cursor-not-allowed" : ""}
              />
              {isInviteFlow && (
                <p className="text-xs text-muted-foreground">
                  Este email está asociado a tu invitación y no puede cambiarse.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button className="w-full mt-6 shadow-md hover:shadow-lg transition-all" type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isInviteFlow 
                ? "Crear cuenta y aceptar invitación" 
                : activeTab === "join" 
                ? "Registrarme y Unirme" 
                : "Crear Cuenta"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{" "}
            <Link
              href={isInviteFlow ? `/login?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(`/invite/accept?token=${inviteToken}`)}` : "/login"}
              className="font-semibold text-primary hover:underline"
            >
              Iniciar sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <RegisterAsSellerForm />
    </Suspense>
  )
}
