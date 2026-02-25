import { CartItem } from "@/types/pos"
import { Button } from "@/components/ui/button"
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react"

interface CartProps {
  items: CartItem[]
  onUpdateQuantity: (productId: string, delta: number) => void
  onSetQuantity: (productId: string, qty: number) => void
  onRemove: (productId: string) => void
}

export function Cart({ items, onUpdateQuantity, onSetQuantity, onRemove }: CartProps) {
  const total = items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 gap-3">
        <div className="bg-muted p-4 rounded-full">
            <ShoppingCart className="h-8 w-8 opacity-50" />
        </div>
        <div className="text-center">
            <p className="font-medium">El carrito está vacío</p>
            <p className="text-sm opacity-75">Selecciona productos para comenzar</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
            {items.map((item) => (
                <div key={item.product.id} className="flex flex-col gap-2 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded-xl transition-colors">
                <div className="flex justify-between items-start gap-2">
                    <p className="font-semibold text-base leading-tight">
                        {item.product.name}
                    </p>
                    <p className="font-bold text-base min-w-[70px] text-right">
                        ${(item.product.price * item.quantity).toFixed(2)}
                    </p>
                </div>
                
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        ${item.product.price} c/u
                    </p>
                    
                    <div className="flex items-center gap-3">
                         <div className="flex items-center border rounded-md bg-background shadow-sm">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-none hover:bg-muted"
                                onClick={() => onUpdateQuantity(item.product.id, -1)}
                            >
                                <Minus className="h-3 w-3" />
                            </Button>
                            {item.product.is_weighable ? (
                                <input 
                                    type="number" 
                                    step="any"
                                    className="w-16 text-center text-sm font-medium tabular-nums border-x h-8 bg-muted/20 outline-none focus:bg-background"
                                    value={item.quantity}
                                    onChange={(e) => onSetQuantity(item.product.id, parseFloat(e.target.value) || 0)}
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                />
                            ) : (
                                <span className="w-10 text-center text-sm font-medium tabular-nums border-x h-8 flex items-center justify-center bg-muted/20">
                                    {item.quantity}
                                </span>
                            )}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-none hover:bg-muted"
                                onClick={() => onUpdateQuantity(item.product.id, 1)}
                            >
                                <Plus className="h-3 w-3" />
                            </Button>
                        </div>

                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => onRemove(item.product.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                </div>
            ))}
        </div>
      
        <div className="p-4 bg-muted/20 border-t mt-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-end">
                <span className="text-muted-foreground font-medium">Total a Pagar</span>
                <span className="text-3xl font-black tracking-tight">${total.toFixed(2)}</span>
            </div>
        </div>
    </div>
  )
}
