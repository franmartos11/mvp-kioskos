"use client"

import { SalesList } from "@/components/sales/sales-list"

export default function SalesPage() {
  return (
      <div className="container mx-auto py-6 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ventas</h1>
          <p className="text-muted-foreground">
            Registro de transacciones diarias.
          </p>
        </div>
        
        <SalesList />
      </div>
  )
}
