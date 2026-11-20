import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "./logo";
import { DesktopNav, SpaceSwitcher } from "./app-nav";

export function SiteHeader({ signedIn, withNav }: { signedIn: boolean; withNav: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-lg print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link href="/" aria-label="Scan-Paw, inicio" className="shrink-0">
            <Logo className="max-[359px]:[&>span:last-child]:hidden" />
          </Link>
          {withNav && <SpaceSwitcher />}
        </div>
        <nav aria-label="Secciones" className="flex shrink-0 items-center gap-1">
          {signedIn ? (
            <>
              {/* En celular la navegación está en la barra inferior. */}
              {withNav && <DesktopNav />}
              <form action="/salir" method="post" className={withNav ? "hidden sm:block" : ""}>
                <button
                  className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-brand-soft hover:text-foreground"
                  aria-label="Cerrar sesión"
                >
                  <LogOut aria-hidden className="size-4" />
                  <span className="hidden lg:inline">Salir</span>
                </button>
              </form>
            </>
          ) : (
            <Link
              className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-ink shadow-sm hover:bg-brand-strong"
              href="/entrar"
            >
              Entrar
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
