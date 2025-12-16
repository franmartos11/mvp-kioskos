"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/utils/supabase/client"
import { toast } from "sonner"
import { useKiosk } from "@/components/providers/kiosk-provider"

export type ExpenseCategory = 'provider' | 'service' | 'withdrawal' | 'other'
export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'other'

export interface Expense {
    id: string
    amount: number
    description: string
    category: ExpenseCategory
    payment_method: PaymentMethod
    created_at: string
}

export interface CashShift {
    id: string
    opened_at: string
    initial_cash: number
    status: 'open' | 'closed'
    // ... add more as needed
}

export function useFinance() {
    const { currentKiosk } = useKiosk()
    const kioskId = currentKiosk?.id
    const queryClient = useQueryClient()

    // 1. Get Open Shift
    // Uses 'cash_sessions' table shared with POS
    const { data: openShift, isLoading: isLoadingShift } = useQuery({
        queryKey: ['shift', kioskId],
        queryFn: async () => {
             if (!kioskId) return null
             const { data, error } = await supabase
                .from('cash_sessions')
                .select('*')
                .eq('kiosk_id', kioskId)
                .eq('status', 'open')
                .maybeSingle()
             
             if (error) throw error
             return data as CashShift | null
        },
        enabled: !!kioskId
    })

    // 2. Open Shift
    const openShiftMutation = useMutation({
        mutationFn: async (initialCash: number) => {
            if (!kioskId) throw new Error("No kiosk")
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("No user")

            const { error } = await supabase
                .from('cash_sessions')
                .insert({
                    kiosk_id: kioskId,
                    user_id: user.id, // Changed from opened_by
                    initial_cash: initialCash,
                    status: 'open',
                    opened_at: new Date().toISOString() // Explicitly set opened_at
                })
            
            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift', kioskId] })
            toast.success("Caja abierta correctamente")
        },
        onError: (err: any) => {
            toast.error("Error al abrir caja: " + err.message)
        }
    })

    // 3. Close Shift
    const closeShiftMutation = useMutation({
        mutationFn: async ({ shiftId, finalCash, notes }: { shiftId: string, finalCash: number, notes?: string }) => {
             const { data, error } = await supabase
                .rpc('close_shift', {
                    p_shift_id: shiftId,
                    p_final_cash: finalCash,
                    p_notes: notes || ""
                })
             
             if (error) throw error
             if (data && !data.success) throw new Error(data.message)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['shift', kioskId] })
            queryClient.invalidateQueries({ queryKey: ['shifts-history', kioskId] })
            toast.success("Caja cerrada correctamente")
        },
        onError: (err: any) => {
             toast.error("Error al cerrar caja: " + err.message)
        }
    })

    // 4. Get Expenses (Recent)
    const { data: expenses, isLoading: isLoadingExpenses } = useQuery({
        queryKey: ['expenses', kioskId],
        queryFn: async () => {
            if (!kioskId) return []
            const { data } = await supabase
                .from('expenses')
                .select('*')
                .eq('kiosk_id', kioskId)
                .order('created_at', { ascending: false })
                .limit(50)
            return (data as Expense[]) || []
        },
        enabled: !!kioskId
    })

    // 5. Create Expense
    const createExpenseMutation = useMutation({
        mutationFn: async (expense: Omit<Expense, 'id' | 'created_at'>) => {
             if (!kioskId) throw new Error("No kiosk")
             const { data: { user } } = await supabase.auth.getUser()
             
             const { error } = await supabase.from('expenses').insert({
                 ...expense,
                 kiosk_id: kioskId,
                 user_id: user?.id
             })

             if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses', kioskId] }) // Refresh list
            toast.success("Gasto registrado")
        }, 
        onError: (err: any) => {
            toast.error("Error al registrar gasto: " + err.message)
        }
    })

    return {
        openShift,
        isLoadingShift,
        openShiftMutation,
        closeShiftMutation,
        expenses,
        isLoadingExpenses,
        createExpenseMutation
    }
}
