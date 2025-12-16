"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"

export type PlanType = 'free' | 'pro' | 'enterprise'

export function useSubscription() {
    const [plan, setPlan] = useState<PlanType>('free')
    const [status, setStatus] = useState<string>('active')
    const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
    const [hasUsedTrial, setHasUsedTrial] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setLoading(false)
                    return
                }

                const { data } = await supabase
                    .from('subscriptions')
                    .select('plan_id, status, trial_ends_at')
                    .eq('user_id', user.id)
                    .single()

                if (data) {
                    if (data.trial_ends_at) {
                        setHasUsedTrial(true)
                    }

                    // Check if trial is valid
                    if (data.status === 'trialing') {
                        const endDate = new Date(data.trial_ends_at)
                        if (endDate > new Date()) {
                             setPlan('pro') // Treat as Pro during trial
                             setStatus('trialing')
                             setTrialEndsAt(data.trial_ends_at)
                        } else {
                            // Trial expired, revert to free locally (backend should handle this properly or user sees expired)
                             setPlan('free')
                             setStatus('past_due') 
                        }
                    } else if (data.status === 'active') {
                        setPlan(data.plan_id as PlanType)
                        setStatus('active')
                    }
                }
            } catch (error) {
                // console.error("Error loading subscription", error)
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

    return {
        plan,
        loading,
        status,
        trialEndsAt,
        hasUsedTrial,
        daysLeft: trialEndsAt ? Math.ceil((new Date(trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0,
        isPro: plan === 'pro' || plan === 'enterprise',
        isEnterprise: plan === 'enterprise'
    }
}
