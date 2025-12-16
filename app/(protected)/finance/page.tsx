import { GeneralHeader } from "@/components/layout/general-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CashRegister } from "@/components/finance/cash-register"
import { ExpenseList } from "@/components/finance/expense-list"
import { BalanceView } from "@/components/finance/balance-view"

export default function FinancePage() {
    return (
        <div className="flex flex-col h-full gap-6">
            <GeneralHeader 
                heading="Finanzas" 
                text="Gestiona tu caja, gastos y movimientos."
            />

            <Tabs defaultValue="cash" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="cash">Caja Diaria</TabsTrigger>
                    <TabsTrigger value="expenses">Gastos</TabsTrigger>
                    <TabsTrigger value="balance">Balance</TabsTrigger>
                </TabsList>

                <TabsContent value="cash">
                    <CashRegister />
                </TabsContent>

                <TabsContent value="expenses">
                    <ExpenseList />
                </TabsContent>

                <TabsContent value="balance">
                    <BalanceView />
                </TabsContent>
            </Tabs>
        </div>
    )
}
