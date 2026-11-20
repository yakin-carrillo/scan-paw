import type { Metadata, Viewport } from "next";
import { Figtree, JetBrains_Mono, Sora } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { RegisterServiceWorker } from "@/components/register-sw";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { BottomNav, SpacesProvider } from "@/components/app-nav";
import { getSession } from "@/lib/auth";
import { buildSpaces, isSpaceId, SPACE_COOKIE } from "@/lib/spaces";
import "./globals.css";

// Guía de identidad: Sora (títulos y logotipo), Figtree (interfaz) y JetBrains Mono (códigos).
const sora = Sora({ variable: "--font-sora", subsets: ["latin"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["500", "700"] });

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
    { media: "(prefers-color-scheme: light)", color: "#f6f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#11132b" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  const spaces = session?.onboarded ? buildSpaces(session) : [];
  const saved = (await cookies()).get(SPACE_COOKIE)?.value;

  return (
    <html
      lang="es-MX"
      className={`${sora.variable} ${figtree.variable} ${mono.variable} antialiased`}
    >
      <body className="flex min-h-dvh flex-col font-sans">
        <SpacesProvider spaces={spaces} remembered={isSpaceId(saved) ? saved : null}>
        <SiteHeader signedIn={Boolean(session)} withNav={spaces.length > 0} />
        <main className="mx-auto w-full min-w-0 max-w-5xl flex-1 px-4 py-6 sm:py-10 print:max-w-none print:p-0">
          {children}
        </main>
        <footer className="hidden border-t border-border px-4 py-8 text-center text-xs text-muted sm:block print:hidden">
          Scan-Paw · Historial clínico veterinario ·{" "}
          <a className="underline hover:text-foreground" href="/privacidad">
            Aviso de privacidad
          </a>
        </footer>
        <BottomNav />
        </SpacesProvider>
        <RegisterServiceWorker />
        <Analytics />
      </body>
    </html>
  );
}
