import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago'
import { createAdminClient } from '@/utils/supabase/admin'
import { PLANS } from '@/lib/plans'

const client = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' 
})

export async function POST(request: Request) {
    try {
        const url = new URL(request.url)
        const topic = url.searchParams.get('topic') || url.searchParams.get('type')
        const id = url.searchParams.get('id') || url.searchParams.get('data.id')

        console.log(`Webhook received: Topic=${topic}, ID=${id}`)

        if (!id) return NextResponse.json({ status: 'ignored_no_id' })

        // Use Admin Client (Service Role) to bypass RLS for webhooks
        const supabase = createAdminClient()

        // CASE 1: New Subscription Created/Updated (topic: 'subscription_preapproval' or 'preapproval')
        if (topic === 'subscription_preapproval' || topic === 'preapproval') {
            const preapproval = new PreApproval(client)
            const subData = await preapproval.get({ id })
            
            console.log('Subscription Data:', subData)
            
            if (subData.status === 'authorized' || subData.status === 'cancelled' || subData.status === 'paused') {
                const userId = subData.external_reference
                
                // Determine plan based on reason/amount
                const reason = subData.reason?.toLowerCase() || ''
                const planId = Object.values(PLANS).find(p => reason.includes(p.name.toLowerCase()))?.id || 'pro'
                
                const dbStatus = subData.status === 'authorized' ? 'active' : 'cancelled' // Map to DB status

                // Update specific subscription
                if (userId) {
                    await supabase.from('subscriptions').upsert({
                        user_id: userId,
                        plan_id: planId,
                        status: dbStatus,
                        mercadopago_subscription_id: subData.id,
                        // If authorized, set next date. If cancelled, maybe keep old date or set to now?
                        // Let's set it to subData.next_payment_date if exists, else keep existing logic.
                        current_period_end: subData.next_payment_date ? new Date(subData.next_payment_date).toISOString() : new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' })
                }
            }
        }
        
        // CASE 2: Payment Processed (Charge succeeded/failed)
        if (topic === 'payment') {
            const payment = new Payment(client)
            const paymentData = await payment.get({ id })
            
            console.log('Payment Data:', paymentData)

            const userId = paymentData.external_reference
            
            if (userId) {
                 await supabase.from('payments').insert({
                    user_id: userId,
                    amount: paymentData.transaction_amount,
                    currency: paymentData.currency_id,
                    status: paymentData.status,
                    provider_payment_id: String(paymentData.id),
                    metadata: paymentData as any
                })
                
                if (paymentData.status === 'approved') {
                     const description = paymentData.description?.toLowerCase() || ''
                     const planId = Object.values(PLANS).find(p => description.includes(p.name.toLowerCase()))?.id || 'pro'
                     
                     await supabase.from('subscriptions').upsert({
                        user_id: userId,
                        plan_id: planId,
                        status: 'active',
                        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Extend 30 days from payment
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' })
                }
            }
        }

        return NextResponse.json({ status: 'ok' })
    } catch (error) {
        console.error('Webhook error:', error)
        return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
    }
}
