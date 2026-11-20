import Link from "next/link";
import { Building2, Stethoscope } from "lucide-react";
import { CalendarLinks } from "@/app/clinica/calendar-links";
import { PushSettings } from "@/components/push-toggle";
import { Alert, Badge, Button, ButtonLink, Card, Field, FlashMessages, Input, PageTitle, Select } from "@/components/ui";
import { buildSpaces } from "@/lib/spaces";
import { requireSession } from "@/lib/auth";
import { addProfessionalProfile, deleteAccount, updateProfile } from "./actions";

export const metadata = { title: "Mi cuenta" };

const roleLabel = { owner: "Propietario", vet: "Médico veterinario", student: "Estudiante", admin: "Administrador" };

export default async function CuentaPage({ searchParams }: PageProps<"/cuenta">) {
  const session = await requireSession("/cuenta");
  const query = await searchParams;
  const { profile, vet, student } = session;
  const spaces = buildSpaces(session);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageTitle eyebrow="Cuenta" title={profile.full_name || "Mi cuenta"} subtitle={session.email ?? undefined} />
      <FlashMessages error={query.error} ok={query.ok} />

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone="brand">{roleLabel[profile.role]}</Badge>
          {vet && (
            <Badge tone={vet.status === "approved" ? "verified" : vet.status === "rejected" ? "danger" : "warning"}>
              Cédula {vet.cedula}:{" "}
              {vet.status === "approved" ? "verificada" : vet.status === "rejected" ? "rechazada" : "en revisión"}
            </Badge>
          )}
          {student && (
            <Badge tone={student.status === "approved" ? "warning" : student.status === "rejected" ? "danger" : "neutral"}>
              {student.university} · {student.status === "approved" ? "verificado, No profesionista" : student.status === "rejected" ? "rechazado" : "en revisión"}
            </Badge>
          )}
        </div>
        <form action={updateProfile} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre completo">
            <Input name="full_name" required defaultValue={profile.full_name} />
          </Field>
          <Field label="Teléfono">
            <Input name="phone" type="tel" required defaultValue={profile.phone ?? ""} />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button>Guardar</Button>
          </div>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold">Tus espacios</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Cambia entre ellos desde el indicador junto al logo. Cada espacio muestra solo lo que necesitas.
        </p>
        <ul className="flex flex-wrap gap-2">
          {spaces.map((s) => (
            <li key={s.id}>
              <ButtonLink href={s.home} variant="secondary" className="min-h-10">
                {s.label}
                {s.detail ? ` · ${s.detail}` : ""}
              </ButtonLink>
            </li>
          ))}
        </ul>

        {profile.role === "owner" && (
          <details className="mt-5 rounded-xl border border-border p-4 text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
              <Stethoscope aria-hidden className="size-4 text-verified" /> Soy MVZ o estudiante
            </summary>
            <p className="mt-2 text-muted">
              Agrega tu perfil profesional para abrir expedientes. Conservas tus mascotas y lo verificamos antes de
              activarlo.
            </p>
            <form action={addProfessionalProfile} className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                <Select name="tipo" defaultValue="vet">
                  <option value="vet">Médico veterinario (cédula)</option>
                  <option value="student">Estudiante de MVZ</option>
                </Select>
              </Field>
              <Field label="Cédula profesional" hint="Solo MVZ: 7 u 8 dígitos.">
                <Input name="cedula" inputMode="numeric" maxLength={8} />
              </Field>
              <Field label="Universidad" hint="Solo estudiantes.">
                <Input name="university" maxLength={120} />
              </Field>
              <Field label="Matrícula" hint="Solo estudiantes.">
                <Input name="enrollment" maxLength={20} />
              </Field>
              <div className="sm:col-span-2">
                <Button variant="secondary">Agregar perfil profesional</Button>
              </div>
            </form>
          </details>
        )}

        {!session.clinic && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-4 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <Building2 aria-hidden className="size-4 shrink-0 text-brand" />
              <span>¿Administras una clínica veterinaria?</span>
            </span>
            <ButtonLink href="/clinica/registrar" variant="secondary" className="min-h-10">
              Registrar mi clínica
            </ButtonLink>
          </div>
        )}
      </Card>

      {session.clinic?.memberStatus === "activo" && (
        <Card>
          <h2 className="font-semibold">Calendario</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            Suscríbete a tus citas en Google Calendar o Calendario de Apple. Solo incluye mascota, motivo y MVZ.
          </p>
          <CalendarLinks back="/cuenta" />
        </Card>
      )}

      <Card>
        <h2 className="font-semibold">Avisos</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          {session.isClinician
            ? "Te avisamos cuando se verifique tu cuenta, de tus citas y si una familia retira tu acceso."
            : "Te avisamos si alguien escanea la placa de tu mascota, cuando un MVZ abre su expediente y de sus vacunas y citas."}
        </p>
        <PushSettings />
      </Card>

      <Card>
        <h2 className="font-semibold">Mis datos</h2>
        <p className="mt-1 text-sm text-muted">
          Tú eres dueño de la información de tus mascotas. Descarga una copia completa en formato JSON.
        </p>
        <ButtonLink href="/cuenta/exportar" variant="secondary" className="mt-3" prefetch={false}>
          Descargar mis datos
        </ButtonLink>
        <p className="mt-3 text-xs text-muted">
          Consulta el <Link href="/privacidad" className="underline">aviso de privacidad</Link> para ejercer tus
          derechos ARCO.
        </p>
      </Card>

      <form action="/salir" method="post">
        <Button variant="secondary" className="w-full sm:w-auto">
          Cerrar sesión
        </Button>
      </form>

      <Card>
        <h2 className="font-semibold text-danger">Eliminar cuenta</h2>
        <div className="mt-2">
          <Alert tone="warning">
            Se eliminan tu cuenta y las mascotas de las que eres el único propietario, con su expediente y archivos.
            No se puede deshacer.
          </Alert>
        </div>
        <form action={deleteAccount} className="mt-3 flex flex-wrap items-end gap-2">
          <Field label='Escribe "ELIMINAR" para confirmar'>
            <Input name="confirm" autoComplete="off" />
          </Field>
          <Button variant="danger">Eliminar definitivamente</Button>
        </form>
      </Card>
    </div>
  );
}
