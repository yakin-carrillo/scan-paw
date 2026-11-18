import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Badge, Button, Card, Field, FlashMessages, formatDateTime, Input, PageTitle } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { friendlyDbError } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { escapeHtml, ownerEmails, sendEmail } from "@/lib/email";

export const metadata = { title: "Panel MVZ" };

async function redeemCode(formData: FormData) {
  "use server";
  const session = await requireRole(["vet"]);
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(code)) redirect(`/vet?error=${encodeURIComponent("El código tiene 6 caracteres.")}`);

  const supabase = await createClient();
  const { data: petId, error } = await supabase.rpc("redeem_share_code", { p_code: code });
  if (error || !petId) redirect(`/vet?error=${encodeURIComponent(friendlyDbError(error?.message))}`);

  await sendEmail({
    to: await ownerEmails(petId),
    subject: "Un médico veterinario usó tu código de acceso",
    html: `<p><strong>${escapeHtml(session.profile.full_name)}</strong> (cédula ${escapeHtml(
      session.vet?.cedula ?? "",
    )}) tiene acceso al expediente por 7 días.</p>`,
  });
  redirect(`/mascotas/${petId}`);
}

export default async function VetPage({ searchParams }: PageProps<"/vet">) {
  const session = await requireRole(["vet"]);
  const query = await searchParams;
  const vet = session.vet;

  if (!session.isVerifiedVet) {
    return (
      <>
        <PageTitle title="Panel MVZ" />
        {vet?.status === "rejected" ? (
          <Alert tone="error">
            No pudimos verificar tu cédula{vet.review_note ? `: ${vet.review_note}` : "."} Escríbenos para revisarlo.
          </Alert>
        ) : (
          <Alert tone="warning">
            Estamos verificando tu cédula profesional ({vet?.cedula}) en el Registro Nacional de Profesionistas. Te
            avisaremos por correo cuando se apruebe.
          </Alert>
        )}
      </>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("vet_access")
    .select("id, pet_id, source, expires_at, pets(name, species, breed)")
    .eq("vet_id", session.userId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false });

  type Row = {
    id: string;
    pet_id: string;
    source: string;
    expires_at: string;
    pets: { name: string; species: string; breed: string | null } | null;
  };
  // Un acceso por mascota (el de mayor vigencia).
  const seen = new Set<string>();
  const patients = ((data ?? []) as unknown as Row[]).filter((r) => !seen.has(r.pet_id) && seen.add(r.pet_id));

  return (
    <>
      <PageTitle
        title="Panel MVZ"
        subtitle={`${session.profile.full_name} · Cédula ${vet?.cedula}${vet?.clinic_name ? ` · ${vet.clinic_name}` : ""}`}
      />
      <FlashMessages error={query.error} ok={query.ok} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Escanear placa</h2>
          <p className="mt-1 text-sm text-muted">
            Abre la cámara de tu celular y escanea el QR de la placa. Con tu sesión iniciada verás el botón para abrir
            el expediente.
          </p>
        </Card>
        <Card>
          <h2 className="font-semibold">Código del propietario</h2>
          <form action={redeemCode} className="mt-3 flex gap-2">
            <Field label="Código de 6 caracteres">
              <Input name="code" required maxLength={6} className="font-mono uppercase" autoComplete="off" />
            </Field>
            <Button className="self-end">Abrir</Button>
          </form>
        </Card>
      </div>
      <h2 className="mt-8 mb-3 font-semibold">Pacientes con acceso vigente</h2>
      {patients.length === 0 ? (
        <p className="text-sm text-muted">No tienes accesos vigentes.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {patients.map((p) => (
            <li key={p.id}>
              <Link href={`/mascotas/${p.pet_id}`}>
                <Card className="hover:border-brand">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{p.pets?.name}</h3>
                    <Badge tone="brand">Hasta {formatDateTime(p.expires_at)}</Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {p.pets?.species === "gato" ? "Gato" : "Perro"}
                    {p.pets?.breed ? ` · ${p.pets.breed}` : ""}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
