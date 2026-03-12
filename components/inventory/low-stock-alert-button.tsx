"use client"

import { useState } from "react"
import { useLowStockAlerts } from "@/hooks/use-low-stock-alerts"
import { useKiosk } from "@/components/providers/kiosk-provider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Package, ArrowRight } from "lucide-react"
import Link from "next/link"

export function LowStockAlertButton() {
  const { currentKiosk } = useKiosk()
  const { data: items = [], isLoading } = useLowStockAlerts(currentKiosk?.id)
  const [open, setOpen] = useState(false)

  if (isLoading || items.length === 0) return null

  const critical = items.filter(p => p.stock === 0)
  const low = items.filter(p => p.stock > 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative gap-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          title={`${items.length} producto${items.length > 1 ? 's' : ''} con stock bajo`}
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="hidden sm:inline text-sm font-medium">Stock</span>
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-red-500 text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="font-semibold text-sm">Alertas de Stock</span>
          </div>
          <Badge variant="destructive" className="text-xs">
            {items.length} producto{items.length > 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="max-h-64 overflow-y-auto">
          {critical.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-xs font-bold text-red-700 bg-red-50 uppercase tracking-wide">
                Sin stock
              </p>
              {critical.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span className="text-sm font-medium truncate max-w-[160px]">{p.name}</span>
                  </div>
                  <span className="text-xs font-bold text-red-600 shrink-0">0 unid.</span>
                </div>
              ))}
            </div>
          )}

          {low.length > 0 && (
            <div>
              <p className="px-4 py-1.5 text-xs font-bold text-orange-700 bg-orange-50 uppercase tracking-wide">
                Stock bajo (mín: {low[0]?.min_stock})
              </p>
              {low.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                    <span className="text-sm font-medium truncate max-w-[160px]">{p.name}</span>
                  </div>
                  <span className="text-xs font-bold text-orange-600 shrink-0">{p.stock} / {p.min_stock}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <Link href="/inventory" onClick={() => setOpen(false)}>
            <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
              Ver en Inventario <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
