import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RegisterServiceWorker } from "@/components/register-sw";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Scan-Paw", template: "%s · Scan-Paw" },
  description: "Historial clínico universal de tu mascota en una placa con código QR.",
  applicationName: "Scan-Paw",
  // iOS: al agregar a la pantalla de inicio se abre sin barras del navegador.
  appleWebApp: { capable: true, title: "Scan-Paw", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a201e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-10">{children}</main>
        <footer className="hidden border-t border-border px-4 py-6 text-center text-xs text-muted sm:block">
          Scan-Paw · <a className="underline" href="/privacidad">Aviso de privacidad</a>
        </footer>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
