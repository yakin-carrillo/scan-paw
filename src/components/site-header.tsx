import Link from "next/link";
import { LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import { Logo } from "./logo";
import { DesktopNav, MobileNav, type NavItem } from "./mobile-nav";

export async function SiteHeader() {
  const session = await getSession();
  const role = session?.profile.role;
  const clinician = role === "vet" || role === "student";

  const items: NavItem[] = [];
  if (session?.onboarded) {
    if (clinician) {
      items.push({ href: "/vet", label: "Pacientes", icon: "pacientes" });
      items.push({ href: "/vet/agenda", label: "Agenda", icon: "agenda" });
      items.push({ href: "/escanear", label: "Escanear", icon: "escanear" });
    } else {
      items.push({ href: "/mascotas", label: "Mascotas", icon: "mascotas" });
      items.push({ href: "/escanear", label: "Escanear", icon: "escanear" });
    }
    if (role === "admin") items.push({ href: "/admin", label: "Admin", icon: "admin" });
    items.push({ href: "/cuenta", label: "Cuenta", icon: "cuenta" });
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur-lg print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" aria-label="Scan-Paw, inicio">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            {session ? (
              <>
                {/* En celular la navegación está en la barra inferior. */}
                <DesktopNav items={items} />
                <form action="/salir" method="post" className={items.length ? "hidden sm:block" : ""}>
                  <button
                    className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-brand-soft hover:text-foreground"
                    aria-label="Cerrar sesión"
                  >
                    <LogOut aria-hidden className="size-4" />
                    <span className="hidden md:inline">Salir</span>
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
      {items.length > 0 && <MobileNav items={items} />}
    </>
  );
}
