"use client"
 
import { useState } from "react"
import { useZxing } from "react-zxing"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
 
interface BarcodeScannerProps {
  onScan: (result: string) => void
  onClose: () => void
}
 
export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null)
 
  const { ref } = useZxing({
    onDecodeResult(result) {
      onScan(result.getText())
    },
    onError(err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Permiso de cámara denegado")
      }
    },
    constraints: {
      video: {
          facingMode: "environment" // Prefer back camera on mobile
      }
    }
  })
 
  return (
    <div className="relative flex flex-col items-center justify-center bg-black rounded-lg overflow-hidden aspect-video">
      {error ? (
        <div className="text-white text-center p-4">
          <p className="mb-2 text-red-400">{error}</p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      ) : (
        <>
            <video ref={ref} className="w-full h-full object-cover" />
            <div className="absolute inset-0 border-2 border-white/30 rounded-lg pointer-events-none">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/50 animate-pulse" />
            </div>
            <ProductScannerOverlay onClose={onClose} />
        </>
      )}
    </div>
  )
}

function ProductScannerOverlay({ onClose }: { onClose: () => void }) {
    return (
        <div className="absolute top-2 right-2">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                onClick={onClose}
            >
                <X className="h-4 w-4" />
            </Button>
        </div>
    )
}
