import { OrderDetailsClient } from "@/components/suppliers/order-details-client"

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return (
        <div className="flex-1 flex flex-col h-full">
            <OrderDetailsClient orderId={id} />
        </div>
    )
}
