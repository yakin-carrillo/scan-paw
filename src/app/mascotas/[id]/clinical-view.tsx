import Link from "next/link";
import {
  CalendarPlus,
  ClipboardList,
  ClipboardPlus,
  Clock,
  FileText,
  GraduationCap,
  HeartPulse,
  Phone,
  Pill,
  PawPrint,
  Printer,
  Scale,
  ShieldAlert,
  Siren,
  Stethoscope,
  Syringe,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Alert,
  BackLink,
  Badge,
  ButtonLink,
  Card,
  CardTitle,
  cx,
  FlashMessages,
  formatDate,
  formatDateTime,
  PetAvatar,
  speciesLabel,
} from "@/components/ui";
import { petAge, vaccineStatus, type PetRecord } from "@/lib/pets";
import { AppointmentsCard, ConsultationsSection, currentTreatment, latestWeight, Timeline, WeightChart } from "./record-parts";
import { AttachmentsTab, ConditionsTab, VaccinesTab } from "./sections";

const TABS = [
  { id: "identificacion", label: "Resumen", icon: ClipboardList },
  { id: "consultas", label: "Consultas", icon: Stethoscope },
  { id: "vacunas", label: "Vacunas", icon: Syringe },
  { id: "condiciones", label: "Alergias y crónicos", icon: HeartPulse },
  { id: "anexos", label: "Anexos", icon: FileText },
] as const;

export type ClinicalTab = (typeof TABS)[number]["id"];

export function clinicalTab(value: unknown): ClinicalTab {
  return TABS.find((t) => t.id === value)?.id ?? "identificacion";
}

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 3600 * 1000)));
}

/**
 * Ficha clínica: lo que el MVZ necesita en 30 segundos para atender con
 * seguridad (alertas, identificación, peso, contacto) y dónde registrar.
 */
export function ClinicalRecord({
  record,
  tab,
  query,
  ownerPreview,
}: {
  record: PetRecord;
  tab: ClinicalTab;
  query: Record<string, string | string[] | undefined>;
  /** El dueño (que también es clínico) viendo su propia mascota como ficha. */
  ownerPreview: boolean;
}) {
  const { pet } = record;
  const age = petAge(pet.birth_date);
  const weight = latestWeight(record);
  const allergies = record.conditions.filter((c) => c.kind === "alergia" && c.active);
  const chronic = record.conditions.filter((c) => c.kind === "cronica" && c.active);
  const treatment = currentTreatment(record);
  const owner = record.owners.find((o) => o.role === "principal") ?? record.owners[0];
  const onlyVerified = query.fuente === "clinica";
  const base = `/mascotas/${pet.id}${ownerPreview ? "?vista=ficha&" : "?"}`;

  const facts = [
    speciesLabel(pet.species),
    pet.breed,
    pet.sex ? (pet.sex === "macho" ? "Macho" : "Hembra") : null,
    age,
    pet.sterilized == null ? null : pet.sterilized ? "Esterilizado" : "No esterilizado",
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={ownerPreview ? `/mascotas/${pet.id}` : "/vet/pacientes"}>
        {ownerPreview ? "Volver a la cartilla" : "Mis pacientes"}
      </BackLink>

      {record.viewerIsStudent && !ownerPreview && (
        <Alert tone="warning" title="Cuenta de estudiante · No profesionista">
          Lo que registres quedará marcado como No profesionista.
        </Alert>
      )}
      {ownerPreview && (
        <Alert tone="info">
          Vista clínica de tu propia mascota. Lo que registres aquí queda como propietario, no como MVZ.
        </Alert>
      )}

      {/* Franja de alertas: siempre visible, en cualquier pestaña. */}
      <section
        aria-label="Alertas clínicas"
        className={cx(
          "rounded-2xl border p-4",
          allergies.length || chronic.length || pet.lost_mode
            ? "border-danger/30 bg-danger-soft"
            : "border-border bg-surface-2",
        )}
      >
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <ShieldAlert aria-hidden className={cx("size-5", allergies.length ? "text-danger" : "text-muted")} />
          {allergies.length === 0 && chronic.length === 0 && !pet.lost_mode && (
            <span className="text-muted">Sin alergias ni padecimientos crónicos registrados.</span>
          )}
          {pet.lost_mode && (
            <Badge tone="danger">
              <Siren aria-hidden /> Reportado como extraviado
            </Badge>
          )}
          {allergies.map((a) => (
            <Badge key={a.id} tone="danger" className="text-[13px]">
              Alergia: {a.description}
              {a.severity ? ` (${a.severity})` : ""}
            </Badge>
          ))}
          {chronic.map((c) => (
            <Badge key={c.id} tone="warning" className="text-[13px]">
              {c.description}
            </Badge>
          ))}
        </div>
        {treatment?.treatment && (
          <p className="mt-2 flex gap-2 text-sm">
            <Pill aria-hidden className="mt-0.5 size-4 shrink-0 text-verified" />
            <span>
              <span className="font-semibold">Tratamiento en curso ({formatDate(treatment.visit_date)}):</span>{" "}
              {treatment.treatment}
            </span>
          </p>
        )}
      </section>

      <Card className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <PetAvatar species={pet.species} name={pet.name} photoUrl={record.photoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold sm:text-3xl">{pet.name}</h1>
              {pet.status !== "activo" && <Badge>En memoria</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted">{facts.join(" · ")}</p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted">Último peso</dt>
                <dd className="flex items-center gap-1.5 font-semibold">
                  {weight ? (
                    <>
                      {weight.last.weight_kg.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg
                      {weight.delta != null && weight.delta !== 0 && (
                        <span
                          className={cx(
                            "inline-flex items-center gap-0.5 text-xs font-medium",
                            weight.delta < 0 ? "text-warning" : "text-muted",
                          )}
                        >
                          {weight.delta < 0 ? (
                            <TrendingDown aria-hidden className="size-3.5" />
                          ) : (
                            <TrendingUp aria-hidden className="size-3.5" />
                          )}
                          {weight.delta > 0 ? "+" : ""}
                          {weight.delta.toLocaleString("es-MX", { maximumFractionDigits: 2 })}
                        </span>
                      )}
                      <span className="text-xs font-normal text-muted">{formatDate(weight.last.measured_on)}</span>
                    </>
                  ) : (
                    "Sin registro"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Microchip</dt>
                <dd className="font-mono text-[13px] font-semibold">{pet.microchip ?? "—"}</dd>
              </div>
              {!ownerPreview && record.myAccessExpires && (
                <div>
                  <dt className="text-xs text-muted">Tu acceso</dt>
                  <dd className="flex items-center gap-1.5 font-semibold">
                    <Clock aria-hidden className="size-3.5 text-muted" />
                    {daysLeft(record.myAccessExpires) <= 1
                      ? "Vence hoy"
                      : `Vence en ${daysLeft(record.myAccessExpires)} días`}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        {!ownerPreview && owner?.profiles && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <span className="min-w-0">
              <span className="text-xs text-muted">Propietario</span>
              <span className="block font-medium">{owner.profiles.full_name}</span>
            </span>
            {owner.profiles.phone && (
              <ButtonLink href={`tel:${owner.profiles.phone}`} variant="secondary" className="min-h-10">
                <Phone aria-hidden /> {owner.profiles.phone}
              </ButtonLink>
            )}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          {record.clinicalAccess && (
            <ButtonLink href={`${base}tab=consultas`}>
              <ClipboardPlus aria-hidden /> Registrar consulta
            </ButtonLink>
          )}
          {record.clinicalAccess && (
            <ButtonLink href={`/vet/agenda?mascota=${pet.id}`} variant="secondary">
              <CalendarPlus aria-hidden /> Agendar cita
            </ButtonLink>
          )}
          <ButtonLink href={`/mascotas/${pet.id}/resumen`} variant="ghost" prefetch={false}>
            <Printer aria-hidden /> Resumen clínico
          </ButtonLink>
          {ownerPreview && (
            <ButtonLink href={`/mascotas/${pet.id}`} variant="ghost">
              <PawPrint aria-hidden /> Ver como cartilla
            </ButtonLink>
          )}
        </div>
      </Card>

      <FlashMessages error={query.error} ok={query.ok} />

      <nav
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 text-sm [scrollbar-width:none] print:hidden"
        aria-label="Secciones de la ficha clínica"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`${base}tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={cx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 whitespace-nowrap transition",
                active
                  ? "bg-verified font-medium text-background"
                  : "border border-border bg-surface text-muted hover:text-foreground",
              )}
            >
              <t.icon aria-hidden className="size-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab === "identificacion" && <ClinicalSummary record={record} onlyVerified={onlyVerified} />}
      {tab === "consultas" && <ConsultationsSection record={record} variant="clinical" />}
      {tab === "vacunas" && <VaccinesTab record={record} variant="clinical" />}
      {tab === "condiciones" && <ConditionsTab record={record} variant="clinical" />}
      {tab === "anexos" && <AttachmentsTab record={record} />}
    </div>
  );
}

function ClinicalSummary({ record, onlyVerified }: { record: PetRecord; onlyVerified: boolean }) {
  const due = record.vaccinations
    .filter((v) => v.next_due && vaccineStatus(v.next_due) !== "ok")
    .sort((a, b) => (a.next_due ?? "").localeCompare(b.next_due ?? ""));
  const last = record.consultations[0];
  return (
    <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <div className="flex min-w-0 flex-col gap-5">
        {last && (
          <Card>
            <CardTitle
              icon={Stethoscope}
              title="Última consulta"
              subtitle={`${formatDate(last.visit_date)} · ${last.author_name ?? ""}${last.clinic_name ? ` · ${last.clinic_name}` : ""}`}
            />
            <p className="font-medium">{last.reason}</p>
            {last.diagnosis && <p className="mt-1 text-sm">Diagnóstico: {last.diagnosis}</p>}
            {last.treatment && <p className="mt-1 text-sm text-muted">Tratamiento: {last.treatment}</p>}
          </Card>
        )}
        <Timeline record={record} onlyVerified={onlyVerified} />
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <AppointmentsCard record={record} />
        <Card>
          <CardTitle icon={Syringe} title="Vacunas pendientes" tone="accent" />
          {due.length === 0 ? (
            <p className="text-sm text-muted">Ninguna vencida ni por vencer en 30 días.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border text-sm">
              {due.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">{v.vaccine}</span>
                  <Badge tone={vaccineStatus(v.next_due) === "overdue" ? "danger" : "warning"}>
                    {formatDate(v.next_due)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle icon={Scale} title="Evolución del peso" />
          <WeightChart record={record} />
        </Card>
        {record.appointments.some((a) => a.status === "completada") && (
          <p className="text-xs text-muted">
            Última cita completada:{" "}
            {formatDateTime(
              record.appointments.filter((a) => a.status === "completada").slice(-1)[0].scheduled_at,
            )}
          </p>
        )}
        {record.viewerIsStudent && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <GraduationCap aria-hidden className="size-3.5" /> Tus registros quedan marcados como de estudiante.
          </p>
        )}
      </div>
    </div>
  );
}
