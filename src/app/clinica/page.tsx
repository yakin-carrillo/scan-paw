import Link from "next/link";
import { CalendarDays, CalendarRange, ChevronRight, Clock, UserPlus, Users } from "lucide-react";
import { Badge, ButtonLink, Card, CardTitle, EmptyState, FlashMessages, PageTitle } from "@/components/ui";
import { PushBanner } from "@/components/push-toggle";
import { requireClinicAdmin } from "@/lib/auth";
import { mexicoCityDay } from "@/lib/clinic";
import { createClient } from "@/lib/supabase/server";
import { CalendarLinks } from "./calendar-links";
import { SetupSteps } from "./gate";

export const metadata = { title: "Panel de la clínica" };

type AgendaRow = {
  id: string;
  pet_id: string;
  pet_name: string;
  clinician_id: string | null;
  clinician_name: string | null;
  scheduled_at: string;
  reason: string;
  status: string;
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}

/** Espacio Clínica, panel: la agenda de hoy por MVZ, el equipo y el plan. */
export default async function ClinicaPanel({ searchParams }: PageProps<"/clinica">) {
  const session = await requireClinicAdmin();
  const { clinic } = session;
  const query = await searchParams;
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("clinic_members")
    .select("user_id, role, status")
    .eq("clinic_id", clinic.clinicId)
    .neq("status", "baja");
  const pending = (members ?? []).filter((m) => m.status === "pendiente").length;
  const active = (members ?? []).filter((m) => m.status === "activo").length;

  let today: AgendaRow[] = [];
  if (clinic.operational) {
    const day = mexicoCityDay(new Date().toISOString());
    const from = new Date(`${day}T00:00:00-06:00`);
    const { data } = await supabase.rpc("clinic_agenda", {
      p_clinic: clinic.clinicId,
      p_from: from.toISOString(),
      p_to: new Date(from.getTime() + 24 * 3600 * 1000).toISOString(),
    });
    today = ((data ?? []) as AgendaRow[]).filter((a) => a.status === "programada");
  }
  const byClinician = new Map<string, AgendaRow[]>();
  today.forEach((a) => {
    const key = a.clinician_name ?? "Sin asignar";
    byClinician.set(key, [...(byClinician.get(key) ?? []), a]);
  });

  return (
    <>
      <PageTitle
        eyebrow="Espacio Clínica"
        title={clinic.name}
        subtitle={`${active} ${active === 1 ? "miembro activo" : "miembros activos"}${pending ? ` · ${pending} por validar` : ""}`}
        actions={
          clinic.operational ? (
            <ButtonLink href="/clinica/calendario">
              <CalendarRange aria-hidden /> Calendario
            </ButtonLink>
          ) : undefined
        }
      />
      <FlashMessages error={query.error} ok={query.ok} />
      <PushBanner text="Activa los avisos para enterarte de solicitudes del equipo y cancelaciones." />

      {!clinic.operational && (
        <div className="mb-6">
          <SetupSteps clinic={clinic} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="min-w-0">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <CalendarDays aria-hidden className="size-5 text-brand" /> Hoy en la clínica
          </h2>
          {!clinic.operational ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface-2 p-6 text-sm text-muted">
              La agenda centralizada se activa con el plan Scan-Paw Clínicas.
            </p>
          ) : today.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Sin citas hoy" text="Agenda desde el calendario de la clínica." />
          ) : (
            <div className="flex flex-col gap-4">
              {[...byClinician.entries()].map(([name, items]) => (
                <Card key={name} className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{name}</h3>
                    <Badge tone={name === "Sin asignar" ? "warning" : "brand"}>
                      {items.length} {items.length === 1 ? "cita" : "citas"}
                    </Badge>
                  </div>
                  <ul className="flex flex-col divide-y divide-border text-sm">
                    {items.map((a) => (
                      <li key={a.id} className="flex items-start gap-3 py-2">
                        <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                        <span className="min-w-0">
                          <span className="font-medium">{timeLabel(a.scheduled_at)}</span> · {a.pet_name}
                          <span className="block text-muted">{a.reason}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <Link href="/clinica/equipo" className="group block">
            <Card className="flex items-center gap-4 p-4 transition group-hover:shadow-lift sm:p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                {pending ? <UserPlus aria-hidden className="size-5" /> : <Users aria-hidden className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Equipo</p>
                <p className="text-sm text-muted">
                  {pending ? `${pending} ${pending === 1 ? "solicitud" : "solicitudes"} por validar` : "Invita y valida a tus MVZ"}
                </p>
              </div>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
            </Card>
          </Link>
          {clinic.operational && (
            <Card>
              <CardTitle
                icon={CalendarRange}
                title="Calendario en tu teléfono"
                subtitle="Suscríbete a la agenda de la clínica en Google Calendar o Calendario de Apple."
              />
              <CalendarLinks back="/clinica" />
            </Card>
          )}
          <p className="text-xs text-muted">
            Como administrador gestionas citas y equipo, pero no ves expedientes clínicos. Si también eres MVZ, ábrelos
            desde tu espacio clínico.
          </p>
        </div>
      </div>
    </>
  );
}
