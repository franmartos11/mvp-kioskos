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
  title: "Kiosk App",
  description: "Point of Sale System",
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
