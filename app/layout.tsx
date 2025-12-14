import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner"
import { KioskProvider } from "@/components/providers/kiosk-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-muted/20`}
      >
        <KioskProvider>
            <div className="flex min-h-screen">
                <Sidebar />
                <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out w-full max-w-[100vw] overflow-x-hidden">
                    <MobileNav />
                    <main className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto">
                        {children}
                    </main>
                </div>
            </div>
            <Toaster />
        </KioskProvider>
      </body>
    </html>
  );
}
