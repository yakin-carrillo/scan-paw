import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Badge, Button, ButtonLink, Card, FlashMessages, formatDate, Input, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { escapeHtml, sendEmail } from "@/lib/email";
import { friendlyDbError } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { VerificationStatus } from "@/lib/types";

export const metadata = { title: "Administración" };

const SEP_URL = "https://www.cedulaprofesional.sep.gob.mx/";

const reviewSchema = z.object({
  user: z.uuid(),
  status: z.enum(["approved", "rejected"]),
  note: z.string().max(300).optional(),
});

async function reviewVet(formData: FormData) {
  "use server";
  await requireRole(["admin"]);
  const parsed = reviewSchema.safeParse({
    user: formData.get("user"),
    status: formData.get("status"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) redirect("/admin?error=Datos%20no%20v%C3%A1lidos");
  if (parsed.data.status === "rejected" && !parsed.data.note?.trim()) {
    redirect("/admin?error=Escribe%20el%20motivo%20del%20rechazo");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_vet", {
    p_user: parsed.data.user,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? "",
  });
  if (error) redirect(`/admin?error=${encodeURIComponent(friendlyDbError(error.message))}`);

  const { data } = await createAdminClient().auth.admin.getUserById(parsed.data.user);
  if (data.user?.email) {
    await sendEmail({
      to: [data.user.email],
      subject:
        parsed.data.status === "approved"
          ? "Tu cédula fue verificada en Scan-Paw"
          : "No pudimos verificar tu cédula en Scan-Paw",
      html:
        parsed.data.status === "approved"
          ? "<p>Ya puedes abrir expedientes escaneando las placas Scan-Paw.</p>"
          : `<p>Motivo: ${escapeHtml(parsed.data.note || "sin especificar")}</p>`,
    });
  }
  revalidatePath("/admin");
  redirect("/admin?ok=Revisi%C3%B3n%20guardada");
}

type VetRow = {
  user_id: string;
  cedula: string;
  clinic_name: string | null;
  status: VerificationStatus;
  review_note: string | null;
  created_at: string;
  profiles: { full_name: string; phone: string | null } | null;
};

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireRole(["admin"]);
  const query = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vet_profiles")
    .select("user_id, cedula, clinic_name, status, review_note, created_at, profiles!vet_profiles_user_id_fkey(full_name, phone)")
    .order("created_at", { ascending: false })
    .limit(200);
  const vets = (data ?? []) as unknown as VetRow[];

  const cedulaCount = new Map<string, number>();
  vets.forEach((v) => cedulaCount.set(v.cedula, (cedulaCount.get(v.cedula) ?? 0) + 1));
  const pending = vets.filter((v) => v.status === "pending");
  const reviewed = vets.filter((v) => v.status !== "pending");

  return (
    <>
      <PageTitle
        title="Administración"
        actions={
          <ButtonLink href="/admin/placas" variant="secondary">
            Placas
          </ButtonLink>
        }
      />
      <FlashMessages error={query.error} ok={query.ok} />
      <h2 className="mb-3 font-semibold">Cédulas por verificar ({pending.length})</h2>
      <p className="mb-4 text-sm text-muted">
        Busca la cédula en el{" "}
        <Link href={SEP_URL} target="_blank" className="underline">
          Registro Nacional de Profesionistas
        </Link>{" "}
        y confirma que el nombre coincide y que la carrera es Médico Veterinario Zootecnista (o equivalente).
      </p>
      {pending.length === 0 && <p className="text-sm text-muted">No hay solicitudes pendientes.</p>}
      <ul className="flex flex-col gap-3">
        {pending.map((v) => (
          <li key={v.user_id}>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{v.profiles?.full_name}</h3>
                <Badge>Cédula {v.cedula}</Badge>
                {(cedulaCount.get(v.cedula) ?? 0) > 1 && <Badge tone="danger">Cédula repetida</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted">
                {v.clinic_name ?? "Sin clínica"} · {v.profiles?.phone ?? "sin teléfono"} · solicitada el{" "}
                {formatDate(v.created_at)}
              </p>
              <form action={reviewVet} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="user" value={v.user_id} />
                <Input name="note" placeholder="Nota (obligatoria si rechazas)" className="max-w-xs" maxLength={300} />
                <Button name="status" value="approved">
                  Aprobar
                </Button>
                <Button name="status" value="rejected" variant="danger">
                  Rechazar
                </Button>
              </form>
            </Card>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 mb-3 font-semibold">Revisadas</h2>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface text-sm">
        {reviewed.map((v) => (
          <li key={v.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
            <span>
              {v.profiles?.full_name} · {v.cedula}
            </span>
            <Badge tone={v.status === "approved" ? "brand" : "danger"}>
              {v.status === "approved" ? "Aprobada" : "Rechazada"}
            </Badge>
          </li>
        ))}
        {reviewed.length === 0 && <li className="px-4 py-2 text-muted">Ninguna todavía.</li>}
      </ul>
    </>
  );
}
