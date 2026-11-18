import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Scan-Paw", template: "%s · Scan-Paw" },
  description: "Historial clínico universal de tu mascota en una placa con código QR.",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-10">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
          Scan-Paw · <a className="underline" href="/privacidad">Aviso de privacidad</a>
        </footer>
      </body>
    </html>
  );
}
