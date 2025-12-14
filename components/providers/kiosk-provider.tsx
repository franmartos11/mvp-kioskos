"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { Loader2 } from "lucide-react"

type Kiosk = {
    id: string
    name: string
    role: 'owner' | 'seller'
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
        refreshKiosks()
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
                kiosk:kiosks (
                    id,
                    name
                )
            `)
            .eq('user_id', user.id)

        if (members) {
            const kiosks: Kiosk[] = members.map((m: any) => ({
                id: m.kiosk.id,
                name: m.kiosk.name,
                role: m.role
            }))
            
            setAllKiosks(kiosks)

            // Determine which kiosk to select
            if (kiosks.length > 0) {
                // 1. Try to restore from localStorage
                const savedKioskId = localStorage.getItem('kiosk_id')
                const found = kiosks.find(k => k.id === savedKioskId)
                
                if (found) {
                    setCurrentKiosk(found)
                } else {
                    // 2. Default to first one
                    setCurrentKiosk(kiosks[0])
                    localStorage.setItem('kiosk_id', kiosks[0].id)
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
