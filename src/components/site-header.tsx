import Link from "next/link";
import { getSession } from "@/lib/auth";

export async function SiteHeader() {
  const session = await getSession();
  const role = session?.profile.role;

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-brand text-white dark:text-black">
            🐾
          </span>
          Scan-Paw
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {session ? (
            <>
              <Link className="rounded-md px-3 py-2 hover:bg-brand-soft" href="/mascotas">
                Mis mascotas
              </Link>
              {role === "vet" && (
                <Link className="rounded-md px-3 py-2 hover:bg-brand-soft" href="/vet">
                  Panel MVZ
                </Link>
              )}
              {role === "admin" && (
                <Link className="rounded-md px-3 py-2 hover:bg-brand-soft" href="/admin">
                  Administración
                </Link>
              )}
              <Link className="rounded-md px-3 py-2 hover:bg-brand-soft" href="/cuenta">
                Mi cuenta
              </Link>
              <form action="/salir" method="post">
                <button className="rounded-md px-3 py-2 text-muted hover:bg-brand-soft">Salir</button>
              </form>
            </>
          ) : (
            <>
              <Link className="rounded-md px-3 py-2 hover:bg-brand-soft" href="/entrar">
                Entrar
              </Link>
              <Link
                className="rounded-md bg-brand px-3 py-2 font-medium text-white dark:text-black"
                href="/registro"
              >
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
