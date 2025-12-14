import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AuthCodeError() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">Error de Autenticación</h1>
      <p className="text-muted-foreground">
        Hubo un problema verificando tu enlace de inicio o recuperación.
        <br />
        Es posible que el enlace haya expirado o ya haya sido utilizado.
      </p>
      <div className="flex gap-2">
        <Button asChild>
            <Link href="/">Volver al Inicio</Link>
        </Button>
      </div>
    </div>
  )
}
