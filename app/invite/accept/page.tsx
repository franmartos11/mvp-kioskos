"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/utils/supabase/client"
import { Loader2 } from "lucide-react"
import { Suspense } from "react"

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (!token) {
      setErrorMsg("No se encontró el token de invitación.")
      setStatus("error")
      return
    }

    // Poll for session — after signUp the session cookie can take a moment
    let attempts = 0
    const maxAttempts = 10

    const tryAccept = async () => {
      attempts++

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (attempts < maxAttempts) {
          // Wait 500ms and retry
          setTimeout(tryAccept, 500)
        } else {
          setErrorMsg("Debés iniciar sesión para aceptar la invitación.")
          setStatus("error")
        }
        return
      }

      // User is authenticated — call the server route with token in URL
      try {
        const res = await fetch(`/api/invite/accept?token=${token}`, {
          method: "GET",
          credentials: "include",
          redirect: "follow",
        })
        // Redirect to POS on success
        router.replace("/pos")
      } catch (e) {
        setErrorMsg("Ocurrió un error al procesar la invitación.")
        setStatus("error")
      }
    }

    tryAccept()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-red-600 font-semibold text-lg">Invitación fallida</p>
        <p className="text-sm text-gray-600">{errorMsg}</p>
        <button
          className="mt-4 text-blue-600 underline text-sm"
          onClick={() => router.push("/login")}
        >
          Ir al login
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Procesando invitación…</p>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <AcceptInviteContent />
    </Suspense>
  )
}
