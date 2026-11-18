import { ButtonLink, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <h1 className="text-xl font-semibold">No encontrado</h1>
      <p className="mt-2 text-sm text-muted">
        La página no existe o no tienes permiso para verla.
      </p>
      <ButtonLink href="/" className="mt-4">
        Ir al inicio
      </ButtonLink>
    </Card>
  );
}
