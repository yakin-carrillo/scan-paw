import Link from "next/link";
import { EntryAuthor } from "@/components/record-entries";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  Field,
  FlashMessages,
  formatDate,
  formatDateTime,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { AttachmentUploader, PhotoUploader } from "@/components/uploaders";
import { siteUrl } from "@/lib/env";
import { loadPetRecord, petAge, type PetRecord } from "@/lib/pets";
import type { Condition, Vaccination } from "@/lib/types";
import {
  addCondition,
  addVaccination,
  createShareCode,
  markDeceased,
  revokeTag,
  updatePublicSettings,
} from "../actions";

const TABS = [
  { id: "identificacion", label: "Identificación", ownerOnly: false },
  { id: "vacunas", label: "Vacunas", ownerOnly: false },
  { id: "condiciones", label: "Alergias y crónicos", ownerOnly: false },
  { id: "anexos", label: "Anexos", ownerOnly: false },
  { id: "placa", label: "Placa y privacidad", ownerOnly: true },
  { id: "accesos", label: "Accesos", ownerOnly: true },
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

  return (
    <div className="flex flex-col gap-5">
      {/* En modo app (pantalla de inicio) no hay botón "atrás" del navegador. */}
      <Link href={isOwner ? "/mascotas" : "/vet"} className="-mb-2 self-start text-sm text-muted">
        ← {isOwner ? "Mis mascotas" : "Mis pacientes"}
      </Link>
      {record.isVetViewer && record.myAccessExpires && (
        <Alert tone="info">
          Acceso como MVZ hasta el {formatDateTime(record.myAccessExpires)}. Tus registros quedan firmados con tu
          nombre y cédula, y el propietario recibe un aviso.
        </Alert>
      )}

      <header className="flex flex-wrap items-center gap-4">
        {record.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal
          <img src={record.photoUrl} alt={`Foto de ${pet.name}`} className="size-20 rounded-xl object-cover" />
        ) : (
          <div aria-hidden className="grid size-20 place-items-center rounded-xl bg-brand-soft text-3xl">
            {pet.species === "perro" ? "🐶" : "🐱"}
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{pet.name}</h1>
            {pet.status === "fallecido" && <Badge>Fallecido</Badge>}
            {pet.lost_mode && <Badge tone="danger">Modo extraviado activo</Badge>}
          </div>
          <p className="text-sm text-muted">
            {pet.species === "perro" ? "Perro" : "Gato"}
            {pet.breed ? ` · ${pet.breed}` : ""}
            {petAge(pet.birth_date) ? ` · ${petAge(pet.birth_date)}` : ""}
          </p>
        </div>
        {isOwner && <PhotoUploader petId={pet.id} />}
      </header>

      {activeAllergies.length > 0 && (
        <Alert tone="error">
          <strong>Alergias:</strong> {activeAllergies.map((a) => a.description).join(" · ")}
        </Alert>
      )}

      <FlashMessages error={query.error} ok={query.ok} />

      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm" aria-label="Secciones del expediente">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/mascotas/${pet.id}?tab=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3 py-2 ${
              t.id === tab ? "bg-brand text-white dark:text-black" : "border border-border bg-surface"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "identificacion" && <IdentificationTab record={record} />}
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
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value || "—"}</dd>
    </div>
  );
}

function IdentificationTab({ record }: { record: PetRecord }) {
  const { pet, owners, isOwner } = record;
  return (
    <>
      <Card>
        <dl>
          <Row label="Especie" value={pet.species === "perro" ? "Perro" : "Gato"} />
          <Row label="Raza" value={pet.breed} />
          <Row label="Sexo" value={pet.sex === "macho" ? "Macho" : pet.sex === "hembra" ? "Hembra" : null} />
          <Row label="Nacimiento" value={pet.birth_date ? formatDate(pet.birth_date) : null} />
          <Row label="Color / señas" value={pet.color} />
          <Row label="Esterilizado" value={pet.sterilized == null ? null : pet.sterilized ? "Sí" : "No"} />
          <Row label="Microchip" value={pet.microchip} />
          <Row
            label="Propietario(s)"
            value={owners.map((o) => `${o.profiles?.full_name ?? ""}${o.profiles?.phone ? ` · ${o.profiles.phone}` : ""}`).join(", ")}
          />
        </dl>
        {isOwner && (
          <ButtonLink href={`/mascotas/${pet.id}/editar`} variant="secondary" className="mt-4">
            Editar datos
          </ButtonLink>
        )}
      </Card>
      {isOwner && pet.status === "activo" && (
        <details className="rounded-xl border border-border bg-surface p-5 text-sm">
          <summary className="cursor-pointer font-medium">Registrar fallecimiento</summary>
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

function VaccineFields({ v }: { v?: Vaccination }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Vacuna">
        <Input name="vaccine" required maxLength={120} defaultValue={v?.vaccine} placeholder="Antirrábica" />
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

function VaccinesTab({ record }: { record: PetRecord }) {
  const action = addVaccination.bind(null, record.pet.id);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      {canWrite(record) && (
        <Card>
          <h2 className="mb-3 font-semibold">Registrar vacuna</h2>
          <form action={action} className="flex flex-col gap-3">
            <VaccineFields />
            <Button className="self-start">Guardar vacuna</Button>
          </form>
        </Card>
      )}
      {record.vaccinations.length === 0 ? (
        <p className="text-sm text-muted">Sin vacunas registradas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {record.vaccinations.map((v) => (
            <li key={v.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{v.vaccine}</h3>
                    <p className="text-sm text-muted">
                      Aplicada el {formatDate(v.applied_on)}
                      {v.batch_number ? ` · Lote ${v.batch_number}` : ""}
                    </p>
                  </div>
                  {v.next_due && (
                    <Badge tone={v.next_due < today ? "danger" : "neutral"}>
                      {v.next_due < today ? "Vencida" : "Próxima"}: {formatDate(v.next_due)}
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
          ))}
        </ul>
      )}
    </>
  );
}

function ConditionFields({ c, kind }: { c?: Condition; kind?: Condition["kind"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Tipo">
        <Select name="kind" defaultValue={c?.kind ?? kind ?? "alergia"}>
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
    { kind: "alergia" as const, title: "Alergias" },
    { kind: "cronica" as const, title: "Enfermedades crónicas" },
  ];
  return (
    <>
      {canWrite(record) && (
        <Card>
          <h2 className="mb-3 font-semibold">Agregar registro</h2>
          <form action={action} className="flex flex-col gap-3">
            <ConditionFields />
            <Button className="self-start">Guardar</Button>
          </form>
        </Card>
      )}
      {groups.map((g) => {
        const items = record.conditions.filter((c) => c.kind === g.kind);
        return (
          <section key={g.kind} className="flex flex-col gap-3">
            <h2 className="font-semibold">{g.title}</h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted">Sin registros.</p>
            ) : (
              items.map((c) => (
                <Card key={c.id} className={c.active ? "" : "opacity-70"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{c.description}</h3>
                    {c.severity && <Badge tone={c.severity === "grave" ? "danger" : "neutral"}>{c.severity}</Badge>}
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
          <h2 className="mb-3 font-semibold">Subir anexo</h2>
          <AttachmentUploader petId={record.pet.id} />
        </Card>
      )}
      {record.attachments.length === 0 ? (
        <p className="text-sm text-muted">Sin anexos.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {record.attachments.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Badge>{labels[a.kind]}</Badge>
                    <h3 className="mt-1 font-semibold">{a.title}</h3>
                    {a.notes && <p className="text-sm text-muted">{a.notes}</p>}
                  </div>
                  <ButtonLink href={`/api/archivos/${a.id}`} variant="secondary" target="_blank" prefetch={false}>
                    Abrir {a.mime_type === "application/pdf" ? "PDF" : "imagen"}
                  </ButtonLink>
                </div>
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
    <>
      <Card>
        <h2 className="font-semibold">Placa QR</h2>
        {active ? (
          <div className="mt-3 flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG generado por la API */}
            <img src={`/api/qr/${active.public_token}`} alt="Código QR de la placa" className="size-36 rounded-lg bg-white p-2" />
            <div className="flex flex-col gap-2 text-sm">
              <p>
                Código: <span className="font-mono text-base font-semibold">{active.public_token}</span>
              </p>
              <p className="text-muted">Activada el {formatDate(active.activated_at)}</p>
              <Link href={`/p/${active.public_token}`} className="underline" target="_blank">
                Ver lo que ve quien escanea
              </Link>
              <form action={revokeTag.bind(null, pet.id, active.id)}>
                <Button variant="secondary">Desactivar (placa perdida)</Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <p className="text-muted">
              {pet.name} aún no tiene una placa activa. Escanea tu placa nueva con el celular o escribe su código.
            </p>
            <ButtonLink href={`/placas/activar?mascota=${pet.id}`} className="self-start">
              Activar una placa
            </ButtonLink>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">URL de la placa: {siteUrl()}/p/…</p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Qué ve quien escanea la placa</h2>
        <form action={updatePublicSettings.bind(null, pet.id)} className="flex flex-col gap-4 text-sm">
          <p className="text-muted">
            Siempre se muestra el nombre de {pet.name} y tu nombre de pila. El historial clínico solo lo ven médicos
            veterinarios verificados.
          </p>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="show_phone" defaultChecked={pet.show_phone} className="size-4" />
            Mostrar mi teléfono (botones de llamar y WhatsApp)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="show_photo" defaultChecked={pet.show_photo} className="size-4" />
            Mostrar la foto de {pet.name}
          </label>
          <div className="rounded-lg border border-border p-4">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" name="lost_mode" defaultChecked={pet.lost_mode} className="size-4" />
              Modo extraviado
            </label>
            <p className="mt-1 text-muted">
              Muestra un aviso destacado y te enviamos un correo cada vez que alguien escanee la placa.
            </p>
            <div className="mt-3">
              <Field label="Mensaje para quien la encuentre (opcional)">
                <Textarea
                  name="lost_message"
                  maxLength={280}
                  defaultValue={pet.lost_message ?? ""}
                  placeholder="Se perdió cerca del parque. Necesita medicamento diario. ¡Gracias!"
                />
              </Field>
            </div>
          </div>
          <Button className="self-start">Guardar</Button>
        </form>
      </Card>
    </>
  );
}

function AccessTab({ record }: { record: PetRecord }) {
  const now = new Date();
  return (
    <>
      <Card>
        <h2 className="font-semibold">Compartir con un MVZ sin escanear</h2>
        <p className="mt-1 text-sm text-muted">
          Genera un código de 6 caracteres (válido 24 h, un solo uso). El MVZ lo captura en su panel y obtiene acceso
          por 7 días.
        </p>
        <form action={createShareCode.bind(null, record.pet.id)} className="mt-3">
          <Button variant="secondary">Generar código</Button>
        </form>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Médicos que han accedido</h2>
        {record.access.length === 0 ? (
          <p className="text-sm text-muted">Nadie ha accedido al expediente.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {record.access.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {a.profiles?.full_name ?? "MVZ"}
                  {a.profiles?.vet_profiles?.cedula ? ` · Cédula ${a.profiles.vet_profiles.cedula}` : ""}
                  {a.profiles?.vet_profiles?.clinic_name ? ` · ${a.profiles.vet_profiles.clinic_name}` : ""}
                </span>
                <span className="text-muted">
                  {a.source === "escaneo" ? "Escaneó la placa" : "Con código"} · {formatDateTime(a.granted_at)}{" "}
                  {new Date(a.expires_at) > now ? <Badge tone="brand">Vigente</Badge> : <Badge>Vencido</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Escaneos recientes de la placa</h2>
        {record.scans.length === 0 ? (
          <p className="text-sm text-muted">Sin escaneos.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border text-sm">
            {record.scans.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{s.kind === "vet" ? "MVZ" : "Persona sin cuenta"}</span>
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
