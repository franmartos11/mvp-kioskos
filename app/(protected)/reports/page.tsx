import { MonthlyReportClient } from "@/components/finance/monthly-report-client"
import { Metadata } from "next"

export const metadata: Metadata = {
    title: "Reporte Mensual | Kiosk POS",
    description: "Resumen financiero mensual imprimible"
}

export default function ReportsPage() {
    return (
        <div className="h-full flex-1 flex-col space-y-8 p-8 flex">
            <MonthlyReportClient />
        </div>
    )
}
