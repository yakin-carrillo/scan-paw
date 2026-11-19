"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink, EmptyState } from "@/components/ui";

/** Error inesperado en una página: se puede reintentar sin perder la sesión. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <div className="mx-auto max-w-md">
      <EmptyState
        icon={TriangleAlert}
        title="Algo salió mal"
        text={
          <>
            No pudimos cargar esta página. Revisa tu conexión e inténtalo de nuevo.
            {digest && <span className="mt-2 block font-mono text-xs">Referencia: {digest}</span>}
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={() => retry()}>
              <RotateCcw aria-hidden /> Reintentar
            </Button>
            <ButtonLink href="/" variant="secondary">
              Ir al inicio
            </ButtonLink>
          </div>
        }
      />
    </div>
  );
}
