import { Product } from "@/types/inventory"
import { Plus, Minus, Image as ImageIcon } from "lucide-react"

interface ProductCardProps {
  product: Product
  onAdd: (product: Product) => void
  onRemove: (product: Product) => void
  quantity?: number
}

export function ProductCard({ product, onAdd, onRemove, quantity = 0 }: ProductCardProps) {
  return (
    <div 
      className={`flex flex-col border rounded-xl overflow-hidden bg-card hover:bg-accent/50 transition-all cursor-pointer group relative h-full min-h-[200px] lg:min-h-[240px] ${
        quantity > 0 ? 'border-primary ring-1 ring-primary bg-primary/5' : ''
      }`}
      onClick={() => onAdd(product)}
    >
      {quantity > 0 && (
          <>
            <div 
                className="absolute top-2 left-2 z-20 bg-destructive text-destructive-foreground font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-md animate-in zoom-in hover:bg-destructive/90 transition-colors"
                onClick={(e) => {
                    e.stopPropagation()
                    onRemove(product)
                }}
            >
               <Minus className="h-4 w-4" />
            </div>
            <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground font-bold rounded-full w-7 h-7 flex items-center justify-center text-xs shadow-md animate-in zoom-in">
                {quantity}
            </div>
          </>
      )}
      <div className="relative h-24 lg:h-32 w-full bg-muted shrink-0">
        {product.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
          <img 
            src={product.image_url} 
            alt={product.name} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-8 w-8 lg:h-10 lg:w-10 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
             <Plus className="text-white h-8 w-8 drop-shadow-md" />
        </div>
      </div>
      <div className="p-2 lg:p-3 flex flex-col justify-between flex-1 gap-1 lg:gap-2 bg-secondary/30 border-t min-h-[70px] lg:min-h-[85px]">
        <h3 className="font-semibold text-sm lg:text-base leading-tight line-clamp-2" title={product.name}>{product.name}</h3>
        <div className="mt-auto">
            <span className="font-bold text-lg lg:text-2xl text-primary block text-right w-full" title={`$${product.price}`}>${product.price ?? 0}</span>
        </div>
      </div>
    </div>
  )
}
