import { Button, Card, Field, FlashMessages, Input, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { updatePassword } from "../actions";

export const metadata = { title: "Cambiar contraseña" };

export default async function ContrasenaPage({ searchParams }: PageProps<"/cuenta/contrasena">) {
  await requireSession("/cuenta/contrasena");
  const query = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Nueva contraseña" />
      <FlashMessages error={query.error} />
      <Card>
        <form action={updatePassword} className="flex flex-col gap-4">
          <Field label="Contraseña nueva" hint="Mínimo 8 caracteres.">
            <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Confirmar contraseña">
            <Input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Button>Guardar</Button>
        </form>
      </Card>
    </div>
  );
}
