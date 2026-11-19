import Link from "next/link";
import { PushSettings } from "@/components/push-toggle";
import { Alert, Badge, Button, ButtonLink, Card, Field, FlashMessages, Input, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { deleteAccount, updateProfile } from "./actions";

export const metadata = { title: "Mi cuenta" };

const roleLabel = { owner: "Propietario", vet: "Médico veterinario", student: "Estudiante", admin: "Administrador" };

export default async function CuentaPage({ searchParams }: PageProps<"/cuenta">) {
  const session = await requireSession("/cuenta");
  const query = await searchParams;
  const { profile, vet, student } = session;

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
        <h2 className="font-semibold">Avisos</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          {profile.role === "vet" || profile.role === "student"
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
