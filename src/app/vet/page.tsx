import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock,
  GraduationCap,
  KeyRound,
  ScanLine,
  Stethoscope,
  Syringe,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardTitle,
  EmptyState,
  Field,
  FlashMessages,
  formatDate,
  Input,
  PageTitle,
} from "@/components/ui";
import { PushBanner } from "@/components/push-toggle";
import { requireRole } from "@/lib/auth";
import { activePatients, isoDaysFromNow, mexicoCityDay } from "@/lib/clinic";
import { createClient } from "@/lib/supabase/server";
import { latestVersions, type Appointment, type Vaccination } from "@/lib/types";
import { joinClinic, redeemCode } from "./actions";

export const metadata = { title: "Hoy" };

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" });
}

function longDate() {
  return new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Mexico_City",
  });
}

/** Espacio clínico, pantalla "Hoy": la jornada del MVZ o estudiante. */
export default async function VetTodayPage({ searchParams }: PageProps<"/vet">) {
  const session = await requireRole(["vet", "student"]);
  const query = await searchParams;
  const { vet, student, clinic } = session;
  const isStudent = session.profile.role === "student";
  const firstName = session.profile.full_name.split(" ")[0];
  const credential = isStudent
    ? `${student?.university ?? ""} · Matrícula ${student?.enrollment_id ?? ""}`
    : `Cédula ${vet?.cedula ?? ""}`;

  const clinicCard = clinic ? (
    <Card className="flex items-center gap-3 p-4 sm:p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Building2 aria-hidden className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{clinic.name}</p>
        <p className="text-muted">
          {clinic.memberStatus === "pendiente"
            ? "Tu solicitud está pendiente: la clínica debe validarte."
            : clinic.isAdmin
              ? "Eres administrador de esta clínica."
              : "Las citas que agendes quedan en la agenda de la clínica."}
        </p>
      </div>
      {clinic.isAdmin && (
        <ButtonLink href="/clinica" variant="secondary" className="shrink-0">
          Ir a la clínica
        </ButtonLink>
      )}
    </Card>
  ) : (
    <Card>
      <CardTitle
        icon={Building2}
        title="¿Trabajas en una clínica?"
        subtitle="Pide a su administrador un código de invitación de 8 caracteres."
      />
      <form action={joinClinic} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Código de la clínica">
            <Input
              name="code"
              required
              maxLength={8}
              placeholder="ABCD2345"
              className="font-mono tracking-widest uppercase"
              autoComplete="off"
              autoCapitalize="characters"
            />
          </Field>
        </div>
        <Button variant="secondary">Unirme</Button>
      </form>
    </Card>
  );

  if (!session.isVerifiedClinician) {
    const status = isStudent ? student?.status : vet?.status;
    const note = isStudent ? student?.review_note : vet?.review_note;
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <PageTitle eyebrow="Espacio clínico" title={`Hola, ${firstName}`} subtitle={credential} />
        <PushBanner text="Activa los avisos para saber en cuanto verifiquemos tu cuenta." />
        {status === "rejected" ? (
          <Alert tone="error" title="No pudimos verificar tu cuenta">
            {note ? `Motivo: ${note}. ` : ""}Escríbenos para revisarlo.
          </Alert>
        ) : (
          <EmptyState
            icon={isStudent ? GraduationCap : Stethoscope}
            title="Estamos verificando tu cuenta"
            text={
              isStudent
                ? "Revisamos tu matrícula con la universidad. Si tu clínica usa Scan-Paw, también puede validarte con su código."
                : "Revisamos tu cédula en el Registro Nacional de Profesionistas. Si tu clínica usa Scan-Paw, también puede validarte con su código."
            }
          />
        )}
        {clinicCard}
        <p className="text-center text-sm text-muted">
          Mientras tanto puedes registrar a tus propias mascotas en{" "}
          <Link href="/mascotas" className="underline">
            el espacio de propietario
          </Link>
          .
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const patients = await activePatients(session);
  const petIds = patients.map((p) => p.pet_id);
  const today = mexicoCityDay(new Date().toISOString());
  const in30 = isoDaysFromNow(30).slice(0, 10);

  const [{ data: appts }, { data: vax }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .eq("clinician_id", session.userId)
      .eq("status", "programada")
      .gte("scheduled_at", isoDaysFromNow(-0.5))
      .lte("scheduled_at", isoDaysFromNow(7))
      .order("scheduled_at")
      .limit(30),
    // Se leen todas las vacunas para descartar las que una enmienda ya corrigió.
    petIds.length ? supabase.from("vaccinations").select("*").in("pet_id", petIds) : Promise.resolve({ data: [] }),
  ]);
  const appointments = (appts ?? []) as Appointment[];
  const todays = appointments.filter((a) => mexicoCityDay(a.scheduled_at) === today);
  const next = appointments.filter((a) => mexicoCityDay(a.scheduled_at) > today).slice(0, 4);
  const names = new Map(patients.map((p) => [p.pet_id, p.pets?.name ?? ""]));
  const dueVaccines = latestVersions((vax ?? []) as Vaccination[])
    .filter((v) => v.next_due && v.next_due <= in30)
    .sort((a, b) => (a.next_due ?? "").localeCompare(b.next_due ?? ""));
  const in2 = isoDaysFromNow(2);
  const ending = patients.filter((p) => p.expires_at < in2);

  return (
    <>
      <PageTitle
        eyebrow={longDate()}
        title={`Hola, ${firstName}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {isStudent ? (
              <Badge tone="warning">
                <GraduationCap aria-hidden /> Estudiante · No profesionista
              </Badge>
            ) : (
              <Badge tone="verified">
                <BadgeCheck aria-hidden /> MVZ verificado
              </Badge>
            )}
            {credential}
          </span>
        }
      />
      <FlashMessages error={query.error} ok={query.ok} />
      <PushBanner text="Activa los avisos para recibir recordatorios de tus citas." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/escanear" className="group">
          <div className="paw-pattern flex h-full items-center gap-4 rounded-2xl bg-deep p-5 text-on-deep shadow-card transition group-hover:shadow-lift sm:p-6">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
              <ScanLine aria-hidden className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">Escanear placa</h2>
              <p className="text-sm opacity-85">Abre el expediente del paciente con la cámara.</p>
            </div>
            <ChevronRight aria-hidden className="size-5 shrink-0 opacity-80" />
          </div>
        </Link>
        <Card>
          <CardTitle icon={KeyRound} title="Código del propietario" subtitle="Si no trae la placa, pídele su código de 6 caracteres." />
          <form action={redeemCode} className="flex gap-2">
            <Input
              name="code"
              required
              maxLength={6}
              placeholder="ABC123"
              aria-label="Código de 6 caracteres"
              className="font-mono tracking-widest uppercase"
              autoComplete="off"
              autoCapitalize="characters"
            />
            <Button className="shrink-0">Abrir</Button>
          </form>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays aria-hidden className="size-5 text-verified" /> Citas de hoy
            </h2>
            <Link href="/vet/agenda" className="text-sm text-brand underline">
              Agenda
            </Link>
          </div>
          {todays.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Sin citas hoy"
              text={next.length ? "Abajo están tus próximas citas." : "Agenda desde el expediente de un paciente."}
            />
          ) : (
            <ol className="flex flex-col gap-3">
              {todays.map((a) => (
                <li key={a.id}>
                  <Link href={`/mascotas/${a.pet_id}`} className="group block">
                    <Card className="flex items-center gap-4 p-4 transition group-hover:shadow-lift sm:p-4">
                      <p className="w-14 shrink-0 text-center font-display text-xl font-semibold">{timeLabel(a.scheduled_at)}</p>
                      <div className="min-w-0 flex-1 border-l border-border pl-4">
                        <p className="font-semibold">{a.pet_name}</p>
                        <p className="text-sm text-muted">{a.reason}</p>
                      </div>
                      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                    </Card>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          {next.length > 0 && (
            <>
              <h3 className="mt-6 mb-2 text-sm font-semibold tracking-wider text-muted uppercase">Próximos días</h3>
              <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface px-4">
                {next.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
                    <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <span className="min-w-0">
                      <span className="font-medium">{a.pet_name}</span> · {formatDate(a.scheduled_at)}, {timeLabel(a.scheduled_at)}
                      <span className="block text-muted">{a.reason}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Stethoscope aria-hidden className="size-5 text-brand" /> Pacientes
              </h2>
              <Link href="/vet/pacientes" className="text-sm text-brand underline">
                Ver todos ({patients.length})
              </Link>
            </div>
            {ending.length === 0 ? (
              <p className="text-sm text-muted">
                {patients.length ? "Ningún acceso vence en los próximos 2 días." : "Sin pacientes con acceso vigente."}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {ending.map((p) => (
                  <li key={p.pet_id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={`/mascotas/${p.pet_id}`} className="min-w-0 font-medium hover:underline">
                      {p.pets?.name}
                    </Link>
                    <Badge tone="warning">Acceso hasta {formatDate(p.expires_at)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Syringe aria-hidden className="size-5 text-warning" /> Vacunas por vencer
            </h2>
            {dueVaccines.length === 0 ? (
              <p className="text-sm text-muted">Ningún paciente tiene vacunas por vencer en 30 días.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border text-sm">
                {dueVaccines.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 py-2.5">
                    <Link href={`/mascotas/${v.pet_id}?tab=vacunas`} className="min-w-0">
                      <span className="font-medium">{names.get(v.pet_id)}</span>
                      <span className="text-muted"> · {v.vaccine}</span>
                    </Link>
                    <Badge tone={(v.next_due ?? "") < today ? "danger" : "warning"}>{formatDate(v.next_due)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {clinicCard}
        </div>
      </div>
    </>
  );
}
