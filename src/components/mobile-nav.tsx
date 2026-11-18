"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, PawPrint, ScanLine, ShieldCheck, Stethoscope, User } from "lucide-react";

const ICONS = {
  mascotas: PawPrint,
  pacientes: Stethoscope,
  agenda: CalendarDays,
  escanear: ScanLine,
  admin: ShieldCheck,
  cuenta: User,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/vet" && pathname.startsWith(`${href}/`));
}

/** Navegación de escritorio (en el encabezado). */
export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="hidden items-center gap-1 sm:flex">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-brand-soft font-medium text-brand-strong" : "text-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Barra de navegación inferior para celular (oculta desde 640 px).
 * Respeta la zona segura de iPhone cuando la app se abre desde la pantalla de inicio.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {/* reserva el espacio de la barra para que no tape el contenido */}
      <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))] sm:hidden print:hidden" />
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg sm:hidden print:hidden"
      >
        <ul className="mx-auto flex max-w-md px-2">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = ICONS[item.icon];
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[4.5rem] flex-col items-center justify-center gap-1 text-[11px] ${
                    active ? "font-semibold text-brand" : "text-muted"
                  }`}
                >
                  <span
                    className={`grid h-8 w-14 place-items-center rounded-full transition ${active ? "bg-brand-soft" : ""}`}
                  >
                    <Icon aria-hidden className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
