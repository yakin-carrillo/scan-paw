import Link from "next/link";
import { Button, Card, Field, FlashMessages, Input, PageTitle } from "@/components/ui";
import { safeNext } from "@/lib/forms";
import { signIn } from "../actions";

export const metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Entrar" />
      <FlashMessages error={params.error} ok={params.ok} />
      <Card>
        <form action={signIn} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Correo electrónico">
            <Input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Contraseña">
            <Input name="password" type="password" required autoComplete="current-password" />
          </Field>
          <Button type="submit">Entrar</Button>
        </form>
      </Card>
      <div className="mt-4 flex justify-between text-sm text-muted">
        <Link href="/recuperar" className="underline">
          Olvidé mi contraseña
        </Link>
        <Link href="/registro" className="underline">
          Crear cuenta
        </Link>
      </div>
    </div>
  );
}
