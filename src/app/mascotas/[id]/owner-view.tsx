import Link from "next/link";
import {
  CircleCheck,
  ClipboardList,
  Crown,
  FileText,
  HeartPulse,
  Pencil,
  Pill,
  Printer,
  QrCode,
  Scale,
  ShieldCheck,
  Siren,
  Stethoscope,
  Syringe,
  TriangleAlert,
} from "lucide-react";
import {
  Alert,
  BackLink,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardTitle,
  cx,
  FlashMessages,
  formatDate,
  PetAvatar,
  speciesLabel,
} from "@/components/ui";
import { PhotoUploader } from "@/components/uploaders";
import { petAge, vaccineStatus, type PetRecord } from "@/lib/pets";
import { membershipActive } from "@/lib/types";
import { markDeceased, toggleLostMode } from "../actions";
import { AppointmentsCard, ConsultationsSection, currentTreatment, WeightChart, WeightForm } from "./record-parts";
import { AccessTab, AttachmentsTab, ConditionsTab, Row, TagTab, VaccinesTab } from "./sections";

const TABS = [
  { id: "identificacion", label: "Inicio", icon: ClipboardList },
  { id: "vacunas", label: "Vacunas", icon: Syringe },
  { id: "condiciones", label: "Salud", icon: HeartPulse },
  { id: "consultas", label: "Consultas", icon: Stethoscope },
  { id: "anexos", label: "Archivos", icon: FileText },
  { id: "placa", label: "Placa y privacidad", icon: QrCode },
  { id: "accesos", label: "Accesos", icon: ShieldCheck },
] as const;

export type OwnerTab = (typeof TABS)[number]["id"];

export function ownerTab(value: unknown): OwnerTab {
  return TABS.find((t) => t.id === value)?.id ?? "identificacion";
}

/**
 * Cartilla del propietario: lo que tiene pendiente, las indicaciones de su
 * MVZ en lenguaje claro, la placa y quién ha visto el expediente.
 */
export function OwnerRecord({
  record,
  tab,
  query,
  shareCode,
  canSwitch,
}: {
  record: PetRecord;
  tab: OwnerTab;
  query: Record<string, string | string[] | undefined>;
  shareCode: string | null;
  canSwitch: boolean;
}) {
  const { pet } = record;
  const age = petAge(pet.birth_date);
  const alive = pet.status === "activo";
  const member = membershipActive(record.membership);

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/mascotas">Mis mascotas</BackLink>

      <Card className="overflow-hidden p-0 sm:p-0">
        <div className={cx("h-20 sm:h-24", pet.lost_mode ? "bg-danger" : "paw-pattern bg-deep")} />
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
              {member && (
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
          <PhotoUploader petId={pet.id} />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border bg-surface-2 px-5 py-3 sm:px-6 print:hidden">
          {alive && (
            <form action={toggleLostMode.bind(null, pet.id, !pet.lost_mode)}>
              <Button variant={pet.lost_mode ? "secondary" : "danger"}>
                <Siren aria-hidden /> {pet.lost_mode ? "Ya apareció" : "Se perdió"}
              </Button>
            </form>
          )}
          {pet.lost_mode && (
            <ButtonLink href={`/mascotas/${pet.id}/cartel`} variant="secondary" prefetch={false}>
              <FileText aria-hidden /> Cartel de búsqueda
            </ButtonLink>
          )}
          <ButtonLink href={`/mascotas/${pet.id}/resumen`} variant="secondary" prefetch={false}>
            <Printer aria-hidden /> Cartilla para imprimir
          </ButtonLink>
          {alive && (
            <>
              <ButtonLink href={`/mascotas/${pet.id}/membresia`} variant="ghost">
                <Crown aria-hidden /> {member ? "Membresía" : "Activar membresía"}
              </ButtonLink>
              <ButtonLink href={`/mascotas/${pet.id}/editar`} variant="ghost">
                <Pencil aria-hidden /> Editar
              </ButtonLink>
            </>
          )}
          {canSwitch && (
            <ButtonLink href={`/mascotas/${pet.id}?vista=ficha`} variant="ghost">
              <Stethoscope aria-hidden /> Ver como ficha clínica
            </ButtonLink>
          )}
        </div>
      </Card>

      <FlashMessages error={query.error} ok={query.ok} />

      <nav
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 text-sm [scrollbar-width:none] print:hidden"
        aria-label="Secciones de la cartilla"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={`/mascotas/${pet.id}?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={cx(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 whitespace-nowrap transition",
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

      {tab === "identificacion" && <OwnerHome record={record} />}
      {tab === "vacunas" && <VaccinesTab record={record} variant="owner" />}
      {tab === "condiciones" && <ConditionsTab record={record} variant="owner" />}
      {tab === "consultas" && <ConsultationsSection record={record} variant="owner" />}
      {tab === "anexos" && <AttachmentsTab record={record} />}
      {tab === "placa" && <TagTab record={record} />}
      {tab === "accesos" && <AccessTab record={record} code={shareCode} />}
    </div>
  );
}

const severityText = {
  grave: "Grave: avísalo siempre a cualquier MVZ antes de que lo atienda.",
  moderada: "Moderada: menciónalo en cada consulta.",
  leve: "Leve.",
};

function OwnerHome({ record }: { record: PetRecord }) {
  const { pet } = record;
  const dueVaccines = record.vaccinations
    .filter((v) => v.next_due && vaccineStatus(v.next_due) !== "ok")
    .sort((a, b) => (a.next_due ?? "").localeCompare(b.next_due ?? ""));
  const overdue = dueVaccines.filter((v) => vaccineStatus(v.next_due) === "overdue").length;
  const treatment = currentTreatment(record);
  const allergies = record.conditions.filter((c) => c.kind === "alergia" && c.active);
  const chronic = record.conditions.filter((c) => c.kind === "cronica" && c.active);

  const status =
    overdue > 0
      ? { tone: "danger" as const, title: `${overdue} ${overdue === 1 ? "vacuna vencida" : "vacunas vencidas"}` }
      : dueVaccines.length > 0
        ? { tone: "warning" as const, title: `${dueVaccines.length} ${dueVaccines.length === 1 ? "vacuna por vencer" : "vacunas por vencer"}` }
        : record.vaccinations.length === 0
          ? { tone: "neutral" as const, title: "Aún no registras su cartilla de vacunación" }
          : { tone: "ok" as const, title: "Vacunas al corriente" };
  const tones = {
    danger: "border-danger/30 bg-danger-soft text-danger",
    warning: "border-warning/30 bg-warning-soft text-warning",
    neutral: "border-border bg-surface-2 text-foreground",
    ok: "border-verified/30 bg-verified-soft text-verified",
  };

  return (
    <>
      <section className={cx("flex items-start gap-3 rounded-2xl border p-4 sm:p-5", tones[status.tone])}>
        {status.tone === "ok" ? (
          <CircleCheck aria-hidden className="mt-0.5 size-6 shrink-0" />
        ) : (
          <Syringe aria-hidden className="mt-0.5 size-6 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{status.title}</h2>
          {dueVaccines.length > 0 ? (
            <ul className="mt-1 text-sm text-foreground">
              {dueVaccines.map((v) => (
                <li key={v.id}>
                  {v.vaccine}: {vaccineStatus(v.next_due) === "overdue" ? "venció" : "le toca"} el {formatDate(v.next_due)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 text-sm text-foreground/80">
              {record.vaccinations.length === 0
                ? "Agrégala para recibir recordatorios antes de cada dosis."
                : "Te avisaremos antes de la próxima dosis."}
            </p>
          )}
        </div>
        <ButtonLink href={`/mascotas/${pet.id}?tab=vacunas`} variant="secondary" className="hidden shrink-0 sm:inline-flex">
          Ver cartilla
        </ButtonLink>
      </section>

      {treatment && (
        <Card className="border-verified/30">
          <CardTitle
            icon={Pill}
            title="Tratamiento en curso"
            subtitle={`${treatment.author_name ?? "Tu MVZ"} · ${formatDate(treatment.visit_date)} · ${treatment.reason}`}
          />
          <p className="text-sm whitespace-pre-line">
            {treatment.owner_instructions ?? "Tu MVZ registró un tratamiento. Consulta los detalles en la nota de la consulta."}
          </p>
          <Link href={`/mascotas/${pet.id}?tab=consultas`} className="mt-3 inline-block text-sm text-brand underline">
            Ver la consulta completa
          </Link>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <AppointmentsCard record={record} compact />
        <Card>
          <CardTitle icon={TriangleAlert} title="Lo que todo MVZ debe saber" tone="danger" />
          {allergies.length === 0 && chronic.length === 0 ? (
            <p className="text-sm text-muted">
              No hay alergias ni padecimientos registrados.{" "}
              <Link href={`/mascotas/${pet.id}?tab=condiciones`} className="underline">
                Agregar
              </Link>
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5 text-sm">
              {allergies.map((a) => (
                <li key={a.id}>
                  <span className="font-semibold">Alergia a {a.description}.</span>{" "}
                  <span className="text-muted">{a.severity ? severityText[a.severity] : ""}</span>
                </li>
              ))}
              {chronic.map((c) => (
                <li key={c.id}>
                  <span className="font-semibold">{c.description}.</span>{" "}
                  {c.notes && <span className="text-muted">{c.notes}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle icon={Scale} title="Peso" />
          <WeightChart record={record} />
          {pet.status === "activo" && <WeightForm petId={pet.id} tab="identificacion" />}
        </Card>
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
            <Row label="Propietario(s)" value={record.owners.map((o) => o.profiles?.full_name ?? "").join(", ")} />
          </dl>
        </Card>
      </div>

      {pet.lost_mode && (
        <Alert tone="error" title={`${pet.name} está en modo extraviado`}>
          Quien escanee su placa verá tu aviso y te avisaremos al instante.
        </Alert>
      )}

      {pet.status === "activo" && (
        <details className="rounded-2xl border border-border bg-surface p-5 text-sm">
          <summary className="cursor-pointer font-medium text-muted">Registrar fallecimiento</summary>
          <form action={markDeceased.bind(null, pet.id)} className="mt-3 flex flex-col gap-3">
            <p className="text-muted">
              La placa dejará de mostrar datos de contacto. El historial clínico se conserva y puedes exportarlo.
            </p>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="confirm" className="size-4" /> Confirmo que {pet.name} falleció.
            </label>
            <Button
              variant="danger"
              className="self-start"
              confirm={`¿Registrar el fallecimiento de ${pet.name}? No se puede deshacer.`}
            >
              Registrar
            </Button>
          </form>
        </details>
      )}
    </>
  );
}
