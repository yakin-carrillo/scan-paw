import Link from "next/link";
import { CalendarPlus, Cat, Check, ChevronLeft, ChevronRight, Dog, Phone, X } from "lucide-react";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardTitle,
  cx,
  Field,
  FlashMessages,
  Input,
  PageTitle,
  Select,
} from "@/components/ui";
import { requireClinicAdmin } from "@/lib/auth";
import { mexicoCityDay } from "@/lib/clinic";
import { createClient } from "@/lib/supabase/server";
import { clinicSchedule, clinicSetStatus, clinicUpdateAppointment } from "../actions";
import { OperationalGate } from "../gate";

export const metadata = { title: "Calendario de la clínica" };

type AgendaRow = {
  id: string;
  pet_id: string;
  pet_name: string;
  species: "perro" | "gato";
  clinician_id: string | null;
  clinician_name: string | null;
  scheduled_at: string;
  reason: string;
  status: "programada" | "completada" | "cancelada";
  owner_name: string | null;
  owner_phone: string | null;
};

type Member = {
  user_id: string;
  profiles: {
    full_name: string;
    role: string;
    vet_profiles: { status: string } | null;
    student_profiles: { status: string } | null;
  } | null;
};

/** Lunes (yyyy-mm-dd) de la semana que contiene `day`. */
function mondayOf(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dayTitle(day: string) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}
/** Valor para <input type="datetime-local"> en hora de CDMX. */
function localValue(iso: string) {
  return new Date(new Date(iso).getTime() - 6 * 3600 * 1000).toISOString().slice(0, 16);
}

/** Calendario semanal de toda la clínica, con filtro por MVZ. */
export default async function CalendarioPage({ searchParams }: PageProps<"/clinica/calendario">) {
  const session = await requireClinicAdmin();
  const { clinic } = session;
  const query = await searchParams;
  const today = mexicoCityDay(new Date().toISOString());
  const week = mondayOf(typeof query.semana === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.semana) ? query.semana : today);
  const mvz = typeof query.mvz === "string" ? query.mvz : "";
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  const supabase = await createClient();
  const { data: memberRows } = await supabase
    .from("clinic_members")
    .select(
      "user_id, profiles!clinic_members_user_id_fkey(full_name, role, vet_profiles!vet_profiles_user_id_fkey(status), student_profiles!student_profiles_user_id_fkey(status))",
    )
    .eq("clinic_id", clinic.clinicId)
    .eq("status", "activo");
  const clinicians = ((memberRows ?? []) as unknown as Member[]).filter(
    (m) => m.profiles?.vet_profiles?.status === "approved" || m.profiles?.student_profiles?.status === "approved",
  );

  let rows: AgendaRow[] = [];
  let patients: { pet_id: string; pet_name: string; species: string }[] = [];
  if (clinic.operational) {
    const from = new Date(`${week}T00:00:00-06:00`);
    const [agenda, pts] = await Promise.all([
      supabase.rpc("clinic_agenda", {
        p_clinic: clinic.clinicId,
        p_from: from.toISOString(),
        p_to: new Date(from.getTime() + 7 * 24 * 3600 * 1000).toISOString(),
      }),
      supabase.rpc("clinic_patients", { p_clinic: clinic.clinicId }),
    ]);
    rows = ((agenda.data ?? []) as AgendaRow[]).filter((a) => !mvz || a.clinician_id === mvz || (mvz === "sin" && !a.clinician_id));
    patients = (pts.data ?? []) as typeof patients;
  }
  const byDay = new Map(days.map((d) => [d, rows.filter((a) => mexicoCityDay(a.scheduled_at) === d)]));
  const link = (params: { semana?: string; mvz?: string }) => {
    const qs = new URLSearchParams();
    const s = params.semana ?? week;
    const m = params.mvz ?? mvz;
    if (s !== mondayOf(today)) qs.set("semana", s);
    if (m) qs.set("mvz", m);
    return `/clinica/calendario${qs.size ? `?${qs}` : ""}`;
  };
  const minLocal = localValue(new Date().toISOString());

  return (
    <>
      <PageTitle eyebrow="Espacio Clínica" title="Calendario" subtitle="Agenda centralizada de todo tu equipo. Hora del centro de México." />
      <FlashMessages error={query.error} ok={query.ok} />
      <div className="mb-5">
        <OperationalGate clinic={clinic} />
      </div>

      {clinic.operational && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <ButtonLink href={link({ semana: addDays(week, -7) })} variant="secondary" className="min-h-10 px-3" aria-label="Semana anterior">
                <ChevronLeft aria-hidden />
              </ButtonLink>
              <ButtonLink href={link({ semana: mondayOf(today) })} variant="ghost" className="min-h-10 px-3">
                Esta semana
              </ButtonLink>
              <ButtonLink href={link({ semana: addDays(week, 7) })} variant="secondary" className="min-h-10 px-3" aria-label="Semana siguiente">
                <ChevronRight aria-hidden />
              </ButtonLink>
              <span className="ml-2 text-sm font-medium">
                {dayTitle(days[0])} al {dayTitle(days[6])}
              </span>
            </div>
            <nav aria-label="Filtrar por MVZ" className="flex flex-wrap gap-1.5 text-xs">
              {[{ id: "", name: "Todos" }, ...clinicians.map((c) => ({ id: c.user_id, name: c.profiles?.full_name ?? "" })), { id: "sin", name: "Sin asignar" }].map(
                (c) => (
                  <Link
                    key={c.id || "todos"}
                    href={link({ mvz: c.id })}
                    aria-current={mvz === c.id ? "true" : undefined}
                    className={cx(
                      "rounded-full px-3 py-1.5 transition",
                      mvz === c.id ? "bg-brand font-medium text-brand-ink" : "border border-border bg-surface text-muted hover:text-foreground",
                    )}
                  >
                    {c.name}
                  </Link>
                ),
              )}
            </nav>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
            <div className="grid min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
              {days.map((d) => {
                const items = byDay.get(d) ?? [];
                return (
                  <section
                    key={d}
                    className={cx(
                      "min-w-0 rounded-2xl border bg-surface p-3",
                      d === today ? "border-brand ring-2 ring-brand/15" : "border-border",
                    )}
                  >
                    <h2 className="mb-2 flex items-center justify-between text-sm font-semibold capitalize">
                      {dayTitle(d)}
                      {items.length > 0 && <Badge>{items.length}</Badge>}
                    </h2>
                    {items.length === 0 ? (
                      <p className="py-2 text-xs text-muted">Sin citas</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {items.map((a) => (
                          <li
                            key={a.id}
                            className={cx(
                              "rounded-xl border p-2.5 text-sm",
                              a.status === "cancelada" ? "border-border opacity-60" : "border-border bg-surface-2",
                              !a.clinician_id && a.status === "programada" && "border-warning/50",
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {a.species === "gato" ? (
                                <Cat aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                              ) : (
                                <Dog aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold">
                                  {timeLabel(a.scheduled_at)} · {a.pet_name}
                                </p>
                                <p className="text-xs text-muted">{a.reason}</p>
                                <p className="mt-1 text-xs">
                                  {a.clinician_name ?? <span className="font-medium text-warning">Sin asignar</span>}
                                  {a.status !== "programada" && <span className="text-muted"> · {a.status}</span>}
                                </p>
                                {a.owner_phone && (
                                  <a href={`tel:${a.owner_phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-brand underline">
                                    <Phone aria-hidden className="size-3" /> {a.owner_name ?? "Propietario"}
                                  </a>
                                )}
                              </div>
                            </div>
                            {a.status === "programada" && (
                              <details className="mt-2 text-xs">
                                <summary className="cursor-pointer text-muted">Reagendar o reasignar</summary>
                                <form action={clinicUpdateAppointment.bind(null, a.id)} className="mt-2 flex flex-col gap-2">
                                  <input type="hidden" name="semana" value={week} />
                                  <Select name="clinician" required defaultValue={a.clinician_id ?? ""} aria-label="MVZ asignado">
                                    <option value="" disabled>
                                      Elige al MVZ…
                                    </option>
                                    {clinicians.map((c) => (
                                      <option key={c.user_id} value={c.user_id}>
                                        {c.profiles?.full_name}
                                      </option>
                                    ))}
                                  </Select>
                                  <Input name="at" type="datetime-local" required defaultValue={localValue(a.scheduled_at)} aria-label="Fecha y hora" />
                                  <Button variant="secondary" className="min-h-9 text-xs">
                                    Guardar cambios
                                  </Button>
                                </form>
                                <div className="mt-2 flex gap-1.5">
                                  <form action={clinicSetStatus.bind(null, a.id, "completada")}>
                                    <input type="hidden" name="semana" value={week} />
                                    <Button variant="ghost" className="min-h-8 px-2 text-xs">
                                      <Check aria-hidden /> Completada
                                    </Button>
                                  </form>
                                  <form action={clinicSetStatus.bind(null, a.id, "cancelada")}>
                                    <input type="hidden" name="semana" value={week} />
                                    <Button
                                      variant="ghost"
                                      className="min-h-8 px-2 text-xs text-danger"
                                      confirm={`¿Cancelar la cita de ${a.pet_name}? Avisaremos a la familia y al MVZ.`}
                                    >
                                      <X aria-hidden /> Cancelar
                                    </Button>
                                  </form>
                                </div>
                              </details>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>

            <Card className="h-fit xl:sticky xl:top-24">
              <CardTitle
                icon={CalendarPlus}
                title="Nueva cita"
                tone="accent"
                subtitle="Solo pacientes a los que alguien de tu equipo tiene acceso vigente."
              />
              {patients.length === 0 || clinicians.length === 0 ? (
                <p className="text-sm text-muted">
                  {clinicians.length === 0
                    ? "Valida al menos a un MVZ en Equipo para asignarle citas."
                    : "Cuando un MVZ de tu equipo escanee la placa de un paciente, podrás agendarlo aquí."}
                </p>
              ) : (
                <form action={clinicSchedule} className="flex flex-col gap-3">
                  <input type="hidden" name="semana" value={week} />
                  <Field label="Paciente">
                    <Select name="pet" required defaultValue="">
                      <option value="" disabled>
                        Elige…
                      </option>
                      {patients.map((p) => (
                        <option key={p.pet_id} value={p.pet_id}>
                          {p.pet_name} ({p.species})
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="MVZ">
                    <Select name="clinician" required defaultValue={mvz && mvz !== "sin" ? mvz : ""}>
                      <option value="" disabled>
                        Elige…
                      </option>
                      {clinicians.map((c) => (
                        <option key={c.user_id} value={c.user_id}>
                          {c.profiles?.full_name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Fecha y hora">
                    <Input name="at" type="datetime-local" required min={minLocal} />
                  </Field>
                  <Field label="Motivo">
                    <Input name="reason" required maxLength={200} placeholder="Vacuna, control, cirugía…" />
                  </Field>
                  <Button>
                    <CalendarPlus aria-hidden /> Agendar
                  </Button>
                  <p className="text-xs text-muted">
                    El MVZ asignado obtiene acceso al expediente hasta el día siguiente a la cita y la familia recibe un aviso.
                  </p>
                </form>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
