import { redirect } from "next/navigation";
import { Building2, Check } from "lucide-react";
import { BackLink, Button, Card, CardTitle, Field, FlashMessages, Input, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { CLINIC_FEATURES } from "@/lib/plans";
import { registerClinic } from "../actions";

export const metadata = { title: "Registrar mi clínica" };

export default async function RegistrarClinicaPage({ searchParams }: PageProps<"/clinica/registrar">) {
  const session = await requireSession("/clinica/registrar");
  if (session.clinic?.isAdmin) redirect("/clinica");
  const query = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/cuenta">Mi cuenta</BackLink>
      <PageTitle
        eyebrow="Para negocios"
        title="Registrar mi clínica"
        subtitle="Administra a tu equipo y la agenda de todos tus MVZ en un solo lugar."
      />
      <FlashMessages error={query.error} ok={query.ok} />
      {session.clinic ? (
        <Card>
          <p className="text-sm">
            Ya perteneces a <span className="font-semibold">{session.clinic.name}</span>. Para registrar otra clínica,
            primero pide que te den de baja.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardTitle icon={Building2} title="Datos de la clínica" subtitle="Los revisamos antes de activar las funciones de clínica." />
            <form action={registerClinic} className="flex flex-col gap-4">
              <Field label="Nombre comercial">
                <Input name="name" required minLength={3} maxLength={120} placeholder="Clínica Veterinaria del Valle" />
              </Field>
              <Field label="Dirección (opcional)">
                <Input name="address" maxLength={200} autoComplete="street-address" />
              </Field>
              <Field label="Teléfono de la clínica (opcional)">
                <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" />
              </Field>
              <Field label="RFC (opcional)" hint="Ayuda a verificar la clínica más rápido.">
                <Input name="rfc" maxLength={13} className="uppercase" autoCapitalize="characters" />
              </Field>
              <Button size="lg">Registrar clínica</Button>
            </form>
          </Card>
          <Card className="h-fit text-sm">
            <h2 className="font-semibold">Qué incluye</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {CLINIC_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" /> {f}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">
              Quedarás como administrador. Gestionas el equipo y las citas, pero no ves expedientes clínicos.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
