import { BadgeCheck, GraduationCap, KeyRound, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge, Button, Card, CardTitle, EmptyState, FlashMessages, formatDate, PageTitle } from "@/components/ui";
import { CleanFlashParams } from "@/components/clean-url";
import { CopyButton } from "@/components/copy-button";
import { requireClinicAdmin } from "@/lib/auth";
import { CLINIC_PLAN } from "@/lib/plans";
import { createClient } from "@/lib/supabase/server";
import { createInvite, removeMember, reviewMember } from "../actions";
import { OperationalGate } from "../gate";

export const metadata = { title: "Equipo de la clínica" };

type MemberRow = {
  user_id: string;
  role: "admin" | "clinico";
  status: "pendiente" | "activo";
  joined_at: string;
  profiles: {
    full_name: string;
    phone: string | null;
    role: string;
    vet_profiles: { cedula: string; status: string } | null;
    student_profiles: { university: string; enrollment_id: string; status: string } | null;
  } | null;
};

export default async function EquipoPage({ searchParams }: PageProps<"/clinica/equipo">) {
  const session = await requireClinicAdmin();
  const { clinic } = session;
  const query = await searchParams;
  const code = typeof query.codigo === "string" && /^[0-9A-Z]{8}$/.test(query.codigo) ? query.codigo : null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_members")
    .select(
      "user_id, role, status, joined_at, profiles!clinic_members_user_id_fkey(full_name, phone, role, vet_profiles!vet_profiles_user_id_fkey(cedula, status), student_profiles!student_profiles_user_id_fkey(university, enrollment_id, status))",
    )
    .eq("clinic_id", clinic.clinicId)
    .neq("status", "baja")
    .order("joined_at");
  const members = (data ?? []) as unknown as MemberRow[];
  const pending = members.filter((m) => m.status === "pendiente");
  const active = members.filter((m) => m.status === "activo");

  const credential = (m: MemberRow) => {
    const p = m.profiles;
    if (p?.role === "student") return `${p.student_profiles?.university ?? ""} · Matrícula ${p.student_profiles?.enrollment_id ?? ""}`;
    if (p?.vet_profiles) return `Cédula ${p.vet_profiles.cedula}`;
    return "Sin perfil profesional";
  };
  const verified = (m: MemberRow) =>
    m.profiles?.vet_profiles?.status === "approved" || m.profiles?.student_profiles?.status === "approved";

  return (
    <>
      <PageTitle
        eyebrow="Espacio Clínica"
        title="Equipo"
        subtitle={`${active.length} de ${CLINIC_PLAN.seats} miembros activos.`}
      />
      <FlashMessages error={query.error} ok={query.ok} />
      <div className="mb-5">
        <OperationalGate clinic={clinic} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <CardTitle
              icon={KeyRound}
              title="Invitar a un MVZ o estudiante"
              subtitle="Código de 8 caracteres, válido 7 días y de un solo uso. Lo canjea en su pantalla Hoy."
            />
            {code ? (
              <div className="flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft p-4">
                <p className="font-mono text-2xl font-semibold tracking-[0.2em] text-brand-strong">{code}</p>
                <CopyButton value={code} />
                <p className="text-xs text-muted">Solo se muestra una vez. Si lo pierdes, genera otro.</p>
                <CleanFlashParams />
              </div>
            ) : (
              <form action={createInvite}>
                <Button variant="secondary" disabled={!clinic.operational}>
                  <UserPlus aria-hidden /> Generar código
                </Button>
              </form>
            )}
          </Card>
          <Card className="text-sm">
            <CardTitle icon={ShieldCheck} title="Al validar a alguien" />
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted">
              <li>Confirmas que trabaja en tu clínica y que su cédula o matrícula es real.</li>
              <li>Queda verificado en toda la red Scan-Paw, con tu clínica como responsable.</li>
              <li>Podrás asignarle citas desde el calendario de la clínica.</li>
            </ul>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {pending.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Por validar</h2>
              <ul className="flex flex-col gap-3">
                {pending.map((m) => (
                  <li key={m.user_id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-4">
                      <div className="min-w-0">
                        <p className="font-semibold">{m.profiles?.full_name}</p>
                        <p className="text-sm text-muted">{credential(m)}</p>
                        <p className="text-xs text-muted">
                          Solicitó el {formatDate(m.joined_at)}
                          {m.profiles?.phone ? ` · ${m.profiles.phone}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <form action={reviewMember.bind(null, m.user_id, true)}>
                          <Button
                            disabled={!clinic.operational}
                            confirm={`¿Validar a ${m.profiles?.full_name}? Quedará verificado en toda la red con tu clínica como responsable.`}
                          >
                            Validar
                          </Button>
                        </form>
                        <form action={reviewMember.bind(null, m.user_id, false)}>
                          <Button variant="ghost" className="text-danger" disabled={!clinic.operational}>
                            Rechazar
                          </Button>
                        </form>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold">Miembros</h2>
            {active.length === 0 ? (
              <EmptyState icon={Users} title="Aún no hay miembros" text="Genera un código e invita a tu equipo." />
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface px-4">
                {active.map((m) => (
                  <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {m.profiles?.full_name}
                        {m.role === "admin" && <Badge tone="brand">Administrador</Badge>}
                        {m.profiles?.role === "student" ? (
                          <Badge tone="warning">
                            <GraduationCap aria-hidden /> No profesionista
                          </Badge>
                        ) : verified(m) ? (
                          <Badge tone="verified">
                            <BadgeCheck aria-hidden /> Verificado
                          </Badge>
                        ) : (
                          m.profiles?.vet_profiles && <Badge>Cédula en revisión</Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted">{credential(m)}</p>
                    </div>
                    {m.user_id !== session.userId && (
                      <form action={removeMember.bind(null, m.user_id)}>
                        <Button
                          variant="ghost"
                          className="min-h-9 px-3 text-xs text-danger"
                          confirm={`¿Dar de baja a ${m.profiles?.full_name}? Sus citas futuras quedarán sin asignar.`}
                        >
                          Dar de baja
                        </Button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
