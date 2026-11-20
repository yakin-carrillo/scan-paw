import Link from "next/link";
import { Building2, Database, ExternalLink, GraduationCap, QrCode, RotateCcw, Sparkles, Stethoscope } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardTitle,
  FlashMessages,
  formatDate,
  Input,
  PageTitle,
} from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { VerificationStatus } from "@/lib/types";
import { resetDemo, reviewAccount, reviewClinic, seedDemo } from "./actions";

export const metadata = { title: "Administración" };

const SEP_URL = "https://www.cedulaprofesional.sep.gob.mx/";

type Pending = {
  kind: "vet" | "student";
  user_id: string;
  name: string;
  phone: string | null;
  id: string;
  detail: string | null;
  status: VerificationStatus;
  created_at: string;
  duplicate: boolean;
  validatedBy: string | null;
};

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireRole(["admin"]);
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: vets }, { data: students }, { count: demoPets }, { count: pets }, { count: activeTags }, { data: clinicRows }] =
    await Promise.all([
      supabase
        .from("vet_profiles")
        .select("user_id, cedula, clinic_name, status, created_at, profiles!vet_profiles_user_id_fkey(full_name, phone), clinics!vet_profiles_validated_by_clinic_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("student_profiles")
        .select("user_id, university, enrollment_id, status, created_at, profiles!student_profiles_user_id_fkey(full_name, phone), clinics!student_profiles_validated_by_clinic_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("pets").select("id", { count: "exact", head: true }).like("microchip", "DEMO-%"),
      supabase.from("pets").select("id", { count: "exact", head: true }),
      supabase.from("tags").select("id", { count: "exact", head: true }).eq("status", "activa"),
      supabase
        .from("clinics")
        .select("id, name, address, phone, rfc, status, plan_status, created_at, profiles!clinics_created_by_fkey(full_name, phone)")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  type P = { full_name: string; phone: string | null } | null;
  const vetRows = (vets ?? []) as unknown as {
    user_id: string; cedula: string; clinic_name: string | null; status: VerificationStatus; created_at: string; profiles: P;
    clinics: { name: string } | null;
  }[];
  const studentRows = (students ?? []) as unknown as {
    user_id: string; university: string; enrollment_id: string; status: VerificationStatus; created_at: string; profiles: P;
    clinics: { name: string } | null;
  }[];
  const cedulaCount = new Map<string, number>();
  vetRows.forEach((v) => cedulaCount.set(v.cedula, (cedulaCount.get(v.cedula) ?? 0) + 1));

  const all: Pending[] = [
    ...vetRows.map((v) => ({
      kind: "vet" as const,
      user_id: v.user_id,
      name: v.profiles?.full_name ?? "",
      phone: v.profiles?.phone ?? null,
      id: v.cedula,
      detail: v.clinic_name,
      status: v.status,
      created_at: v.created_at,
      duplicate: (cedulaCount.get(v.cedula) ?? 0) > 1,
      validatedBy: v.clinics?.name ?? null,
    })),
    ...studentRows.map((s) => ({
      kind: "student" as const,
      user_id: s.user_id,
      name: s.profiles?.full_name ?? "",
      phone: s.profiles?.phone ?? null,
      id: s.enrollment_id,
      detail: s.university,
      status: s.status,
      created_at: s.created_at,
      duplicate: false,
      validatedBy: s.clinics?.name ?? null,
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const pending = all.filter((r) => r.status === "pending");
  const reviewed = all.filter((r) => r.status !== "pending");
  const seeded = typeof query.placa === "string";
  type ClinicRow = {
    id: string; name: string; address: string | null; phone: string | null; rfc: string | null;
    status: "pendiente" | "verificada" | "rechazada"; plan_status: string; created_at: string;
    profiles: { full_name: string; phone: string | null } | null;
  };
  const clinicList = (clinicRows ?? []) as unknown as ClinicRow[];
  const pendingClinics = clinicList.filter((c) => c.status === "pendiente");
  const otherClinics = clinicList.filter((c) => c.status !== "pendiente");

  return (
    <>
      <PageTitle
        eyebrow="Administración"
        title="Panel de control"
        actions={
          <ButtonLink href="/admin/placas" variant="secondary">
            <QrCode aria-hidden /> Placas
          </ButtonLink>
        }
      />
      <FlashMessages error={query.error} ok={query.ok} />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Mascotas", pets ?? 0],
          ["Placas activas", activeTags ?? 0],
          ["Cuentas por verificar", pending.length],
          ["Clínicas por verificar", pendingClinics.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
            <p className="font-display text-3xl font-semibold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <h2 className="mb-1 text-lg font-semibold">Cuentas por verificar ({pending.length})</h2>
          <p className="mb-4 text-sm text-muted">
            MVZ: busca la cédula en el{" "}
            <Link href={SEP_URL} target="_blank" className="inline-flex items-center gap-1 underline">
              Registro Nacional de Profesionistas <ExternalLink aria-hidden className="size-3" />
            </Link>{" "}
            y confirma nombre y carrera. Estudiantes: pide credencial o constancia vigente.
          </p>
          {pending.length === 0 && <p className="text-sm text-muted">No hay solicitudes pendientes.</p>}
          <ul className="flex flex-col gap-3">
            {pending.map((v) => (
              <li key={v.user_id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    {v.kind === "vet" ? (
                      <Stethoscope aria-hidden className="size-4 text-brand" />
                    ) : (
                      <GraduationCap aria-hidden className="size-4 text-warning" />
                    )}
                    <h3 className="font-semibold">{v.name}</h3>
                    <Badge tone={v.kind === "vet" ? "brand" : "warning"}>
                      {v.kind === "vet" ? `Cédula ${v.id}` : `Matrícula ${v.id}`}
                    </Badge>
                    {v.duplicate && <Badge tone="danger">Cédula repetida</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {v.detail ?? (v.kind === "vet" ? "Sin clínica" : "")} · {v.phone ?? "sin teléfono"} · solicitada el{" "}
                    {formatDate(v.created_at)}
                  </p>
                  <form action={reviewAccount} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="user" value={v.user_id} />
                    <input type="hidden" name="kind" value={v.kind} />
                    <Input name="note" placeholder="Nota (obligatoria si rechazas)" className="max-w-xs" maxLength={300} />
                    <Button name="status" value="approved">
                      Aprobar
                    </Button>
                    <Button name="status" value="rejected" variant="danger" confirm={`¿Rechazar la solicitud de ${v.name}?`}>
                      Rechazar
                    </Button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>

          <h2 className="mt-8 mb-1 flex items-center gap-2 text-lg font-semibold">
            <Building2 aria-hidden className="size-5 text-brand" /> Clínicas por verificar ({pendingClinics.length})
          </h2>
          <p className="mb-4 text-sm text-muted">
            Una clínica verificada puede validar a sus MVZ para toda la red. Confirma que exista (RFC, dirección,
            teléfono) y que quien la registró la represente.
          </p>
          {pendingClinics.length === 0 && <p className="text-sm text-muted">No hay clínicas pendientes.</p>}
          <ul className="flex flex-col gap-3">
            {pendingClinics.map((c) => (
              <li key={c.id}>
                <Card>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{c.name}</h3>
                    {c.rfc && <Badge tone="brand">RFC {c.rfc}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {[c.address, c.phone].filter(Boolean).join(" · ") || "Sin dirección ni teléfono"} · registrada el{" "}
                    {formatDate(c.created_at)}
                  </p>
                  <p className="text-sm text-muted">
                    Responsable: {c.profiles?.full_name ?? "—"}
                    {c.profiles?.phone ? ` · ${c.profiles.phone}` : ""}
                  </p>
                  <form action={reviewClinic} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="clinic" value={c.id} />
                    <Input name="note" placeholder="Nota (obligatoria si rechazas)" className="max-w-xs" maxLength={300} />
                    <Button name="status" value="verificada">
                      Verificar
                    </Button>
                    <Button name="status" value="rechazada" variant="danger" confirm={`¿Rechazar la clínica ${c.name}?`}>
                      Rechazar
                    </Button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
          {otherClinics.length > 0 && (
            <ul className="mt-3 flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface text-sm shadow-card">
              {otherClinics.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span>{c.name}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone={c.status === "verificada" ? "verified" : "danger"}>{c.status}</Badge>
                    <Badge>{c.plan_status === "sin_plan" ? "sin plan" : `plan ${c.plan_status}`}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 mb-3 text-lg font-semibold">Revisadas</h2>
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface text-sm shadow-card">
            {reviewed.map((v) => (
              <li key={`${v.kind}-${v.user_id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0">
                  {v.name} · {v.kind === "vet" ? `Cédula ${v.id}` : `Estudiante, ${v.detail}`}
                  {v.validatedBy && <span className="block text-xs text-muted">Validado por {v.validatedBy}</span>}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={v.status === "approved" ? "verified" : "danger"}>
                    {v.status === "approved" ? "Aprobada" : "Rechazada"}
                  </Badge>
                  {v.status === "approved" && (
                    <form action={reviewAccount}>
                      <input type="hidden" name="user" value={v.user_id} />
                      <input type="hidden" name="kind" value={v.kind} />
                      <input type="hidden" name="note" value="Verificación revocada por Scan-Paw" />
                      <Button
                        name="status"
                        value="rejected"
                        variant="ghost"
                        className="min-h-8 px-2 text-xs text-danger"
                        confirm={`¿Revocar la verificación de ${v.name}? Dejará de abrir expedientes.`}
                      >
                        Revocar
                      </Button>
                    </form>
                  )}
                </span>
              </li>
            ))}
            {reviewed.length === 0 && <li className="px-4 py-2.5 text-muted">Ninguna todavía.</li>}
          </ul>
        </section>

        <Card className="h-fit">
          <CardTitle
            icon={Sparkles}
            title="Datos de demostración"
            tone="accent"
            subtitle="Crea a Luna (perro) y Michi (gato) en tu cuenta con vacunas, alergias, consultas, peso, un estudio en PDF, una placa activa y otra lista para activar en vivo."
          />
          {seeded && (
            <div className="mb-4">
              <Alert tone="success" title="Para la demo">
                <p>
                  Placa de Luna:{" "}
                  <Link className="font-mono font-semibold underline" href={`/p/${query.placa}`} target="_blank">
                    {query.placa}
                  </Link>
                </p>
                <p>
                  Placa nueva: <span className="font-mono font-semibold">{query.nueva}</span> · código{" "}
                  <span className="font-mono font-semibold">{query.codigo}</span>
                </p>
                <p className="mt-1 text-xs">Descarga los QR en Placas, lote &quot;demo&quot;.</p>
              </Alert>
            </div>
          )}
          <p className="mb-3 text-sm text-muted">
            {demoPets ? `Hay ${demoPets} mascotas de demostración cargadas.` : "No hay datos de demostración cargados."} Volver a
            cargarlos reemplaza los anteriores.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={seedDemo}>
              <Button>
                <Database aria-hidden /> {demoPets ? "Restablecer demo" : "Cargar demo"}
              </Button>
            </form>
            {Boolean(demoPets) && (
              <form action={resetDemo}>
                <Button variant="ghost" className="text-danger" confirm="¿Borrar las mascotas y placas de demostración?">
                  <RotateCcw aria-hidden /> Borrar demo
                </Button>
              </form>
            )}
            <ButtonLink href="/admin/placas?lote=demo" variant="secondary">
              <QrCode aria-hidden /> QR de la demo
            </ButtonLink>
          </div>
        </Card>
      </div>
    </>
  );
}
