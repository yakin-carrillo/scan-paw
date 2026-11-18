import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { RegisterServiceWorker } from "@/components/register-sw";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"] });

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
    { media: "(prefers-color-scheme: light)", color: "#f6f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1513" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10 print:max-w-none print:p-0">
          {children}
        </main>
        <footer className="hidden border-t border-border px-4 py-8 text-center text-xs text-muted sm:block print:hidden">
          Scan-Paw · Historial clínico veterinario ·{" "}
          <a className="underline hover:text-foreground" href="/privacidad">
            Aviso de privacidad
          </a>
        </footer>
        <RegisterServiceWorker />
        <Analytics />
      </body>
    </html>
  );
}
