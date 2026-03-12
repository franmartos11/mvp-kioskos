"use client"

import { useState } from "react"
import { Loader2, LogIn } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"

export function JoinKioskDialog() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState("")
  const router = useRouter()

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || code.length < 6) {
      toast.error("Ingresá un código válido de 6 caracteres")
      return
    }

    setLoading(true)
    // The endpoint is designed for browser navigation (GET), handles auth, and redirects on success.
    window.location.href = `/api/invite/join-by-code?code=${encodeURIComponent(code.trim().toUpperCase())}`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1.5 text-sm outline-none cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm w-full">
            <LogIn className="mr-2 h-4 w-4" />
            <span>Unirse a Kiosco</span>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Unirse a un Kiosco</DialogTitle>
          <DialogDescription>
            Ingresá el código de 6 letras que te compartió el propietario.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleJoin} className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="code">Código de Invitación</Label>
                <Input 
                    id="code"
                    placeholder="Ej: ABCDEF" 
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="font-mono text-center tracking-widest uppercase text-xl h-12"
                    required
                />
            </div>
            
            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={loading || code.length < 6}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Unirse
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
