import Link from "next/link";
import { getSession } from "@/lib/auth";
import { MobileNav, type NavItem } from "./mobile-nav";

export async function SiteHeader() {
  const session = await getSession();
  const role = session?.profile.role;

  const items: NavItem[] = [];
  if (session?.onboarded) {
    items.push({ href: "/mascotas", label: "Mascotas", icon: "🐾" });
    if (role === "vet") items.push({ href: "/vet", label: "Pacientes", icon: "🩺" });
    if (role === "admin") items.push({ href: "/admin", label: "Admin", icon: "🛠️" });
    items.push({ href: "/cuenta", label: "Cuenta", icon: "👤" });
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand text-white dark:text-black">
              🐾
            </span>
            Scan-Paw
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            {session ? (
              <>
                {/* En celular la navegación está en la barra inferior. */}
                <div className="hidden items-center gap-1 sm:flex">
                  {items.map((item) => (
                    <Link key={item.href} className="rounded-md px-3 py-2 hover:bg-brand-soft" href={item.href}>
                      {item.label}
                    </Link>
                  ))}
                </div>
                <form action="/salir" method="post" className={items.length ? "hidden sm:block" : ""}>
                  <button className="rounded-md px-3 py-2 text-muted hover:bg-brand-soft">Salir</button>
                </form>
              </>
            ) : (
              <Link className="rounded-md bg-brand px-3 py-2 font-medium text-white dark:text-black" href="/entrar">
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
