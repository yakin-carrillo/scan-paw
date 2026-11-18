import { brandIcon } from "@/lib/brand-icon";

/** Íconos del manifest: /iconos/192, /iconos/512 y /iconos/maskable. */
const VARIANTS = {
  "192": () => brandIcon(192, { rounded: true }),
  "512": () => brandIcon(512, { rounded: true }),
  maskable: () => brandIcon(512, { padded: true }),
} as const;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variante) => ({ variante }));
}

export async function GET(_request: Request, ctx: RouteContext<"/iconos/[variante]">) {
  const { variante } = await ctx.params;
  const render = VARIANTS[variante as keyof typeof VARIANTS];
  if (!render) return new Response("No encontrado", { status: 404 });
  return render();
}
