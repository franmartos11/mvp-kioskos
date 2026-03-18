"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { DollarSign } from "lucide-react"

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
}

export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState("")

  const parseArgentineCurrency = (val: string) => {
    if (!val) return 0
    const clean = val.replace(/\./g, "").replace(",", ".")
    const parsed = parseFloat(clean)
    return isNaN(parsed) ? 0 : parsed
  }

  useEffect(() => {
    if (value === undefined || value === null) return
    const currentParsed = parseArgentineCurrency(displayValue)
    if (currentParsed !== value) {
      if (value === 0 && displayValue === "") {
         // do nothing, let it be empty
      } else {
         setDisplayValue(value.toString().replace('.', ','))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // allow digits, comma, dot, and minus sign
    const raw = e.target.value.replace(/[^0-9.,-]/g, "")
    setDisplayValue(raw)
    onChange(parseArgentineCurrency(raw))
  }

  return (
    <div className="relative w-full">
      <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        className={`pl-8 ${className || ""}`}
        {...props}
      />
    </div>
  )
}
