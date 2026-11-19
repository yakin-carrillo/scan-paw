import Link from "next/link";
import {
  BadgeCheck,
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
  FlashMessages,
  formatDate,
  formatDateTime,
  Input,
  PageTitle,
  PetAvatar,
  speciesLabel,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { activePatients, isoDaysFromNow } from "@/lib/clinic";
import { createClient } from "@/lib/supabase/server";
import { latestVersions, type Appointment, type Vaccination } from "@/lib/types";
import { redeemCode } from "./actions";

export const metadata = { title: "Panel clínico" };

export default async function VetPage({ searchParams }: PageProps<"/vet">) {
  const session = await requireRole(["vet", "student"]);
  const query = await searchParams;
  const { vet, student } = session;
  const isStudent = session.profile.role === "student";
  const credential = isStudent
    ? `${student?.university ?? ""} · Matrícula ${student?.enrollment_id ?? ""}`
    : `Cédula ${vet?.cedula ?? ""}${vet?.clinic_name ? ` · ${vet.clinic_name}` : ""}`;

  if (!session.isVerifiedClinician) {
    const status = isStudent ? student?.status : vet?.status;
    const note = isStudent ? student?.review_note : vet?.review_note;
    return (
      <div className="mx-auto max-w-xl">
        <PageTitle eyebrow="Panel clínico" title={`Hola, ${session.profile.full_name.split(" ")[0]}`} subtitle={credential} />
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
                ? "Revisamos tu matrícula con la universidad. Te avisaremos por correo cuando se apruebe."
                : "Revisamos tu cédula profesional en el Registro Nacional de Profesionistas. Te avisaremos por correo cuando se apruebe."
            }
          />
        )}
      </div>
    );
  }

  const supabase = await createClient();
  const patients = await activePatients(session);
  const petIds = patients.map((p) => p.pet_id);
  const now = new Date();
  const in30 = isoDaysFromNow(30).slice(0, 10);

  const [{ data: appts }, { data: vax }, photos] = await Promise.all([
    supabase
      .from("appointments")
      .select("*")
      .eq("clinician_id", session.userId)
      .eq("status", "programada")
      .gte("scheduled_at", new Date(now.getTime() - 2 * 3600 * 1000).toISOString())
      .order("scheduled_at")
      .limit(5),
    // Se leen todas las vacunas para descartar las que una enmienda ya corrigió.
    petIds.length ? supabase.from("vaccinations").select("*").in("pet_id", petIds) : Promise.resolve({ data: [] }),
    (async () => {
      const paths = patients.map((p) => p.pets?.photo_path).filter((p): p is string => Boolean(p));
      if (!paths.length) return new Map<string, string>();
      const { data } = await supabase.storage.from("pet-photos").createSignedUrls(paths, 3600);
      return new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path ?? "", d.signedUrl]));
    })(),
  ]);
  const appointments = (appts ?? []) as Appointment[];
  const names = new Map(patients.map((p) => [p.pet_id, p.pets?.name ?? ""]));
  const dueVaccines = latestVersions((vax ?? []) as Vaccination[])
    .filter((v) => v.next_due && v.next_due <= in30)
    .sort((a, b) => (a.next_due ?? "").localeCompare(b.next_due ?? ""));
  const today = now.toISOString().slice(0, 10);

  return (
    <>
      <PageTitle
        eyebrow="Panel clínico"
        title={`Hola, ${session.profile.full_name.split(" ")[0]}`}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/escanear" className="group">
          <div className="paw-pattern flex h-full items-center gap-4 rounded-2xl bg-deep p-5 text-on-deep shadow-card transition group-hover:shadow-lift sm:p-6">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
              <ScanLine aria-hidden className="size-6" />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Escanear placa</h2>
              <p className="text-sm opacity-85">Abre el expediente del paciente con la cámara.</p>
            </div>
            <ChevronRight aria-hidden className="size-5 opacity-80" />
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
            <Button>Abrir</Button>
          </form>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Stethoscope aria-hidden className="size-5 text-brand" /> Pacientes con acceso vigente
          </h2>
          {patients.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title="Sin pacientes por ahora"
              text="Escanea la placa de un paciente o usa el código del propietario para abrir su expediente."
            />
          ) : (
            <ul className="grid gap-3">
              {patients.map((p) => (
                <li key={p.pet_id}>
                  <Link href={`/mascotas/${p.pet_id}`} className="group block">
                    <Card className="flex items-center gap-4 p-4 transition group-hover:shadow-lift sm:p-4">
                      <PetAvatar
                        species={p.pets?.species ?? null}
                        name={p.pets?.name ?? ""}
                        photoUrl={p.pets?.photo_path ? photos.get(p.pets.photo_path) : null}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{p.pets?.name}</h3>
                        <p className="truncate text-sm text-muted">
                          {speciesLabel(p.pets?.species)}
                          {p.pets?.breed ? ` · ${p.pets.breed}` : ""}
                        </p>
                      </div>
                      <span className="hidden text-right text-xs text-muted sm:block">
                        Acceso hasta
                        <br />
                        <span className="font-medium text-foreground">{formatDate(p.expires_at)}</span>
                      </span>
                      <ChevronRight aria-hidden className="size-5 text-muted" />
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarDays aria-hidden className="size-5 text-accent" /> Próximas citas
              </h2>
              <Link href="/vet/agenda" className="text-sm text-brand underline">
                Agenda
              </Link>
            </div>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted">No tienes citas programadas.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
                    <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                    <div>
                      <p className="font-medium">
                        {a.pet_name} · {formatDateTime(a.scheduled_at)}
                      </p>
                      <p className="text-muted">{a.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <ButtonLink href="/vet/agenda" variant="secondary" className="mt-3 w-full">
              Agendar cita
            </ButtonLink>
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
        </div>
      </div>
    </>
  );
}
