import { useEffect, useRef } from 'react'

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void
  minLength?: number
  timeLimit?: number
}

export function useBarcodeScanner({ 
  onScan, 
  minLength = 3, 
  timeLimit = 50 
}: UseBarcodeScannerProps) {
  // Use refs to keep track of buffer and timing without triggering re-renders
  const buffer = useRef<string>("")
  const lastKeyTime = useRef<number>(0)
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now()
      const timeGap = currentTime - lastKeyTime.current
      lastKeyTime.current = currentTime

      // If key presses are too slow, it's likely manual typing. Reset buffer.
      // Exception: if buffer is empty, this is the first char, so we accept it.
      if (buffer.current.length > 0 && timeGap > timeLimit) {
        buffer.current = ""
      }

      if (e.key === 'Enter') {
        if (buffer.current.length >= minLength) {
            // It's a valid scan!
            e.preventDefault() // Prevent form submission if any
            onScan(buffer.current)
            buffer.current = ""
        }
        return
      }

      // Ignore special keys (Shift, Ctrl, etc.) - only printable chars
      if (e.key.length === 1) {
          buffer.current += e.key
      }
    }

    // Attach to window to capture anywhere
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onScan, minLength, timeLimit])
}
