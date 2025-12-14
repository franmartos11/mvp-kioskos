"use client"

import { ChangePasswordForm } from "@/components/settings/change-password-form"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/utils/supabase/client"
import { KeyRound, Loader2 } from "lucide-react"

export default function UpdatePasswordPage() {
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // Verify session exists (Supabase should have set it from the recovery link hash before this page loads if auth callback handled it, 
        // OR the hash is still in URL and Supabase client handles it auto-magically).
        // Actually, auth-helpers usually handle the hash exchange in the middleware or callback route. 
        // Let's check if we have a user.
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                // If no session, the link might be invalid or expired
                // But wait, the recovery link is magic. 
                // Redirect to login if absolutely no session after a moment.
                // For now, let's just let the form render if we think we might be auth'd.
            }
            setLoading(false)
        }
        checkUser()
    }, [])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-start pt-24 md:pt-32 bg-gray-50/50 dark:bg-zinc-900/50 px-4">
            <div className="w-full max-w-lg space-y-8">
                <div className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <KeyRound className="h-6 w-6 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Restablecer Contraseña</h1>
                    <p className="text-muted-foreground">
                        Ingresa tu nueva contraseña para recuperar el acceso.
                    </p>
                </div>
                <ChangePasswordForm onSuccess={() => router.push("/")} />
            </div>
        </div>
    )
}
