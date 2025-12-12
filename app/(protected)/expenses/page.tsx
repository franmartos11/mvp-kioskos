"use client"

import { ExpensesClient } from "@/components/expenses/expenses-client"

export default function ExpensesPage() {
    return (
        <div className="flex-1 flex flex-col h-full bg-muted/10">
            <ExpensesClient />
        </div>
    )
}
