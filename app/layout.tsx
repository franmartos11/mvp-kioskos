import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner"
import { KioskProvider } from "@/components/providers/kiosk-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ClientLayout } from "@/components/layout/client-layout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KioskApp — Punto de Venta para Kioscos",
  description: "Sistema de gestión y punto de venta para kioscos. Inventario, ventas, caja y empleados en un solo lugar.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KioskApp",
  },
  themeColor: "#2563eb",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
      >
        <QueryProvider>
            <KioskProvider>
                <ClientLayout>
                    {children}
                </ClientLayout>
                <Toaster />
            </KioskProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
