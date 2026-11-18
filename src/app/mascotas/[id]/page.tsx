import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Crown,
  Eye,
  FileText,
  GraduationCap,
  HeartPulse,
  KeyRound,
  Pencil,
  Printer,
  QrCode,
  ShieldCheck,
  Siren,
  Syringe,
  TriangleAlert,
} from "lucide-react";
import { EntryAuthor } from "@/components/record-entries";
import {
  Alert,
  BackLink,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardTitle,
  cx,
  EmptyState,
  Field,
  FlashMessages,
  formatDate,
  formatDateTime,
  Input,
  PetAvatar,
  Select,
  speciesLabel,
  Textarea,
} from "@/components/ui";
import { AttachmentUploader, PhotoUploader } from "@/components/uploaders";
import { siteUrl } from "@/lib/env";
import { loadPetRecord, petAge, vaccineStatus, type PetRecord } from "@/lib/pets";
import { membershipActive, type Condition, type Vaccination } from "@/lib/types";
import {
  addCondition,
  addVaccination,
  createShareCode,
  markDeceased,
  revokeTag,
  setAppointmentStatus,
  toggleLostMode,
  updatePublicSettings,
} from "../actions";

const TABS = [
  { id: "identificacion", label: "Resumen", icon: ClipboardList, ownerOnly: false },
  { id: "vacunas", label: "Vacunas", icon: Syringe, ownerOnly: false },
  { id: "condiciones", label: "Alergias y crónicos", icon: HeartPulse, ownerOnly: false },
  { id: "anexos", label: "Anexos", icon: FileText, ownerOnly: false },
  { id: "placa", label: "Placa y privacidad", icon: QrCode, ownerOnly: true },
  { id: "accesos", label: "Accesos", icon: ShieldCheck, ownerOnly: true },
] as const;

export async function generateMetadata() {
  return { title: "Expediente" };
}

export default async function PetPage({ params, searchParams }: PageProps<"/mascotas/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const record = await loadPetRecord(id);
  const { pet, isOwner } = record;

  const tabs = TABS.filter((t) => isOwner || !t.ownerOnly);
  const tab = tabs.find((t) => t.id === query.tab)?.id ?? "identificacion";
  const activeAllergies = record.conditions.filter((c) => c.kind === "alergia" && c.active);
  const age = petAge(pet.birth_date);
  const alive = pet.status === "activo";
  const member = membershipActive(record.membership);

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={isOwner ? "/mascotas" : "/vet"}>{isOwner ? "Mis mascotas" : "Mis pacientes"}</BackLink>

      {record.isVetViewer && record.myAccessExpires && (
        <Alert
          tone={record.viewerIsStudent ? "warning" : "info"}
          title={record.viewerIsStudent ? "Cuenta de estudiante · No profesionista" : undefined}
        >
          Acceso al expediente hasta el {formatDateTime(record.myAccessExpires)}.{" "}
          {record.viewerIsStudent
            ? "Lo que registres quedará marcado como No profesionista."
            : "Tus registros quedan firmados con tu nombre y cédula."}{" "}
          El propietario recibe un aviso.
        </Alert>
      )}

      <Card className="overflow-hidden p-0 sm:p-0">
        <div className={cx("h-20 sm:h-24", pet.lost_mode ? "bg-danger" : "paw-pattern bg-brand")} />
        <div className="-mt-12 flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-6 sm:pb-6">
          <div className="w-fit rounded-[2.2rem] bg-surface p-1.5">
            <PetAvatar species={pet.species} name={pet.name} photoUrl={record.photoUrl} size="xl" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold">{pet.name}</h1>
              {!alive && <Badge>En memoria</Badge>}
              {pet.lost_mode && (
                <Badge tone="danger">
                  <Siren aria-hidden /> Extraviado
                </Badge>
              )}
              {isOwner && member && (
                <Badge tone="brand">
                  <Crown aria-hidden /> Membresía activa
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {speciesLabel(pet.species)}
              {pet.breed ? ` · ${pet.breed}` : ""}
              {pet.sex ? ` · ${pet.sex === "macho" ? "Macho" : "Hembra"}` : ""}
              {age ? ` · ${age}` : ""}
            </p>
          </div>
          {isOwner && <PhotoUploader petId={pet.id} />}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border bg-surface-2 px-5 py-3 sm:px-6 print:hidden">
          <ButtonLink href={`/mascotas/${pet.id}/resumen`} variant="secondary" prefetch={false}>
            <Printer aria-hidden /> Resumen clínico
          </ButtonLink>
          {isOwner && alive && (
            <>
              <form action={toggleLostMode.bind(null, pet.id, !pet.lost_mode)}>
                <Button variant={pet.lost_mode ? "secondary" : "danger"}>
                  <Siren aria-hidden /> {pet.lost_mode ? "Ya apareció" : "Se perdió"}
                </Button>
              </form>
              {pet.lost_mode && (
                <ButtonLink href={`/mascotas/${pet.id}/cartel`} variant="secondary" prefetch={false}>
                  <FileText aria-hidden /> Cartel de búsqueda
                </ButtonLink>
              )}
              <ButtonLink href={`/mascotas/${pet.id}/membresia`} variant="ghost">
                <Crown aria-hidden /> {member ? "Membresía" : "Activar membresía"}
              </ButtonLink>
              <ButtonLink href={`/mascotas/${pet.id}/editar`} variant="ghost">
                <Pencil aria-hidden /> Editar
              </ButtonLink>
            </>
          )}
        </div>
      </Card>

      {activeAllergies.length > 0 && (
        <Alert tone="error" title="Alergias">
          {activeAllergies.map((a) => `${a.description}${a.severity ? ` (${a.severity})` : ""}`).join(" · ")}
        </Alert>
      )}

      <FlashMessages error={query.error} ok={query.ok} />

      <nav
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 text-sm [scrollbar-width:none] print:hidden"
        aria-label="Secciones del expediente"
      >
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`/mascotas/${pet.id}?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 whitespace-nowrap transition",
                active
                  ? "bg-foreground font-medium text-background"
                  : "border border-border bg-surface text-muted hover:text-foreground",
              )}
            >
              <t.icon aria-hidden className="size-4" />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {tab === "identificacion" && <SummaryTab record={record} />}
      {tab === "vacunas" && <VaccinesTab record={record} />}
      {tab === "condiciones" && <ConditionsTab record={record} />}
      {tab === "anexos" && <AttachmentsTab record={record} />}
      {tab === "placa" && isOwner && <TagTab record={record} />}
      {tab === "accesos" && isOwner && <AccessTab record={record} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value || "—"}</dd>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "brand" | "warning" | "danger" }) {
  const tones = { brand: "text-brand", warning: "text-warning", danger: "text-danger" };
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card">
      <p className={cx("font-display text-3xl font-semibold", value === 0 ? "text-muted/50" : tones[tone])}>{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

function SummaryTab({ record }: { record: PetRecord }) {
  const { pet, owners, isOwner } = record;
  const counts = { ok: 0, soon: 0, overdue: 0 };
  record.vaccinations.forEach((v) => {
    if (v.next_due) counts[vaccineStatus(v.next_due)]++;
  });
  const upcoming = record.appointments.filter((a) => a.status === "programada" && new Date(a.scheduled_at) > new Date());
  const chronic = record.conditions.filter((c) => c.kind === "cronica" && c.active);
  const me = record.session.userId;

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Vacunas al día" value={counts.ok} tone="brand" />
        <Stat label="Por vencer (30 días)" value={counts.soon} tone="warning" />
        <Stat label="Vencidas" value={counts.overdue} tone="danger" />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardTitle icon={ClipboardList} title="Identificación" />
          <dl>
            <Row label="Especie" value={speciesLabel(pet.species)} />
            <Row label="Raza" value={pet.breed} />
            <Row label="Sexo" value={pet.sex === "macho" ? "Macho" : pet.sex === "hembra" ? "Hembra" : null} />
            <Row label="Nacimiento" value={pet.birth_date ? formatDate(pet.birth_date) : null} />
            <Row label="Color / señas" value={pet.color} />
            <Row label="Esterilizado" value={pet.sterilized == null ? null : pet.sterilized ? "Sí" : "No"} />
            <Row label="Microchip" value={pet.microchip} />
            <Row
              label="Propietario(s)"
              value={owners
                .map((o) => `${o.profiles?.full_name ?? ""}${o.profiles?.phone ? ` · ${o.profiles.phone}` : ""}`)
                .join(", ")}
            />
          </dl>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle icon={CalendarDays} title="Próximas citas" tone="accent" />
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">
                Sin citas programadas.{" "}
                {record.isVetViewer && (
                  <Link href={`/vet/agenda?mascota=${pet.id}`} className="underline">
                    Agendar una
                  </Link>
                )}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {upcoming.map((a) => (
                  <li key={a.id} className="rounded-xl border border-border bg-surface-2 p-3 text-sm">
                    <p className="font-semibold">{formatDateTime(a.scheduled_at)}</p>
                    <p>{a.reason}</p>
                    <p className="text-xs text-muted">
                      {a.clinician_name}
                      {a.clinic_name ? ` · ${a.clinic_name}` : ""}
                    </p>
                    <div className="mt-2 flex gap-2">
                      {a.clinician_id === me && (
                        <form action={setAppointmentStatus.bind(null, pet.id, a.id, "completada")}>
                          <Button variant="secondary" className="min-h-9 px-3 text-xs">
                            Completada
                          </Button>
                        </form>
                      )}
                      {(isOwner || a.clinician_id === me) && (
                        <form action={setAppointmentStatus.bind(null, pet.id, a.id, "cancelada")}>
                          <Button variant="ghost" className="min-h-9 px-3 text-xs text-danger">
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
          <Card>
            <CardTitle icon={HeartPulse} title="Padecimientos crónicos" tone="danger" />
            {chronic.length === 0 ? (
              <p className="text-sm text-muted">Sin padecimientos crónicos registrados.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {chronic.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.description}</span>
                    {c.notes && <span className="text-muted"> · {c.notes}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {isOwner && pet.status === "activo" && (
        <details className="rounded-2xl border border-border bg-surface p-5 text-sm">
          <summary className="cursor-pointer font-medium text-muted">Registrar fallecimiento</summary>
          <form action={markDeceased.bind(null, pet.id)} className="mt-3 flex flex-col gap-3">
            <p className="text-muted">
              La placa dejará de mostrar datos de contacto. El historial clínico se conserva y puedes exportarlo.
            </p>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirm" className="size-4" /> Confirmo que {pet.name} falleció.
            </label>
            <Button variant="danger" className="self-start">
              Registrar
            </Button>
          </form>
        </details>
      )}
    </>
  );
}

const COMMON_VACCINES = [
  "Antirrábica",
  "Múltiple canina (séxtuple)",
  "Parvovirus",
  "Moquillo",
  "Bordetella (tos de las perreras)",
  "Leptospirosis",
  "Triple felina",
  "Leucemia felina",
];

function VaccineFields({ v }: { v?: Vaccination }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Vacuna">
        <Input
          name="vaccine"
          required
          maxLength={120}
          defaultValue={v?.vaccine}
          placeholder="Antirrábica"
          list="vacunas-comunes"
        />
      </Field>
      <Field label="Lote (opcional)">
        <Input name="batch_number" maxLength={60} defaultValue={v?.batch_number ?? ""} />
      </Field>
      <Field label="Fecha de aplicación">
        <Input name="applied_on" type="date" required defaultValue={v?.applied_on} />
      </Field>
      <Field label="Próxima dosis (opcional)">
        <Input name="next_due" type="date" defaultValue={v?.next_due ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notas (opcional)">
          <Textarea name="notes" maxLength={500} defaultValue={v?.notes ?? ""} />
        </Field>
      </div>
    </div>
  );
}

function canWrite(record: PetRecord) {
  return record.isOwner || record.isVetViewer;
}

function AddPanel({
  icon: Icon,
  title,
  tone = "brand",
  open,
  children,
}: {
  icon: typeof Syringe;
  title: string;
  tone?: "brand" | "danger";
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6" open={open}>
      <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold">
        <span
          className={cx(
            "grid size-10 place-items-center rounded-xl",
            tone === "danger" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand",
          )}
        >
          <Icon aria-hidden className="size-5" />
        </span>
        {title}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function VaccinesTab({ record }: { record: PetRecord }) {
  const action = addVaccination.bind(null, record.pet.id);
  const statusBadge = {
    ok: { tone: "brand" as const, label: "Próxima" },
    soon: { tone: "warning" as const, label: "Por vencer" },
    overdue: { tone: "danger" as const, label: "Vencida" },
  };
  return (
    <>
      <datalist id="vacunas-comunes">
        {COMMON_VACCINES.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      {canWrite(record) && (
        <AddPanel icon={Syringe} title="Registrar vacuna" open={record.vaccinations.length === 0}>
          <form action={action} className="flex flex-col gap-3">
            <VaccineFields />
            <Button className="self-start">Guardar vacuna</Button>
          </form>
        </AddPanel>
      )}
      {record.vaccinations.length === 0 ? (
        <EmptyState
          icon={Syringe}
          title="Sin vacunas registradas"
          text="Agrega la cartilla de vacunación para recibir recordatorios."
        />
      ) : (
        <ol className="ml-1.5 flex flex-col gap-3 border-l-2 border-border pl-5">
          {record.vaccinations.map((v) => {
            const st = v.next_due ? statusBadge[vaccineStatus(v.next_due)] : null;
            return (
              <li key={v.id} className="relative">
                <span
                  aria-hidden
                  className={cx(
                    "absolute top-7 -left-[1.6rem] size-3 rounded-full ring-4 ring-background",
                    st?.tone === "danger" ? "bg-danger" : st?.tone === "warning" ? "bg-warning" : "bg-brand",
                  )}
                />
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-semibold">{v.vaccine}</h3>
                      <p className="text-sm text-muted">
                        Aplicada el {formatDate(v.applied_on)}
                        {v.batch_number ? ` · Lote ${v.batch_number}` : ""}
                      </p>
                    </div>
                    {st && v.next_due && (
                      <Badge tone={st.tone}>
                        {st.label}: {formatDate(v.next_due)}
                      </Badge>
                    )}
                  </div>
                  {v.notes && <p className="mt-2 text-sm">{v.notes}</p>}
                  {v.amends_id && <p className="mt-1 text-xs text-muted">Corrige un registro anterior.</p>}
                  <EntryAuthor
                    source={v.source}
                    authorName={v.author_name}
                    authorCedula={v.author_cedula}
                    createdAt={v.created_at}
                  />
                  {canWrite(record) && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-muted">Corregir este registro</summary>
                      <form action={action} className="mt-3 flex flex-col gap-3">
                        <input type="hidden" name="amends_id" value={v.id} />
                        <VaccineFields v={v} />
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

function ConditionFields({ c }: { c?: Condition }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Tipo">
        <Select name="kind" defaultValue={c?.kind ?? "alergia"}>
          <option value="alergia">Alergia</option>
          <option value="cronica">Enfermedad crónica</option>
        </Select>
      </Field>
      <Field label="Severidad (opcional)">
        <Select name="severity" defaultValue={c?.severity ?? ""}>
          <option value="">Sin especificar</option>
          <option value="leve">Leve</option>
          <option value="moderada">Moderada</option>
          <option value="grave">Grave</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Descripción">
          <Input name="description" required maxLength={500} defaultValue={c?.description} placeholder="Penicilina" />
        </Field>
      </div>
      <Field label="Estado">
        <Select name="active" defaultValue={c && !c.active ? "no" : "si"}>
          <option value="si">Vigente</option>
          <option value="no">Resuelto / ya no aplica</option>
        </Select>
      </Field>
      <Field label="Notas (opcional)">
        <Input name="notes" maxLength={500} defaultValue={c?.notes ?? ""} />
      </Field>
    </div>
  );
}

function ConditionsTab({ record }: { record: PetRecord }) {
  const action = addCondition.bind(null, record.pet.id);
  const groups = [
    { kind: "alergia" as const, title: "Alergias", icon: TriangleAlert },
    { kind: "cronica" as const, title: "Enfermedades crónicas", icon: HeartPulse },
  ];
  return (
    <>
      {canWrite(record) && (
        <AddPanel icon={HeartPulse} title="Agregar alergia o padecimiento" tone="danger">
          <form action={action} className="flex flex-col gap-3">
            <ConditionFields />
            <Button className="self-start">Guardar</Button>
          </form>
        </AddPanel>
      )}
      {groups.map((g) => {
        const items = record.conditions.filter((c) => c.kind === g.kind);
        return (
          <section key={g.kind} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <g.icon aria-hidden className="size-5 text-danger" /> {g.title}
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted">Sin registros.</p>
            ) : (
              items.map((c) => (
                <Card
                  key={c.id}
                  className={cx(!c.active && "opacity-70", c.severity === "grave" && c.active && "border-danger/40")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{c.description}</h3>
                    {c.severity && (
                      <Badge tone={c.severity === "grave" ? "danger" : c.severity === "moderada" ? "warning" : "neutral"}>
                        {c.severity}
                      </Badge>
                    )}
                    {!c.active && <Badge>Resuelto</Badge>}
                  </div>
                  {c.notes && <p className="mt-2 text-sm">{c.notes}</p>}
                  <EntryAuthor
                    source={c.source}
                    authorName={c.author_name}
                    authorCedula={c.author_cedula}
                    createdAt={c.created_at}
                  />
                  {canWrite(record) && (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-muted">Actualizar o corregir</summary>
                      <form action={action} className="mt-3 flex flex-col gap-3">
                        <input type="hidden" name="amends_id" value={c.id} />
                        <ConditionFields c={c} />
                        <Button variant="secondary" className="self-start">
                          Guardar actualización
                        </Button>
                      </form>
                    </details>
                  )}
                </Card>
              ))
            )}
          </section>
        );
      })}
    </>
  );
}

function AttachmentsTab({ record }: { record: PetRecord }) {
  const labels = { estudio: "Estudio", receta: "Receta", otro: "Otro" };
  return (
    <>
      {canWrite(record) && (
        <Card>
          <CardTitle
            icon={FileText}
            title="Subir anexo"
            subtitle="PDF o imagen de hasta 5 MB: estudios, recetas, radiografías."
          />
          <AttachmentUploader petId={record.pet.id} />
        </Card>
      )}
      {record.attachments.length === 0 ? (
        <EmptyState icon={FileText} title="Sin anexos" text="Los estudios y recetas que se suban aparecerán aquí." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {record.attachments.map((a) => (
            <li key={a.id}>
              <Card className="h-full">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                    <FileText aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Badge>{labels[a.kind]}</Badge>
                    <h3 className="mt-1 font-semibold">{a.title}</h3>
                    {a.notes && <p className="text-sm text-muted">{a.notes}</p>}
                  </div>
                </div>
                <ButtonLink
                  href={`/api/archivos/${a.id}`}
                  variant="secondary"
                  target="_blank"
                  prefetch={false}
                  className="mt-3 w-full"
                >
                  <Eye aria-hidden /> Abrir {a.mime_type === "application/pdf" ? "PDF" : "imagen"}
                </ButtonLink>
                <EntryAuthor
                  source={a.source}
                  authorName={a.author_name}
                  authorCedula={a.author_cedula}
                  createdAt={a.created_at}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TagTab({ record }: { record: PetRecord }) {
  const { pet } = record;
  const active = record.tags.find((t) => t.status === "activa");
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card>
        <CardTitle icon={QrCode} title="Placa QR" />
        {active ? (
          <div className="flex flex-col items-center gap-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG generado por la API */}
            <img
              src={`/api/qr/${active.public_token}`}
              alt="Código QR de la placa"
              className="size-44 rounded-full border-[6px] border-accent bg-white p-7"
            />
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-mono text-lg font-semibold tracking-widest">{active.public_token}</p>
              <p className="text-muted">Activada el {formatDate(active.activated_at)}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={`/p/${active.public_token}`} variant="secondary" target="_blank">
                <Eye aria-hidden /> Ver lo que ven al escanear
              </ButtonLink>
              <form action={revokeTag.bind(null, pet.id, active.id)}>
                <Button variant="ghost" className="text-danger">
                  Desactivar (placa perdida)
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted">
              {pet.name} aún no tiene una placa activa. Escanea tu placa nueva con el celular o escribe su código.
            </p>
            <ButtonLink href={`/placas/activar?mascota=${pet.id}`} className="self-start">
              <QrCode aria-hidden /> Activar una placa
            </ButtonLink>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-muted">URL de la placa: {siteUrl()}/p/…</p>
      </Card>

      <Card>
        <CardTitle icon={Eye} title="Qué ve quien escanea la placa" />
        <form action={updatePublicSettings.bind(null, pet.id)} className="flex flex-col gap-4 text-sm">
          <p className="text-muted">
            Siempre se muestra el nombre de {pet.name} y tu nombre de pila. El historial clínico solo lo ven médicos
            veterinarios verificados.
          </p>
          <label className="flex items-center gap-2.5">
            <input type="checkbox" name="show_phone" defaultChecked={pet.show_phone} className="size-4" />
            Mostrar mi teléfono (botones de llamar y WhatsApp)
          </label>
          <label className="flex items-center gap-2.5">
            <input type="checkbox" name="show_photo" defaultChecked={pet.show_photo} className="size-4" />
            Mostrar la foto de {pet.name}
          </label>
          <div className="rounded-xl border border-danger/30 bg-danger-soft/50 p-4">
            <label className="flex items-center gap-2.5 font-medium">
              <input type="checkbox" name="lost_mode" defaultChecked={pet.lost_mode} className="size-4" />
              <Siren aria-hidden className="size-4 text-danger" /> Modo extraviado
            </label>
            <p className="mt-1 text-muted">
              Muestra un aviso destacado y te avisamos cada vez que alguien escanee la placa.
            </p>
            <div className="mt-3">
              <Field label="Mensaje para quien la encuentre (opcional)">
                <Textarea
                  name="lost_message"
                  maxLength={280}
                  defaultValue={pet.lost_message ?? ""}
                  placeholder="Se perdió cerca del parque. Necesita medicamento diario. Gracias."
                />
              </Field>
            </div>
          </div>
          <Button className="self-start">Guardar</Button>
        </form>
      </Card>
    </div>
  );
}

const accessLabel = { escaneo: "Escaneó la placa", codigo: "Con código", cita: "Cita agendada" };

function AccessTab({ record }: { record: PetRecord }) {
  const now = new Date();
  return (
    <>
      <Card>
        <CardTitle
          icon={KeyRound}
          title="Compartir con un MVZ sin escanear"
          subtitle="Código de 6 caracteres, válido 24 h y de un solo uso. El MVZ obtiene acceso por 7 días."
        />
        <form action={createShareCode.bind(null, record.pet.id)}>
          <Button variant="secondary">Generar código</Button>
        </form>
      </Card>
      <Card>
        <CardTitle icon={ShieldCheck} title="Quién ha accedido al expediente" />
        {record.access.length === 0 ? (
          <p className="text-sm text-muted">Nadie ha accedido al expediente.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {record.access.map((a) => {
              const isStudent = a.profiles?.role === "student";
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="flex flex-col">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {a.profiles?.full_name ?? "Clínico"}
                      {isStudent && (
                        <Badge tone="warning">
                          <GraduationCap aria-hidden /> No profesionista
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted">
                      {isStudent
                        ? a.profiles?.student_profiles?.university
                        : [
                            a.profiles?.vet_profiles?.cedula ? `Cédula ${a.profiles.vet_profiles.cedula}` : null,
                            a.profiles?.vet_profiles?.clinic_name,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {accessLabel[a.source]} · {formatDateTime(a.granted_at)}
                    {new Date(a.expires_at) > now ? <Badge tone="brand">Vigente</Badge> : <Badge>Vencido</Badge>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle icon={QrCode} title="Escaneos recientes de la placa" />
        {record.scans.length === 0 ? (
          <p className="text-sm text-muted">Sin escaneos.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {record.scans.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span>{s.kind === "vet" ? "Clínico verificado" : "Persona sin cuenta"}</span>
                <span className="text-muted">
                  {formatDateTime(s.created_at)}
                  {s.latitude != null && s.longitude != null && (
                    <>
                      {" · "}
                      <a
                        className="underline"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://maps.google.com/?q=${s.latitude},${s.longitude}`}
                      >
                        Ver ubicación
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
