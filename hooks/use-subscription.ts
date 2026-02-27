"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/utils/supabase/client"

export type PlanType = 'free' | 'pro' | 'enterprise'

const PLAN_CACHE_KEY = 'kiosk_plan_cache'

export function useSubscription() {
    // Restore from cache immediately to prevent the ~30s loading flash
    const [plan, setPlan] = useState<PlanType>(() => {
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(PLAN_CACHE_KEY)
            if (cached === 'pro' || cached === 'enterprise' || cached === 'free') return cached
        }
        return 'free'
    })
    const [status, setStatus] = useState<string>('active')
    const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null)
    const [hasUsedTrial, setHasUsedTrial] = useState(false)
    // If we have a cached plan, skip the loading state entirely
    const [loading, setLoading] = useState(() => {
        if (typeof window !== 'undefined') {
            return !localStorage.getItem(PLAN_CACHE_KEY)
        }
        return true
    })

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

                    if (data.status === 'trialing') {
                        const endDate = new Date(data.trial_ends_at)
                        if (endDate > new Date()) {
                            const resolvedPlan: PlanType = 'pro'
                            setPlan(resolvedPlan)
                            localStorage.setItem(PLAN_CACHE_KEY, resolvedPlan)
                            setStatus('trialing')
                            setTrialEndsAt(data.trial_ends_at)
                        } else {
                            const resolvedPlan: PlanType = 'free'
                            setPlan(resolvedPlan)
                            localStorage.setItem(PLAN_CACHE_KEY, resolvedPlan)
                            setStatus('past_due')
                        }
                    } else if (data.status === 'active') {
                        const resolvedPlan = data.plan_id as PlanType
                        setPlan(resolvedPlan)
                        localStorage.setItem(PLAN_CACHE_KEY, resolvedPlan)
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
