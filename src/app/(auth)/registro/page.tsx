import Link from "next/link";
import { Alert, Button, Card, Field, FlashMessages, Input, PageTitle } from "@/components/ui";
import { signUp } from "../actions";

export const metadata = { title: "Crear cuenta" };

export default async function RegistroPage({ searchParams }: PageProps<"/registro">) {
  const params = await searchParams;
  const isVet = params.tipo === "vet";

  return (
    <div className="mx-auto max-w-md">
      <PageTitle
        title="Crear cuenta"
        subtitle={isVet ? "Cuenta de médico veterinario" : "Cuenta de propietario"}
      />
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1 text-sm">
        <Link
          href="/registro"
          className={`rounded-md px-3 py-2 text-center ${!isVet ? "bg-brand-soft font-medium" : ""}`}
        >
          Propietario
        </Link>
        <Link
          href="/registro?tipo=vet"
          className={`rounded-md px-3 py-2 text-center ${isVet ? "bg-brand-soft font-medium" : ""}`}
        >
          Médico veterinario
        </Link>
      </div>
      <FlashMessages error={params.error} />
      <Card>
        <form action={signUp} className="flex flex-col gap-4">
          <input type="hidden" name="tipo" value={isVet ? "vet" : "owner"} />
          <Field label="Nombre completo" hint={isVet ? "Tal como aparece en tu cédula profesional." : undefined}>
            <Input name="full_name" required autoComplete="name" />
          </Field>
          <Field label="Correo electrónico">
            <Input name="email" type="email" required autoComplete="email" />
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
                Tu cuenta podrá consultar y escribir en expedientes cuando se verifique tu cédula.
              </Alert>
            </>
          )}
          <Field label="Contraseña" hint="Mínimo 8 caracteres.">
            <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
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
          <Button type="submit">Crear cuenta</Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/entrar" className="underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
