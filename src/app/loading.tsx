/** Esqueleto mientras carga una página (el encabezado y la navegación se mantienen). */
export default function Loading() {
  return (
    <div role="status" aria-label="Cargando" className="flex animate-pulse flex-col gap-5">
      <div className="h-3 w-24 rounded-full bg-border/70" />
      <div className="h-8 w-56 rounded-xl bg-border/70" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
            <div className="size-16 shrink-0 rounded-2xl bg-border/70" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 w-2/3 rounded-full bg-border/70" />
              <div className="h-3 w-1/2 rounded-full bg-border/50" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
