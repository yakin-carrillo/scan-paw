import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert, Button, Card, Field, FlashMessages, Input, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { completeOnboarding } from "../actions";

export const metadata = { title: "Completa tu registro" };

export default async function BienvenidaPage({ searchParams }: PageProps<"/bienvenida">) {
  const params = await searchParams;
  const session = await getSession();
  if (!session) redirect("/entrar?next=/bienvenida");
  if (session.onboarded) redirect("/mascotas");

  const isVet = params.tipo === "vet";
  const next = safeNext(params.next);
  const qs = (tipo: string) => `/bienvenida?tipo=${tipo}${params.next ? `&next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Completa tu registro" subtitle={session.email ?? undefined} />
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1 text-sm">
        <Link href={qs("owner")} className={`rounded-md px-3 py-2 text-center ${!isVet ? "bg-brand-soft font-medium" : ""}`}>
          Soy propietario
        </Link>
        <Link href={qs("vet")} className={`rounded-md px-3 py-2 text-center ${isVet ? "bg-brand-soft font-medium" : ""}`}>
          Soy médico veterinario
        </Link>
      </div>
      <FlashMessages error={params.error} />
      <Card>
        <form action={completeOnboarding} className="flex flex-col gap-4">
          <input type="hidden" name="tipo" value={isVet ? "vet" : "owner"} />
          <input type="hidden" name="next" value={next} />
          <Field label="Nombre completo" hint={isVet ? "Tal como aparece en tu cédula profesional." : undefined}>
            <Input name="full_name" required autoComplete="name" defaultValue={session.profile.full_name} />
          </Field>
          <Field label="Teléfono (WhatsApp)" hint="Se mostrará en la placa de tus mascotas si lo permites.">
            <Input name="phone" type="tel" required autoComplete="tel" placeholder="55 1234 5678" />
          </Field>
          {isVet && (
            <>
              <Field label="Cédula profesional" hint="7 u 8 dígitos. La verificamos en el Registro Nacional de Profesionistas.">
                <Input name="cedula" inputMode="numeric" required pattern="[0-9]{7,8}" />
              </Field>
              <Field label="Clínica (opcional)">
                <Input name="clinic_name" />
              </Field>
              <Alert tone="warning">
                Podrás consultar y escribir en expedientes cuando se verifique tu cédula. El tipo de cuenta no se puede
                cambiar después.
              </Alert>
            </>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="privacy" required className="mt-1 size-4" />
            <span>
              Leí y acepto el{" "}
              <Link href="/privacidad" className="underline" target="_blank">
                aviso de privacidad
              </Link>{" "}
              y doy mi consentimiento para el tratamiento de mis datos personales.
            </span>
          </label>
          <Button type="submit">Continuar</Button>
        </form>
      </Card>
    </div>
  );
}
