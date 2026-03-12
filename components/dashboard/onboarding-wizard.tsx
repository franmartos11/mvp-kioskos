"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Store, 
  Package, 
  Users, 
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Sparkles
} from "lucide-react"
import Link from "next/link"

interface OnboardingWizardProps {
  open: boolean
  onClose: () => void
  kioskName: string
}

const STEPS = [
  {
    id: 0,
    icon: Sparkles,
    title: "¡Tu kiosco está listo!",
    description: "Completá estos 3 pasos para sacarle el máximo provecho a KioskApp desde el primer día.",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    id: 1,
    icon: Package,
    title: "Cargá tu primer producto",
    description: "Agregá al menos un producto para poder empezar a vender en el POS. Podés cargarlo manualmente o importar desde un CSV.",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    action: { label: "Ir al Inventario", href: "/inventory" },
  },
  {
    id: 2,
    icon: Users,
    title: "Invitá a tu equipo",
    description: "Si tenés empleados o vendedores, podés invitarlos ahora con un código de invitación o por email. Podés hacerlo más tarde también.",
    color: "text-violet-600",
    bgColor: "bg-violet-100",
    action: { label: "Ir a Empleados", href: "/employees" },
  },
  {
    id: 3,
    icon: CheckCircle2,
    title: "¡Todo listo para vender!",
    description: "Tu kiosco está configurado. Ahora podés abrir la caja y empezar a registrar ventas desde el POS.",
    color: "text-green-600",
    bgColor: "bg-green-100",
    action: { label: "Ir al POS", href: "/pos" },
  }
]

const TOTAL_STEPS = STEPS.length - 1 // Steps 1 to 3 are the "real" steps

export function OnboardingWizard({ open, onClose, kioskName }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)

  const current = STEPS[step]
  const Icon = current.icon
  const progress = step === 0 ? 0 : Math.round((step / TOTAL_STEPS) * 100)

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else handleFinish()
  }

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1)
  }

  const handleFinish = () => {
    // Mark as completed so we don't show it again
    localStorage.setItem("onboarding_completed", "true")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleFinish() }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Progress bar at top */}
        <Progress value={progress} className="rounded-none h-1.5" />

        <div className="p-6 space-y-6">
          {/* Header: icon + step indicator */}
          <div className="flex items-center gap-4">
            <div className={`${current.bgColor} p-3 rounded-full shrink-0`}>
              <Icon className={`h-7 w-7 ${current.color}`} />
            </div>
            <div>
              {step > 0 && (
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                  Paso {step} de {TOTAL_STEPS}
                </p>
              )}
              <h2 className="text-xl font-bold leading-tight">{current.title}</h2>
            </div>
          </div>

          {/* Kiosk name badge on step 0 */}
          {step === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
              <Store className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">{kioskName}</span>
            </div>
          )}

          {/* Description */}
          <p className="text-muted-foreground leading-relaxed text-sm">
            {current.description}
          </p>

          {/* Step indicators (dots) */}
          {step > 0 && (
            <div className="flex justify-center gap-2">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === step ? 'w-6 bg-primary' : i < step ? 'w-2 bg-primary/40' : 'w-2 bg-muted'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            {/* Primary CTA — go to the module */}
            {current.action && (
              <Link href={current.action.href} onClick={handleFinish}>
                <Button className="w-full gap-2" size="lg">
                  {current.action.label}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}

            {/* Navigation row */}
            <div className="flex items-center gap-2">
              {step > 0 && step < STEPS.length - 1 && (
                <Button variant="ghost" className="flex-1 gap-1" onClick={handleBack}>
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
              )}
              
              <Button
                variant={current.action ? "outline" : "default"}
                className="flex-1 gap-1"
                size={step === 0 ? "lg" : "default"}
                onClick={handleNext}
              >
                {step === 0 && "Empezar tour"}
                {step > 0 && step < STEPS.length - 1 && (
                  <>Siguiente <ChevronRight className="h-4 w-4" /></>
                )}
                {step === STEPS.length - 1 && "Finalizar y volver al Dashboard"}
              </Button>
            </div>

            {/* Skip link — only on first step */}
            {step === 0 && (
              <button
                className="w-full text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                onClick={handleFinish}
              >
                Saltar tour — ya sé cómo funciona
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
