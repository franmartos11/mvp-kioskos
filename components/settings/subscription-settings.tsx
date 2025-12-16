"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { supabase } from "@/utils/supabase/client"
import { Loader2, Check } from "lucide-react"
import { PLANS, PlanId } from "@/lib/plans"

function SubscriptionSettingsContent() {
    const [loading, setLoading] = useState(true)
    const [subscribing, setSubscribing] = useState<string | null>(null)
    const [subscription, setSubscription] = useState<any>(null)
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        loadSubscription()
        if (searchParams.get('status') === 'success') {
            toast.success("¡Suscripción exitosa!")
            // Clean URL
            router.replace('/settings')
        }
    }, [])

    async function loadSubscription() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .single() // Might be null if no subscription

            if (data) {
                setSubscription(data)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    async function handleUpgrade(planId: string) {
        setSubscribing(planId)
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId })
            })
            
            const data = await response.json()
            
            if (data.url) {
                window.location.href = data.url
            } else {
                toast.error("Error al iniciar el pago")
            }
        } catch (error) {
            toast.error("Error de conexión")
        } finally {
            setSubscribing(null)
        }
    }

    async function handleStartTrial() {
        setSubscribing('trial')
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase.rpc('start_pro_trial', { p_user_id: user.id })
            
            if (error) throw error
            
            if (data && data.success) {
                toast.success("¡Prueba de 15 días activada!")
                loadSubscription() // Reload to see changes
                window.location.reload()
            } else {
                toast.error(data?.message || "No se pudo activar la prueba")
            }

        } catch (error: any) {
            toast.error("Error al activar prueba: " + error.message)
        } finally {
            setSubscribing(null)
        }
    }

    if (loading) return <div className="p-4 border rounded-md"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></div>



    const currentPlan = subscription?.status === 'trialing' ? 'pro' : (subscription?.plan_id || 'free')
    const isTrial = subscription?.status === 'trialing'
    const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null
    const daysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium">Tu Plan Actual</h3>
                    <p className="text-sm text-muted-foreground">
                        Gestiona tu suscripción y facturación
                    </p>
                </div>
                <Badge variant={currentPlan === 'free' ? 'secondary' : 'default'} className="uppercase text-sm px-3 py-1">
                    {currentPlan}
                </Badge>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                {Object.values(PLANS).map((plan) => {
                    const isCurrent = currentPlan === plan.id;
                    const isPro = plan.id === 'pro';

                    return (
                         <Card key={plan.id} className={`${isCurrent ? 'border-primary shadow-md' : 'opacity-80 hover:opacity-100 transition-opacity'} ${isPro ? 'relative overflow-hidden' : ''}`}>
                            {isPro && isCurrent && <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-bl">ACTIVO</div>}
                             <CardHeader>
                                <CardTitle>{plan.name}</CardTitle>
                                <CardDescription>{plan.description}</CardDescription>
                                <div className="text-3xl font-bold mt-2">
                                    ${plan.price.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">/mes</span>
                                </div>
                                {isPro && isTrial && isCurrent && (
                                    <div className="mt-2 bg-primary/10 text-primary text-xs px-2 py-1 rounded inline-block">
                                        Prueba Gratuita: Quedan {daysLeft} días
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-2 text-sm">
                                    {plan.features.map((feature, i) => (
                                         <li key={i} className="flex items-center"><Check className="mr-2 h-4 w-4 text-primary" /> {feature}</li>
                                    ))}
                                </ul>
                            </CardContent>
                             <CardFooter>
                                {isCurrent ? (
                                    <div className="w-full space-y-2">
                                        <Button className="w-full" disabled variant="outline">Plan Actual</Button>
                                         {isPro && !isTrial && (
                                            <p className="text-xs text-center text-muted-foreground">Gestionar en Mercado Pago</p>
                                         )}
                                          {plan.id === 'free' && !subscription?.trial_ends_at && (
                                            <Button 
                                                variant="outline" 
                                                className="w-full border-primary text-primary hover:bg-primary/10"
                                                onClick={handleStartTrial}
                                                disabled={!!subscribing}
                                            >
                                                {subscribing === 'trial' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Probar Pro 15 días
                                            </Button>
                                          )}
                                    </div>
                                ) : (
                                    <Button 
                                        className="w-full"
                                        variant={isPro ? "default" : "outline"}
                                        onClick={() => handleUpgrade(plan.id)}
                                        disabled={!!subscribing}
                                    >
                                        {subscribing === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {plan.id === 'enterprise' ? 'Contactar' : `Mejorar a ${plan.name}`}
                                    </Button>
                                )}
                            </CardFooter>
                         </Card>
                    )
                })}
            </div>
        </div>
    )
}

export function SubscriptionSettings() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <SubscriptionSettingsContent />
        </Suspense>
    )
}
