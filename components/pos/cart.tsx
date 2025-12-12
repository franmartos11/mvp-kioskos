import { CartItem } from "@/types/pos"
import { Button } from "@/components/ui/button"
import { Minus, Plus, Trash2 } from "lucide-react"

interface CartProps {
  items: CartItem[]
  onUpdateQuantity: (productId: string, delta: number) => void
  onRemove: (productId: string) => void
}

export function Cart({ items, onUpdateQuantity, onRemove }: CartProps) {
  const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <p>El carrito está vacío</p>
        <p className="text-sm">Agrega productos para comenzar</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {items.map((item) => (
        <div key={item.product.id} className="flex items-center gap-4 bg-muted/50 p-3 rounded-lg">
           <div className="flex-1 min-w-0">
             <p className="font-medium text-sm truncate">{item.product.name}</p>
             <p className="text-xs text-muted-foreground">${item.product.price} c/u</p>
           </div>
           
           <div className="flex items-center gap-2">
             <Button 
                variant="outline" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => onUpdateQuantity(item.product.id, -1)}
             >
                <Minus className="h-3 w-3" />
             </Button>
             <span className="w-8 text-center text-sm tabular-nums">{item.quantity}</span>
             <Button 
                variant="outline" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => onUpdateQuantity(item.product.id, 1)}
             >
                <Plus className="h-3 w-3" />
             </Button>
           </div>

           <div className="text-right min-w-[60px]">
             <p className="font-bold text-sm">
                ${(item.product.price * item.quantity).toFixed(2)}
             </p>
           </div>

           <Button 
             variant="ghost" 
             size="icon" 
             className="h-7 w-7 text-muted-foreground hover:text-destructive"
             onClick={() => onRemove(item.product.id)}
           >
             <Trash2 className="h-4 w-4" />
           </Button>
        </div>
      ))}
      
      <div className="pt-4 border-t mt-auto">
        <div className="flex justify-between items-center text-lg font-bold">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
