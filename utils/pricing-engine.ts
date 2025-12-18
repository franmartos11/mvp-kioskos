import { Product } from "@/types/inventory"

export interface PriceList {
    id: string
    name: string
    adjustment_percentage: number
    rounding_rule: 'none' | 'nearest_10' | 'nearest_50' | 'nearest_100'
    is_active: boolean
    schedule: { day: number, start: string, end: string }[] | null
    excluded_category_ids: string[]
    excluded_product_ids: string[]
    priority: number
}

export function calculatePrice(product: Product, priceList: PriceList | null): number {
    if (!priceList || priceList.adjustment_percentage === 0) return product.price
    
    // Check exclusions
    if (product.category_id && priceList.excluded_category_ids?.includes(product.category_id)) return product.price
    if (priceList.excluded_product_ids?.includes(product.id)) return product.price

    // Calculate adj
    const adjustment = product.price * (priceList.adjustment_percentage / 100)
    let finalPrice = product.price + adjustment

    // Rounding
    if (priceList.rounding_rule === 'nearest_10') finalPrice = Math.round(finalPrice / 10) * 10
    if (priceList.rounding_rule === 'nearest_50') finalPrice = Math.round(finalPrice / 50) * 50
    if (priceList.rounding_rule === 'nearest_100') finalPrice = Math.round(finalPrice / 100) * 100

    return finalPrice
}
