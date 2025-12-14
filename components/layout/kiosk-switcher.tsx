"use client"

import { ChevronsUpDown, Store, Check, PlusCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useState } from "react"
import { useKiosk } from "@/components/providers/kiosk-provider"
import { Badge } from "@/components/ui/badge"

export function KioskSwitcher({ className }: { className?: string }) {
  const { allKiosks, currentKiosk, setKiosk } = useKiosk()
  const [open, setOpen] = useState(false)

  // Only show switcher if there are kiosks
  if (!allKiosks?.length) return null

  // If user only has one kiosk and is not an owner (or even if they are), 
  // maybe we just show the name without a dropdown?
  // User request: "para los usuarios que son vendedores hagamos que se le asigne solo un kiosko"
  // So for sellers with 1 kiosk, maybe just static text or disabled button.
  // But let's stick to the plan: if > 1 kiosk, enabled. If 1, disabled but visible.
  
  const canSwitch = allKiosks.length > 1

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Seleccionar kiosco"
          disabled={!canSwitch}
          className={cn("w-full justify-between h-12 px-3 border-dashed", className)}
        >
          <Store className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <div className="flex flex-col items-start truncate overflow-hidden bg-transparent w-full">
               <span className="text-sm font-medium truncate w-full text-left">
                   {currentKiosk?.name || "Seleccionar..."}
               </span>
               <span className="text-xs text-muted-foreground font-normal">
                   {currentKiosk?.role === 'owner' ? 'Propietario' : 'Vendedor'}
               </span>
          </div>
          {canSwitch && <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandList>
            <CommandInput placeholder="Buscar kiosco..." />
            <CommandEmpty>No se encontró kiosco.</CommandEmpty>
            <CommandGroup heading="Mis Kioscos">
              {allKiosks.map((kiosk) => (
                <CommandItem
                  key={kiosk.id}
                  onSelect={() => {
                    setKiosk(kiosk.id)
                    setOpen(false)
                    // Reload page to refresh all data or rely on context?
                    // Ideally context updates, but some fetches might need to be reactive.
                    // React Query or similar would be great, but simple effect deps on context work too.
                    // For now, simple context update. App should react.
                  }}
                  className="text-sm"
                >
                  <Store className="mr-2 h-4 w-4" />
                  {kiosk.name}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      currentKiosk?.id === kiosk.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {/* Optional: Add 'Create Kiosk' for owners */}
          <CommandSeparator />
        </Command>
      </PopoverContent>
    </Popover>
  )
}
