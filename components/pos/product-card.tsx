import { Product } from "@/types/inventory"
import { Plus, Image as ImageIcon } from "lucide-react"

interface ProductCardProps {
  product: Product
  onAdd: (product: Product) => void
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  return (
    <div 
      className="flex flex-col border rounded-lg overflow-hidden bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
      onClick={() => onAdd(product)}
    >
      <div className="relative aspect-square bg-muted">
        {product.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
          <img 
            src={product.image_url} 
            alt={product.name} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
             <Plus className="text-white h-8 w-8 drop-shadow-md" />
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
        <div className="mt-1 flex items-center justify-between">
            <span className="font-bold">${product.price}</span>
            <span className="text-xs text-muted-foreground">Stock: {product.stock}</span>
        </div>
      </div>
    </div>
  )
}
