"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
    onCheckedChange?: (checked: boolean) => void
  }
>(({ className, onCheckedChange, ...props }, ref) => {
  const [checked, setChecked] = React.useState(props.checked || props.defaultChecked || false)

  React.useEffect(() => {
    if (props.checked !== undefined) {
      setChecked(props.checked)
    }
  }, [props.checked])

  const handleClick = () => {
    if (props.disabled) return
    const newChecked = !checked
    if (props.checked === undefined) {
      setChecked(newChecked)
    }
    onCheckedChange?.(newChecked)
  }

  return (
    <div
      className={cn(
        "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground cursor-pointer flex items-center justify-center",
        className
      )}
      onClick={handleClick}
      role="checkbox"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
    >
      <input
        type="checkbox"
        className="hidden"
        ref={ref}
        checked={!!checked}
        readOnly
        {...props}
      />
      {checked && <Check className="h-3 w-3 text-current font-bold" strokeWidth={3} />}
    </div>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
