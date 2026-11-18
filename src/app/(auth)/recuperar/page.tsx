import { Button, Card, Field, FlashMessages, Input, PageTitle } from "@/components/ui";
import { requestPasswordReset } from "../actions";

export const metadata = { title: "Recuperar contraseña" };

export default async function RecuperarPage({ searchParams }: PageProps<"/recuperar">) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Recuperar contraseña" subtitle="Te enviaremos un enlace para crear una nueva." />
      <FlashMessages error={params.error} ok={params.ok} />
      <Card>
        <form action={requestPasswordReset} className="flex flex-col gap-4">
          <Field label="Correo electrónico">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Button type="submit">Enviar enlace</Button>
        </form>
      </Card>
    </div>
  );
}
