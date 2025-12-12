import { SuppliersClient } from "@/components/suppliers/suppliers-client"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Proveedores | Kiosk POS",
    description: "Gestión de proveedores"
}

export default function SuppliersPage() {
    return (
        <div className="h-full flex-1 flex-col space-y-8 p-8 flex">
            <SuppliersClient />
        </div>
    )
}
