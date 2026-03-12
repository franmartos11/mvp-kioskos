import { CustomersClient } from "@/components/customers/customers-client"

export default function CustomersPage() {
  return (
    <div className="h-full flex-1 flex-col space-y-8 p-6 flex">
      <CustomersClient />
    </div>
  )
}
