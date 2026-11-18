import { BadgeCheck, GraduationCap, User } from "lucide-react";
import { Badge, formatDate } from "@/components/ui";
import type { RecordSource } from "@/lib/types";

/** Firma visible de cada entrada: quién la registró y con qué respaldo. */
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
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted">
      {source === "vet" ? (
        <Badge tone="brand">
          <BadgeCheck aria-hidden /> Registrado por MVZ
        </Badge>
      ) : source === "estudiante" ? (
        <Badge tone="warning">
          <GraduationCap aria-hidden /> Estudiante · No profesionista
        </Badge>
      ) : (
        <Badge>
          <User aria-hidden /> Propietario · sin verificar
        </Badge>
      )}
      <span>
        {authorName ?? "Usuario eliminado"}
        {authorCedula ? ` · Cédula ${authorCedula}` : ""} · {formatDate(createdAt)}
      </span>
    </div>
  );
}
