import { redirect } from "next/navigation";
import { Badge, Button, ButtonLink, Card, Field, FlashMessages, formatDate, Input, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { friendlyDbError } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import type { Tag } from "@/lib/types";

export const metadata = { title: "Placas" };

async function generateTags(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const count = Number(formData.get("count"));
  const batch = String(formData.get("batch") ?? "").trim().slice(0, 40);
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    redirect("/admin/placas?error=Entre%201%20y%20500%20placas");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_generate_tags", { p_count: count, p_batch: batch });
  if (error) redirect(`/admin/placas?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  redirect(`/admin/placas?lote=${encodeURIComponent(batch)}&ok=${count}%20placas%20generadas`);
}

export default async function PlacasAdminPage({ searchParams }: PageProps<"/admin/placas">) {
  await requireRole(["admin"]);
  const query = await searchParams;
  const lote = typeof query.lote === "string" ? query.lote : "";
  const supabase = await createClient();

  let q = supabase.from("tags").select("*").order("created_at", { ascending: false }).limit(200);
  if (lote) q = q.eq("batch", lote);
  const { data } = await q;
  const tags = (data ?? []) as Tag[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <a href="/admin" className="mb-3 inline-block text-sm text-muted">
        ← Administración
      </a>
      <PageTitle
        title="Placas"
        subtitle="Genera lotes sin asignar. Cada placa lleva el QR y su código; el código de activación va en el empaque."
      />
      <FlashMessages error={query.error} ok={query.ok} />
      <Card>
        <form action={generateTags} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Cantidad">
            <Input name="count" type="number" min={1} max={500} defaultValue={20} required />
          </Field>
          <Field label="Nombre del lote">
            <Input name="batch" maxLength={40} defaultValue={`lote-${today}`} required />
          </Field>
          <Button>Generar</Button>
        </form>
      </Card>

      <div className="mt-6 mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{lote ? `Lote ${lote}` : "Últimas placas"}</h2>
        {lote && (
          <ButtonLink href={`/admin/placas/csv?lote=${encodeURIComponent(lote)}`} variant="secondary" prefetch={false}>
            Descargar CSV del lote
          </ButtonLink>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Placa</th>
              <th className="px-4 py-2 font-medium">Activación</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Lote</th>
              <th className="px-4 py-2 font-medium">QR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tags.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 font-mono">{t.public_token}</td>
                <td className="px-4 py-2 font-mono">{t.status === "sin_asignar" ? t.activation_code : "—"}</td>
                <td className="px-4 py-2">
                  <Badge tone={t.status === "activa" ? "brand" : t.status === "revocada" ? "danger" : "neutral"}>
                    {t.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-muted">
                  {t.batch ?? "—"} · {formatDate(t.created_at)}
                </td>
                <td className="px-4 py-2">
                  <a className="underline" href={`/api/qr/${t.public_token}?descargar`}>
                    SVG
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
