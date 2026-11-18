import { Badge, formatDate } from "@/components/ui";
import type { RecordSource } from "@/lib/types";

/** Firma visible de cada entrada: quién la registró y si está verificada. */
export function EntryAuthor({
  source,
  authorName,
  authorCedula,
  createdAt,
}: {
  source: RecordSource;
  authorName: string | null;
  authorCedula: string | null;
  createdAt: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
      {source === "vet" ? (
        <Badge tone="brand">✓ Verificado por MVZ</Badge>
      ) : (
        <Badge tone="warning">Registrado por el propietario · no verificado</Badge>
      )}
      <span>
        {authorName ?? "Usuario eliminado"}
        {authorCedula ? ` · Cédula ${authorCedula}` : ""} · {formatDate(createdAt)}
      </span>
    </div>
  );
}
