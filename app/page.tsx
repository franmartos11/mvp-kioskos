"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { 
    ArrowRight, 
    BarChart3, 
    Lock, 
    Smartphone, 
    Zap, 
    CheckCircle2, 
    HelpCircle 
} from "lucide-react"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import { useState, useEffect } from "react"

export default function LandingPage() {
    // Simple state for mounting hydration check
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    if (!mounted) return null

  return (
    <div className="flex flex-col min-h-screen scroll-smooth font-sans">
      {/* Navbar */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <Link className="flex items-center justify-center group" href="#">
             <div className="bg-primary/10 p-2 rounded-lg text-primary mr-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                <BarChart3 className="h-6 w-6" />
             </div>
             <span className="font-bold text-xl tracking-tight">Kiosk POS</span>
        </Link>
        <nav className="ml-auto flex gap-6 items-center">
          <Link className="text-sm font-medium hover:text-primary transition-colors hidden sm:block" href="#features">
            Características
          </Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors hidden sm:block" href="#testimonials">
            Testimonios
          </Link>
          <Link className="text-sm font-medium hover:text-primary transition-colors hidden sm:block" href="#pricing">
            Precios
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login">
                <Button variant="ghost" size="sm">
                    Ingresar
                </Button>
            </Link>
            <Link href="/login">
                <Button size="sm" className="hidden sm:flex">
                    Empezar Gratis
                </Button>
            </Link>
          </div>
        </nav>
      </header>
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full py-12 md:py-24 lg:py-32 xl:py-48 px-4 overflow-hidden bg-background">
            {/* Background Gradients */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-pulse delay-1000" />
            </div>

            <div className="container mx-auto">
                <div className="flex flex-col items-center space-y-8 text-center animate-slide-up-fade">
                    <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary/10 text-primary hover:bg-primary/20 animate-in fade-in zoom-in duration-500 delay-100">
                        🚀 Nueva Versión 2.0 Disponible
                    </div>
                <div className="space-y-4 max-w-3xl">
                    <h1 className="text-4xl font-extrabold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                    Tu negocio, <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-primary/60">tú control.</span>
                    </h1>
                    <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl leading-relaxed">
                    Deja de luchar con cuadernos y Excel. Kiosk POS es la herramienta profesional que simplifica tu vida, controla tu stock y aumenta tus ventas.
                    </p>
                </div>
                <div className="space-x-4 pt-4 flex flex-col sm:flex-row gap-4 sm:gap-0">
                    <Link href="/login">
                        <Button size="lg" className="rounded-full px-8 text-lg h-12 w-full sm:w-auto shadow-lg hover:shadow-primary/25 transition-all hover:scale-105">
                        Comenzar Gratis <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </Link>
                    <Link href="#features">
                        <Button variant="outline" size="lg" className="rounded-full px-8 text-lg h-12 w-full sm:w-auto hover:bg-muted/50 transition-all hover:scale-105">
                        Ver Demo
                        </Button>
                    </Link>
                </div>
                
                {/* Hero Floating Card Preview */}
                <div className="mt-16 w-full max-w-5xl mx-auto rounded-xl border bg-card/50 backdrop-blur-sm shadow-2xl p-2 sm:p-4 animate-float">
                     <div className="aspect-[16/9] rounded-lg bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center border border-dashed relative overflow-hidden">
                        <img 
                            src="/dashboard-preview.png" 
                            alt="Vista previa del panel de control" 
                            className="w-full h-full object-cover rounded-lg shadow-inner"
                        />
                     </div>
                </div>
                </div>
            </div>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
             <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl">
                    ¿Por qué somos diferentes?
                </h2>
                <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed">
                    Diseñado para dueños, no para informáticos.
                </p>
             </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                    <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Punto de Venta Relámpago</h3>
                <p className="text-muted-foreground">
                   Cobra en segundos. Interfaz optimizada para reducir clics y evitar colas en tu negocio.
                </p>
              </div>

               {/* Feature 2 */}
               <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                    <Smartphone className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">100% Móvil y Responsive</h3>
                <p className="text-muted-foreground">
                  No necesitas PC. Gestiona todo desde tu celular con la misma potencia y comodidad.
                </p>
              </div>

               {/* Feature 3 */}
               <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                    <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Roles y Permisos</h3>
                <p className="text-muted-foreground">
                  Crea cuentas para tus empleados y controla qué pueden ver y modificar. 
                </p>
              </div>

               {/* Feature 4 */}
               <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Reportes en Tiempo Real</h3>
                <p className="text-muted-foreground">
                  Conoce tus ganancias exactas, productos más vendidos y rendimiento diario al instante.
                </p>
              </div>
                
                {/* Feature 5 */}
                <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Control de Stock Simple</h3>
                <p className="text-muted-foreground">
                    Alertas de stock bajo, historial de movimientos y carga masiva de productos.
                </p>
              </div>

               {/* Feature 6 */}
               <div className="group relative overflow-hidden rounded-2xl border bg-card p-8 hover:shadow-xl hover:border-primary/20 transition-all duration-300 hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
                    <HelpCircle className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">Soporte Dedicado</h3>
                <p className="text-muted-foreground">
                   No estás solo. Nuestro equipo te ayuda a configurar y resolver dudas rápidamente.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="w-full py-16 md:py-24 px-4 bg-background">
            <div className="container mx-auto">
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl text-center mb-16">
                    Confianza de Kiosqueros Reales
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     {/* Testimonial 1 */}
                     <div className="flex flex-col p-6 bg-card rounded-2xl border hover:shadow-lg transition-all duration-300">
                        <div className="text-primary mb-4">★★★★★</div>
                        <p className="text-muted-foreground mb-6 italic">
                            "Antes usaba un cuaderno y perdía mucha plata. Ahora sé exactamente cuánto gano por día. Es increíble."
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">MR</div>
                            <div>
                                <div className="font-semibold">Martin Rodriguez</div>
                                <div className="text-xs text-muted-foreground">Dueño de Kiosco "El Paso"</div>
                            </div>
                        </div>
                     </div>
                     {/* Testimonial 2 */}
                     <div className="flex flex-col p-6 bg-card rounded-2xl border hover:shadow-lg transition-all duration-300">
                        <div className="text-primary mb-4">★★★★★</div>
                        <p className="text-muted-foreground mb-6 italic">
                            "Lo mejor es poder ver las ventas desde mi casa. Mis empleados lo usan sin problemas porque es muy fácil."
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">LS</div>
                            <div>
                                <div className="font-semibold">Luciana Silva</div>
                                <div className="text-xs text-muted-foreground">Maxikiosco "Central"</div>
                            </div>
                        </div>
                     </div>
                     {/* Testimonial 3 */}
                     <div className="flex flex-col p-6 bg-card rounded-2xl border hover:shadow-lg transition-all duration-300">
                        <div className="text-primary mb-4">★★★★★</div>
                        <p className="text-muted-foreground mb-6 italic">
                            "Probé varios sistemas y todos eran complicados. Este fue registrarme y empezar a vender."
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">JP</div>
                            <div>
                                <div className="font-semibold">Juan Perez</div>
                                <div className="text-xs text-muted-foreground">Almacén "Don Juan"</div>
                            </div>
                        </div>
                     </div>
                </div>
            </div>
        </section>

        {/* FAQ Section */}
        <section className="w-full py-16 md:py-24 px-4 bg-muted/30">
             <div className="container mx-auto max-w-3xl">
                <h2 className="text-3xl font-bold tracking-tighter md:text-4xl text-center mb-12">
                    Preguntas Frecuentes
                </h2>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>¿Necesito instalar algo?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                        No. Kiosk POS es una aplicación web. Funciona directamente en tu navegador (Chrome, Safari, etc.) en cualquier dispositivo.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger>¿Puedo usarlo sin internet?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                        Necesitas conexión para iniciar sesión y sincronizar, pero nuestra tecnología optimizada consume muy pocos datos y es muy rápida.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                        <AccordionTrigger>¿Es gratis de verdad?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                        Sí, tenemos un plan gratuito generoso para pequeños negocios. A medida que crezcas, puedes optar por funciones premium.
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-4">
                        <AccordionTrigger>¿Mis datos están seguros?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                        Absolutamente. Usamos encriptación de nivel bancario y tus datos se guardan en servidores seguros en la nube.
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
             </div>
        </section>

        {/* Pricing CTA */}
        <section id="pricing" className="w-full py-16 md:py-24 px-4 bg-background">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tighter md:text-4xl mb-4">Planes para cada etapa</h2>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Comienza gratis y mejora a medida que tu negocio crece.
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {/* Free Plan */}
                    <div className="flex flex-col p-6 bg-card rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                        <div className="mb-4">
                            <h3 className="text-2xl font-bold">Gratis</h3>
                            <p className="text-muted-foreground">Para empezar</p>
                        </div>
                        <div className="mb-6">
                            <span className="text-4xl font-bold">$0</span>
                            <span className="text-muted-foreground">/mes</span>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Hasta 50 productos</li>
                            <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> 1 Kiosco</li>
                            <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Ventas ILIMITADAS</li>
                            <li className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-3 w-3" /> Reportes Básicos</li>
                        </ul>
                        <Link href="/login" className="w-full">
                            <Button variant="outline" className="w-full rounded-full" size="lg">Comenzar Gratis</Button>
                        </Link>
                    </div>

                    {/* Pro Plan */}
                    <div className="flex flex-col p-6 bg-card rounded-2xl border-2 border-primary shadow-xl relative scale-105 z-10">
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                            MÁS POPULAR
                        </div>
                        <div className="mb-4">
                            <h3 className="text-2xl font-bold text-primary">Pro</h3>
                            <p className="text-muted-foreground">Para crecer en serio</p>
                        </div>
                        <div className="mb-6">
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-bold">$18.000</span>
                                <span className="text-muted-foreground">/mes</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 text-green-600 font-medium">Primer mes 50% OFF</p>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-5 w-5 text-primary" /> Productos ILIMITADOS</li>
                            <li className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-5 w-5 text-primary" /> Hasta 2 Kioscos</li>
                            <li className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-5 w-5 text-primary" /> Reportes</li>
                            <li className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-5 w-5 text-primary" /> Control de Caja Completo</li>
                            <li className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-5 w-5 text-primary" /> Soporte</li>
                        </ul>
                        <Link href="/login" className="w-full">
                            <Button className="w-full rounded-full shadow-lg hover:shadow-primary/25" size="lg">Probar Pro Gratis</Button>
                        </Link>
                    </div>

                    {/* Enterprise Plan */}
                    <div className="flex flex-col p-6 bg-card rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                        <div className="mb-4">
                            <h3 className="text-2xl font-bold">Enterprise</h3>
                            <p className="text-muted-foreground">Grandes redes</p>
                        </div>
                        <div className="mb-6">
                            <span className="text-4xl font-bold">$55.000</span>
                            <span className="text-muted-foreground">/mes</span>
                        </div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Kioscos ILIMITADOS</li>
                            <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Usuarios ILIMITADOS</li>
                            <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Productos ILIMITADOS</li>
                            <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Reportes Avanzados</li>
                            <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Soporte Prioritario</li>
                            <li className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-green-500" /> Dashboards a Medida</li>
                        </ul>
                        <Link href="/login" className="w-full">
                            <Button variant="outline" className="w-full rounded-full" size="lg">Contactar Ventas</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </section>
      </main>
      
      <footer className="flex flex-col gap-4 sm:flex-row py-8 w-full shrink-0 items-center px-4 md:px-6 border-t bg-muted/20 text-muted-foreground">
        <p className="text-xs">© 2025 Kiosk POS. Hecho con ❤️ para comerciantes.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4 hover:text-foreground transition-colors" href="#">
            Términos y Condiciones
          </Link>
          <Link className="text-xs hover:underline underline-offset-4 hover:text-foreground transition-colors" href="#">
            Política de Privacidad
          </Link>
          <Link className="text-xs hover:underline underline-offset-4 hover:text-foreground transition-colors" href="#">
            Contacto
          </Link>
        </nav>
      </footer>
    </div>
  )
}
