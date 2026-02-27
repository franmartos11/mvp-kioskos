"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Loader2 } from "lucide-react"

type KioskPermissions = {
    view_dashboard: boolean
    view_finance: boolean
    manage_products: boolean
    view_costs: boolean
    manage_stock: boolean
    manage_members: boolean
    view_reports: boolean
}

export type Kiosk = {
    id: string
    name: string
    role: 'owner' | 'seller'
    permissions: KioskPermissions
}

type KioskContextType = {
    currentKiosk: Kiosk | null
    allKiosks: Kiosk[]
    isLoading: boolean
    setKiosk: (kioskId: string) => void
    refreshKiosks: () => Promise<void>
}

const KioskContext = createContext<KioskContextType | undefined>(undefined)

export function KioskProvider({ children }: { children: React.ReactNode }) {
    const [currentKiosk, setCurrentKiosk] = useState<Kiosk | null>(null)
    const [allKiosks, setAllKiosks] = useState<Kiosk[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        const init = async () => {
            await refreshKiosks()
        }
        init()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                refreshKiosks()
            }
            if (event === 'SIGNED_OUT') {
                setCurrentKiosk(null)
                setAllKiosks([])
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    async function refreshKiosks() {
        setIsLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
            setIsLoading(false)
            return
        }

        // Fetch kiosks user is member of
        const { data: members, error } = await supabase
            .from('kiosk_members')
            .select(`
                role,
                permissions,
                kiosk:kiosks (
                    id,
                    name
                )
            `)
            .eq('user_id', user.id)

        if (members) {
            const kiosks: Kiosk[] = members.map((m: any) => {
                const isOwner = m.role === 'owner'
                const fullPermissions: KioskPermissions = {
                    view_dashboard: true,
                    view_finance: true,
                    manage_products: true,
                    view_costs: true,
                    manage_stock: true,
                    manage_members: true,
                    view_reports: true,
                }
                const sellerPermissions: KioskPermissions = {
                    view_dashboard: false,
                    view_finance: false,
                    manage_products: false,
                    view_costs: false,
                    manage_stock: false,
                    manage_members: false,
                    view_reports: false,
                    ...(m.permissions || {})
                }
                return {
                    id: m.kiosk.id,
                    name: m.kiosk.name,
                    role: m.role,
                    permissions: isOwner ? fullPermissions : sellerPermissions
                }
            })
            
            setAllKiosks(kiosks)

            // Determine plan limit
            // We fetch subscription manually here to avoid complex hook interactions or circular deps
            // (Since KioskProvider is high up, useSubscription might not be ready or we want direct DB access)
            
            let plan = 'free'
            const { data: sub } = await supabase
                .from('subscriptions')
                .select('plan_id, status')
                .eq('user_id', user.id)
                .single()
            
            if (sub && sub.status === 'active') {
                plan = sub.plan_id
            }

            let limit = 1
            if (plan === 'pro') limit = 2
            if (plan === 'enterprise') limit = 999

            // Sort kiosks by name to match UI
            const sortedKiosks = [...kiosks].sort((a, b) => a.name.localeCompare(b.name))

            // Determine which kiosk to select
            if (sortedKiosks.length > 0) {
                // 1. Try to restore from localStorage
                const savedKioskId = localStorage.getItem('kiosk_id')
                const foundIndex = sortedKiosks.findIndex(k => k.id === savedKioskId)
                const found = sortedKiosks[foundIndex]
                
                // CHECK LOCK: Removed strict index limit on restore to avoid UX issues (resetting to first kiosk)
                // If user is a member, they should be able to access it.
                if (found) {
                    setCurrentKiosk(found)
                } else {
                    // 2. Default to first one
                    setCurrentKiosk(sortedKiosks[0])
                    localStorage.setItem('kiosk_id', sortedKiosks[0].id)
                }
            } else {
                setCurrentKiosk(null)
            }
        }
        setIsLoading(false)
    }

    function setKiosk(kioskId: string) {
        const kiosk = allKiosks.find(k => k.id === kioskId)
        if (kiosk) {
            setCurrentKiosk(kiosk)
            localStorage.setItem('kiosk_id', kioskId)
        }
    }

    return (
        <KioskContext.Provider value={{ currentKiosk, allKiosks, isLoading, setKiosk, refreshKiosks }}>
            {children}
        </KioskContext.Provider>
    )
}

export function useKiosk() {
    const context = useContext(KioskContext)
    if (context === undefined) {
        throw new Error("useKiosk must be used within a KioskProvider")
    }
    return context
}
