"use client"

import { GeneralSettings } from "@/components/settings/general-settings"
import { SubscriptionSettings } from "@/components/settings/subscription-settings"
import { PaymentHistory } from "@/components/settings/payment-history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
                <p className="text-muted-foreground">Administra tu cuenta y preferencias.</p>
            </div>
            
            <Tabs defaultValue="general" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="subscription">Suscripción</TabsTrigger>
                    <TabsTrigger value="billing">Facturación</TabsTrigger>
                </TabsList>
                <TabsContent value="general" className="space-y-4">
                    <GeneralSettings />
                </TabsContent>
                <TabsContent value="subscription" className="space-y-4">
                     <SubscriptionSettings />
                </TabsContent>
                <TabsContent value="billing" className="space-y-4">
                    <PaymentHistory />
                </TabsContent>
            </Tabs>
        </div>
    )
}
