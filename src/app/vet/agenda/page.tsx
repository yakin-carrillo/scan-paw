import Link from "next/link";
import { CalendarDays, CalendarPlus, Check, Printer, X } from "lucide-react";
import {
  BackLink,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  Field,
  FlashMessages,
  Input,
  PageTitle,
  Select,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { activePatients, isoDaysFromNow, mexicoCityDay } from "@/lib/clinic";
import { createClient } from "@/lib/supabase/server";
import type { Appointment } from "@/lib/types";
import { scheduleAppointment, updateAppointment } from "../actions";

export const metadata = { title: "Agenda" };

function dayLabel(day: string) {
  const today = mexicoCityDay(new Date().toISOString());
  const tomorrow = mexicoCityDay(new Date(Date.now() + 24 * 3600 * 1000).toISOString());
  if (day === today) return "Hoy";
  if (day === tomorrow) return "Mañana";
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}

export default async function AgendaPage({ searchParams }: PageProps<"/vet/agenda">) {
  const session = await requireRole(["vet", "student"]);
  const query = await searchParams;
  const preselected = typeof query.mascota === "string" ? query.mascota : "";
  const supabase = await createClient();
  const patients = session.isVerifiedClinician ? await activePatients(session) : [];

  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("clinician_id", session.userId)
    .gte("scheduled_at", isoDaysFromNow(-7))
    .order("scheduled_at")
    .limit(100);
  const appointments = (data ?? []) as Appointment[];
  const now = new Date();
  const upcoming = appointments.filter((a) => a.status === "programada" && new Date(a.scheduled_at) > new Date(now.getTime() - 2 * 3600 * 1000));
  const past = appointments.filter((a) => !upcoming.includes(a)).reverse();

  const byDay = new Map<string, Appointment[]>();
  upcoming.forEach((a) => {
    const d = mexicoCityDay(a.scheduled_at);
    byDay.set(d, [...(byDay.get(d) ?? []), a]);
  });

  const minLocal = new Date(now.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 16);

  return (
    <>
      <BackLink href="/vet">Panel clínico</BackLink>
      <PageTitle eyebrow="Portal de clínica" title="Agenda" subtitle="Citas con tus pacientes y su expediente listo para la consulta." />
      <FlashMessages error={query.error} ok={query.ok} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card className="h-fit">
          <CardTitle
            icon={CalendarPlus}
            title="Agendar cita"
            tone="accent"
            subtitle="El propietario recibe un aviso y tu acceso al expediente se extiende hasta el día siguiente de la cita."
          />
          {patients.length === 0 ? (
            <p className="text-sm text-muted">
              Necesitas acceso vigente a un paciente.{" "}
              <Link href="/escanear" className="underline">
                Escanea su placa
              </Link>{" "}
              para empezar.
            </p>
          ) : (
            <form action={scheduleAppointment} className="flex flex-col gap-4">
              <Field label="Paciente">
                <Select name="pet" required defaultValue={preselected}>
                  <option value="" disabled>
                    Elige…
                  </option>
                  {patients.map((p) => (
                    <option key={p.pet_id} value={p.pet_id}>
                      {p.pets?.name} ({p.pets?.species === "gato" ? "gato" : "perro"})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Fecha y hora" hint="Hora del centro de México.">
                <Input name="at" type="datetime-local" required min={minLocal} />
              </Field>
              <Field label="Motivo">
                <Input name="reason" required maxLength={200} placeholder="Refuerzo de vacuna, revisión de piel…" />
              </Field>
              <Button size="lg">
                <CalendarPlus aria-hidden /> Agendar
              </Button>
            </form>
          )}
        </Card>

        <section className="flex flex-col gap-5">
          {byDay.size === 0 ? (
            <EmptyState icon={CalendarDays} title="Sin citas próximas" text="Las citas que agendes aparecerán aquí, agrupadas por día." />
          ) : (
            [...byDay.entries()].map(([day, items]) => (
              <div key={day}>
                <h2 className="mb-2 text-sm font-semibold tracking-wider text-muted uppercase first-letter:uppercase">{dayLabel(day)}</h2>
                <ul className="flex flex-col gap-3">
                  {items.map((a) => (
                    <li key={a.id}>
                      <Card className="flex flex-wrap items-center gap-4 p-4 sm:p-4">
                        <div className="w-16 shrink-0 text-center">
                          <p className="font-display text-xl font-semibold">{timeLabel(a.scheduled_at)}</p>
                        </div>
                        <div className="min-w-0 flex-1 border-l border-border pl-4">
                          <Link href={`/mascotas/${a.pet_id}`} className="font-semibold hover:underline">
                            {a.pet_name}
                          </Link>
                          <p className="text-sm text-muted">{a.reason}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <ButtonLink
                            href={`/mascotas/${a.pet_id}/resumen`}
                            variant="secondary"
                            className="min-h-9 px-3 text-xs"
                            prefetch={false}
                          >
                            <Printer aria-hidden /> Preparar
                          </ButtonLink>
                          <form action={updateAppointment.bind(null, a.id, "completada")}>
                            <Button variant="secondary" className="min-h-9 px-3 text-xs" aria-label="Marcar como completada">
                              <Check aria-hidden />
                            </Button>
                          </form>
                          <form action={updateAppointment.bind(null, a.id, "cancelada")}>
                            <Button
                              variant="ghost"
                              className="min-h-9 px-3 text-xs text-danger"
                              aria-label="Cancelar cita"
                              confirm={`¿Cancelar la cita de ${a.pet_name}? Le enviaremos un aviso al propietario.`}
                            >
                              <X aria-hidden />
                            </Button>
                          </form>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}

          {past.length > 0 && (
            <details className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <summary className="cursor-pointer font-medium text-muted">Últimos 7 días ({past.length})</summary>
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {past.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {a.pet_name} · {a.reason}
                    </span>
                    <Badge tone={a.status === "completada" ? "brand" : a.status === "cancelada" ? "danger" : "neutral"}>
                      {a.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </>
  );
}
