"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: string };

/**
 * Barra de navegación inferior para celular (oculta desde 640 px).
 * Respeta la zona segura de iPhone cuando la app se abre desde la pantalla de inicio.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      {/* reserva el espacio de la barra para que no tape el contenido */}
      <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))] sm:hidden" />
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-0.5 text-xs ${
                    active ? "font-semibold text-brand" : "text-muted"
                  }`}
                >
                  <span aria-hidden className="text-xl leading-none">
                    {item.icon}
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
