import { NextResponse } from 'next/server'
import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import { createClient } from '@/utils/supabase/server'
import { PLANS, PlanId } from '@/lib/plans'

const client = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || '' 
})

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { planId } = body as { planId: PlanId }

        const plan = PLANS[planId]

        if (!plan || planId === 'free') {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
        }

        const preapproval = new PreApproval(client)
        
        const backUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings?status=success`

        const result = await preapproval.create({
            body: {
                reason: `Kiosk App - Plan ${plan.name} (Mensual)`,
                auto_recurring: {
                    frequency: 1,
                    frequency_type: 'months',
                    transaction_amount: plan.price,
                    currency_id: 'ARS',
                },
                payer_email: user.email,
                // MERCADOPAGO PRODUCTION REQUIREMENT: back_url must be HTTPS and Public.
                // Localhost is blocked. We use a fallback if localhost is detected to allow the flow to start.
                back_url: backUrl.includes('localhost') 
                    ? 'https://www.google.com' 
                    : backUrl,
                external_reference: user.id, // User ID to link subscription
                status: 'pending',
                // IMPORTANT: Notification URL for webhooks
                // We assume the app is deployed and accessible publicly.
                // For local dev, you need a tunnel (ngrok) and set NEXT_PUBLIC_APP_URL accordingly.
                // or configure it in MP dashboard manually.
                // However, setting it here overrides dashboard settings usually.
                // If using localhost, this might fail or just not reach.
            }
        })

        return NextResponse.json({ url: result.init_point })

    } catch (error) {
        console.error('Mercado Pago Subscription Error:', error)
        return NextResponse.json({ error: 'Error creating subscription' }, { status: 500 })
    }
}
