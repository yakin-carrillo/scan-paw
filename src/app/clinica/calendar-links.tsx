import { CalendarPlus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { rotateCalendarLinks } from "./actions";

/**
 * Enlaces privados de suscripción (.ics). Quien tenga el enlace ve la agenda
 * (nombre de la mascota, motivo y MVZ; nada del expediente), por eso se
 * pueden renovar.
 */
export async function CalendarLinks({ back }: { back: "/clinica" | "/cuenta" }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_calendar_links");
  const links = (data ?? {}) as { member?: string | null; clinic?: string | null };
  const rows = [
    links.clinic ? { label: "Toda la clínica", token: links.clinic } : null,
    links.member ? { label: "Solo mis citas", token: links.member } : null,
  ].filter((r): r is { label: string; token: string } => Boolean(r));
  if (!rows.length) return <p className="text-sm text-muted">Disponible para miembros activos de una clínica.</p>;

  const host = siteUrl().replace(/^https?:\/\//, "");
  return (
    <div className="flex flex-col gap-3 text-sm">
      {rows.map((r) => {
        const https = `${siteUrl()}/api/calendario/${r.token}.ics`;
        return (
          <div key={r.label} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
            <span className="font-medium">{r.label}</span>
            <span className="flex flex-wrap gap-1.5">
              <ButtonLink href={`webcal://${host}/api/calendario/${r.token}.ics`} variant="secondary" className="min-h-9 px-3 text-xs">
                <CalendarPlus aria-hidden /> Suscribirme
              </ButtonLink>
              <CopyButton value={https} />
            </span>
          </div>
        );
      })}
      <form action={rotateCalendarLinks.bind(null, back)}>
        <Button
          variant="ghost"
          className="min-h-9 px-3 text-xs text-muted"
          confirm="¿Renovar los enlaces? Los calendarios suscritos con el enlace anterior dejarán de actualizarse."
        >
          Renovar enlaces
        </Button>
      </form>
    </div>
  );
}
