import { Product } from "./inventory"

export interface CartItem {
  product: Product
  quantity: number
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other'

export interface Sale {
    id: string
    created_at: string
    total: number
    payment_method: PaymentMethod
    kiosk_id: string | null
    user_id: string | null
    items?: SaleItem[]
}

export interface SaleItem {
    id: string
    sale_id: string
    product_id: string
    quantity: number
    unit_price: number
    subtotal: number
}
