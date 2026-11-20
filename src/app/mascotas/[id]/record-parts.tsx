import Link from "next/link";
import {
  CalendarDays,
  ClipboardPlus,
  FileText,
  HeartPulse,
  Pill,
  Scale,
  Stethoscope,
  Syringe,
  Thermometer,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { EntryAuthor } from "@/components/record-entries";
import { Badge, Button, Card, CardTitle, cx, EmptyState, Field, formatDate, formatDateTime, Input, Textarea } from "@/components/ui";
import { isoDaysFromNow } from "@/lib/clinic";
import type { PetRecord } from "@/lib/pets";
import type { Consultation, RecordSource } from "@/lib/types";
import { addConsultation, addWeight, setAppointmentStatus } from "../actions";
import { AddPanel } from "./sections";

/* Piezas nuevas del expediente: consultas, peso, citas, alertas y línea de tiempo. */

const todayMx = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

const kg = (n: number | string | null | undefined) =>
  n == null ? null : `${Number(n).toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg`;

/** Tratamiento en curso: la consulta más reciente de los últimos 30 días con tratamiento o indicaciones. */
export function currentTreatment(record: PetRecord): Consultation | null {
  const limit = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return (
    record.consultations.find((c) => c.visit_date >= limit && (c.treatment || c.owner_instructions)) ?? null
  );
}

export function latestWeight(record: PetRecord) {
  const w = record.weights;
  if (!w.length) return null;
  const last = w[w.length - 1];
  const prev = w.length > 1 ? w[w.length - 2] : null;
  return { last, delta: prev ? last.weight_kg - prev.weight_kg : null };
}

// ------------------------------- Peso -------------------------------

/** Gráfica sencilla del peso en el tiempo (SVG, sin dependencias). */
export function WeightChart({ record, height = 120 }: { record: PetRecord; height?: number }) {
  const points = record.weights;
  if (points.length < 2) {
    return (
      <p className="text-sm text-muted">
        {points.length === 1
          ? `Un registro: ${kg(points[0].weight_kg)} el ${formatDate(points[0].measured_on)}.`
          : "Aún no hay registros de peso."}
      </p>
    );
  }
  const W = 320;
  const H = height;
  const pad = { x: 8, top: 14, bottom: 18 };
  const times = points.map((p) => new Date(`${p.measured_on}T12:00:00Z`).getTime());
  const values = points.map((p) => p.weight_kg);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const span = vMax - vMin || 1;
  const x = (t: number) => pad.x + ((t - tMin) / (tMax - tMin || 1)) * (W - pad.x * 2);
  const y = (v: number) => pad.top + (1 - (v - vMin) / span) * (H - pad.top - pad.bottom);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(times[i]).toFixed(1)} ${y(p.weight_kg).toFixed(1)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Peso de ${kg(first.weight_kg)} el ${formatDate(first.measured_on)} a ${kg(last.weight_kg)} el ${formatDate(last.measured_on)}`}
        className="h-auto w-full overflow-visible"
      >
        <path d={path} fill="none" stroke="var(--brand)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={p.id}
            cx={x(times[i])}
            cy={y(p.weight_kg)}
            r={3.6}
            fill={p.source === "propietario" ? "var(--surface)" : "var(--brand)"}
            stroke="var(--brand)"
            strokeWidth={1.8}
          >
            <title>{`${kg(p.weight_kg)} · ${formatDate(p.measured_on)}${p.source === "propietario" ? " · registrado por el propietario" : ""}`}</title>
          </circle>
        ))}
        <text x={pad.x} y={H - 3} fontSize={10} fill="var(--muted)">
          {formatDate(first.measured_on)}
        </text>
        <text x={W - pad.x} y={H - 3} fontSize={10} fill="var(--muted)" textAnchor="end">
          {formatDate(last.measured_on)}
        </text>
        <text x={x(times[times.length - 1])} y={y(last.weight_kg) - 7} fontSize={11} fontWeight={600} fill="var(--foreground)" textAnchor="end">
          {kg(last.weight_kg)}
        </text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-brand" /> Registrado por clínico
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full border-2 border-brand" /> Registrado por el propietario
        </span>
      </figcaption>
    </figure>
  );
}

export function WeightForm({ petId, tab }: { petId: string; tab: string }) {
  return (
    <form action={addWeight.bind(null, petId)} className="mt-4 flex flex-wrap items-end gap-2">
      <input type="hidden" name="tab" value={tab} />
      <div className="w-28">
        <Field label="Peso (kg)">
          <Input name="weight_kg" inputMode="decimal" required placeholder="12.5" />
        </Field>
      </div>
      <div className="w-40">
        <Field label="Fecha">
          <Input name="measured_on" type="date" required defaultValue={todayMx()} max={todayMx()} />
        </Field>
      </div>
      <Button variant="secondary">Registrar peso</Button>
    </form>
  );
}

// ----------------------------- Consultas -----------------------------

function ConsultationFields({ c }: { c?: Consultation }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Fecha de la consulta">
        <Input name="visit_date" type="date" required defaultValue={c?.visit_date ?? todayMx()} max={todayMx()} />
      </Field>
      <Field label="Motivo">
        <Input name="reason" required maxLength={200} defaultValue={c?.reason} placeholder="Vacunación, revisión, vómito…" />
      </Field>
      <Field label="Peso (kg, opcional)">
        <Input name="weight_kg" inputMode="decimal" defaultValue={c?.weight_kg ?? ""} placeholder="12.5" />
      </Field>
      <Field label="Temperatura (°C, opcional)">
        <Input name="temperature_c" inputMode="decimal" defaultValue={c?.temperature_c ?? ""} placeholder="38.5" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Hallazgos del examen físico">
          <Textarea name="findings" maxLength={2000} defaultValue={c?.findings ?? ""} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Diagnóstico">
          <Input name="diagnosis" maxLength={500} defaultValue={c?.diagnosis ?? ""} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Tratamiento (para el expediente)" hint="Fármaco, dosis, vía, frecuencia y duración.">
          <Textarea name="treatment" maxLength={1000} defaultValue={c?.treatment ?? ""} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field
          label="Indicaciones para el propietario"
          hint="En lenguaje claro: qué darle, cuánto, hasta cuándo y cuándo regresar. Es lo primero que verá la familia."
        >
          <Textarea name="owner_instructions" maxLength={1000} defaultValue={c?.owner_instructions ?? ""} />
        </Field>
      </div>
    </div>
  );
}

function Vital({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-xs">
      <Icon aria-hidden className="size-3.5 text-muted" />
      <span className="text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

/**
 * Lista de consultas. En la cartilla del propietario las indicaciones van
 * primero y la nota clínica completa se despliega; en la ficha clínica se
 * muestra la nota completa.
 */
export function ConsultationsSection({ record, variant }: { record: PetRecord; variant: "owner" | "clinical" }) {
  const action = addConsultation.bind(null, record.pet.id);
  const items = record.consultations;
  const canAdd = record.clinicalAccess;
  return (
    <>
      {canAdd && (
        <AddPanel icon={ClipboardPlus} title="Registrar consulta" open={items.length === 0 || variant === "clinical"}>
          <form action={action} className="flex flex-col gap-3">
            <ConsultationFields />
            <Button className="self-start">Guardar consulta</Button>
          </form>
        </AddPanel>
      )}
      {items.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="Sin consultas registradas"
          text={
            variant === "owner"
              ? "Cuando un MVZ registre una consulta, aquí verás sus indicaciones para casa."
              : "Registra la primera consulta de este paciente."
          }
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((c) => {
            const clinical = (
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {c.findings && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Hallazgos</dt>
                    <dd className="mt-0.5 whitespace-pre-line">{c.findings}</dd>
                  </div>
                )}
                {c.diagnosis && (
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Diagnóstico</dt>
                    <dd className="mt-0.5">{c.diagnosis}</dd>
                  </div>
                )}
                {c.treatment && (
                  <div>
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">Tratamiento</dt>
                    <dd className="mt-0.5 whitespace-pre-line">{c.treatment}</dd>
                  </div>
                )}
              </dl>
            );
            const instructions = c.owner_instructions && (
              <div className="rounded-xl border border-verified/25 bg-verified-soft/60 p-3 text-sm">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-verified">
                  <Pill aria-hidden className="size-3.5" /> Indicaciones para casa
                </p>
                <p className="whitespace-pre-line">{c.owner_instructions}</p>
              </div>
            );
            return (
              <li key={c.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted">
                        {formatDate(c.visit_date)}
                        {c.clinic_name ? ` · ${c.clinic_name}` : ""}
                      </p>
                      <h3 className="text-lg font-semibold">{c.reason}</h3>
                      {variant === "owner" && c.diagnosis && <p className="text-sm text-muted">{c.diagnosis}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Vital icon={Scale} label="Peso" value={kg(c.weight_kg)} />
                      <Vital
                        icon={Thermometer}
                        label="Temp."
                        value={c.temperature_c != null ? `${Number(c.temperature_c).toFixed(1)} °C` : null}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-3">
                    {variant === "owner" ? (
                      <>
                        {instructions}
                        {(c.findings || c.treatment || c.diagnosis) && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted">Ver nota clínica completa</summary>
                            <div className="mt-3">{clinical}</div>
                          </details>
                        )}
                      </>
                    ) : (
                      <>
                        {clinical}
                        {instructions}
                      </>
                    )}
                  </div>
                  {c.amends_id && <p className="mt-2 text-xs text-muted">Corrige un registro anterior.</p>}
                  <EntryAuthor
                    source={c.source}
                    authorName={c.author_name}
                    authorCedula={c.author_cedula}
                    createdAt={c.created_at}
                  />
                  {canAdd && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-muted">Corregir esta consulta</summary>
                      <form action={action} className="mt-3 flex flex-col gap-3">
                        <input type="hidden" name="amends_id" value={c.id} />
                        <ConsultationFields c={c} />
                        <Button variant="secondary" className="self-start">
                          Guardar corrección
                        </Button>
                      </form>
                    </details>
                  )}
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

// ------------------------------- Citas -------------------------------

export function AppointmentsCard({ record, compact = false }: { record: PetRecord; compact?: boolean }) {
  const { pet, isOwner } = record;
  const recent = isoDaysFromNow(-2 / 24);
  const me = record.session.userId;
  const upcoming = record.appointments.filter(
    (a) => a.status === "programada" && a.scheduled_at > recent,
  );
  return (
    <Card>
      <CardTitle icon={CalendarDays} title={isOwner ? "Próximas citas" : "Citas"} tone="accent" />
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted">
          Sin citas programadas.{" "}
          {record.clinicalAccess && (
            <Link href={`/vet/agenda?mascota=${pet.id}`} className="underline">
              Agendar una
            </Link>
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {upcoming.slice(0, compact ? 3 : 10).map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
              <p className="font-semibold">{formatDateTime(a.scheduled_at)}</p>
              <p>{a.reason}</p>
              <p className="text-xs text-muted">
                {a.clinician_name ?? "Por asignar"}
                {a.clinic_name ? ` · ${a.clinic_name}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {a.clinician_id === me && (
                  <form action={setAppointmentStatus.bind(null, pet.id, a.id, "completada")}>
                    <Button variant="secondary" className="min-h-9 px-3 text-xs">
                      Completada
                    </Button>
                  </form>
                )}
                {(isOwner || a.clinician_id === me) && (
                  <form action={setAppointmentStatus.bind(null, pet.id, a.id, "cancelada")}>
                    <Button
                      variant="ghost"
                      className="min-h-9 px-3 text-xs text-danger"
                      confirm="¿Cancelar esta cita? Le enviaremos un aviso a la otra parte."
                    >
                      Cancelar
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ------------------------- Línea de tiempo -------------------------

type TimelineItem = {
  id: string;
  date: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  detail?: string | null;
  source: RecordSource;
  author: string | null;
  cedula: string | null;
  createdAt: string;
  href: string;
};

/** Todas las entradas del expediente, de la más reciente a la más antigua. */
export function Timeline({ record, onlyVerified }: { record: PetRecord; onlyVerified: boolean }) {
  const base = `/mascotas/${record.pet.id}`;
  const items: TimelineItem[] = [
    ...record.consultations.map((c) => ({
      id: c.id,
      date: c.visit_date,
      icon: Stethoscope,
      tone: "bg-brand-soft text-brand",
      title: `Consulta: ${c.reason}`,
      detail: c.diagnosis,
      source: c.source,
      author: c.author_name,
      cedula: c.author_cedula,
      createdAt: c.created_at,
      href: `${base}?tab=consultas`,
    })),
    ...record.vaccinations.map((v) => ({
      id: v.id,
      date: v.applied_on,
      icon: Syringe,
      tone: "bg-verified-soft text-verified",
      title: `Vacuna: ${v.vaccine}`,
      detail: v.batch_number ? `Lote ${v.batch_number}` : null,
      source: v.source,
      author: v.author_name,
      cedula: v.author_cedula,
      createdAt: v.created_at,
      href: `${base}?tab=vacunas`,
    })),
    ...record.conditions.map((c) => ({
      id: c.id,
      date: c.created_at.slice(0, 10),
      icon: c.kind === "alergia" ? TriangleAlert : HeartPulse,
      tone: "bg-danger-soft text-danger",
      title: `${c.kind === "alergia" ? "Alergia" : "Padecimiento crónico"}: ${c.description}`,
      detail: [c.severity, c.active ? null : "resuelto"].filter(Boolean).join(" · ") || null,
      source: c.source,
      author: c.author_name,
      cedula: c.author_cedula,
      createdAt: c.created_at,
      href: `${base}?tab=condiciones`,
    })),
    ...record.attachments.map((a) => ({
      id: a.id,
      date: a.created_at.slice(0, 10),
      icon: FileText,
      tone: "bg-accent-soft text-accent",
      title: `Anexo: ${a.title}`,
      detail: a.notes,
      source: a.source,
      author: a.author_name,
      cedula: a.author_cedula,
      createdAt: a.created_at,
      href: `${base}?tab=anexos`,
    })),
    ...record.weights
      .filter((w) => !w.consultation_id)
      .map((w) => ({
        id: w.id,
        date: w.measured_on,
        icon: Scale,
        tone: "bg-surface-2 text-muted",
        title: `Peso: ${kg(w.weight_kg)}`,
        detail: null,
        source: w.source,
        author: w.author_name,
        cedula: w.author_cedula,
        createdAt: w.created_at,
        href: `${base}?tab=identificacion`,
      })),
  ]
    .filter((i) => !onlyVerified || i.source !== "propietario")
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const filterLink = (verified: boolean, label: string) => (
    <Link
      href={`${base}?tab=identificacion${verified ? "&fuente=clinica" : ""}`}
      scroll={false}
      aria-current={onlyVerified === verified ? "true" : undefined}
      className={cx(
        "rounded-full px-3 py-1.5 text-xs transition",
        onlyVerified === verified ? "bg-foreground font-medium text-background" : "border border-border text-muted",
      )}
    >
      {label}
    </Link>
  );

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Historial completo</h2>
        <div className="flex flex-wrap gap-1.5">
          {filterLink(false, "Todo")}
          {filterLink(true, "Solo registros clínicos")}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Sin registros.</p>
      ) : (
        <ol className="flex flex-col">
          {items.map((i) => (
            <li key={`${i.title}-${i.id}`} className="flex gap-3 border-b border-border py-3 last:border-0">
              <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", i.tone)}>
                <i.icon aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <Link href={i.href} className="font-medium hover:underline">
                    {i.title}
                  </Link>
                  <span className="text-xs text-muted">{formatDate(i.date)}</span>
                </div>
                {i.detail && <p className="text-sm text-muted">{i.detail}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {i.source === "vet" ? (
                    <Badge tone="verified">MVZ</Badge>
                  ) : i.source === "estudiante" ? (
                    <Badge tone="warning">Estudiante</Badge>
                  ) : (
                    <Badge>Propietario · sin verificar</Badge>
                  )}
                  {i.author}
                  {i.cedula ? ` · Cédula ${i.cedula}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
