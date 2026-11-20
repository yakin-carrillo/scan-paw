import "server-only";
import webpush from "web-push";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Lo que muestra el aviso. `url` es la ruta interna que se abre al tocarlo. */
export type PushMessage = {
  title: string;
  body: string;
  url: string;
  /** Avisos con la misma etiqueta se reemplazan en el teléfono en vez de acumularse. */
  tag?: string;
};

let configured: boolean | null = null;

function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  // El "subject" identifica al remitente ante los servicios push: debe ser https o mailto.
  const site = siteUrl();
  webpush.setVapidDetails(site.startsWith("https://") ? site : "https://scan-paw.vercel.app", publicKey, privateKey);
  configured = true;
  return true;
}

/**
 * Envía un aviso a todos los dispositivos de esos usuarios. Nunca lanza: un
 * aviso que falla no debe romper la acción que lo provocó. Borra las
 * suscripciones que el servicio push ya no reconoce (404/410).
 */
export async function notifyUsers(userIds: string[], message: PushMessage): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  if (!configure()) {
    console.info(`[aviso omitido: faltan las llaves VAPID] ${message.title} → ${ids.length} usuario(s)`);
    return;
  }
  try {
    const admin = createAdminClient();
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", ids);
    const payload = JSON.stringify(message);
    const gone: string[] = [];
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 24 * 3600, urgency: "high" },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id);
          else console.error("No se pudo enviar el aviso push", status ?? err);
        }
      }),
    );
    if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  } catch (err) {
    console.error("No se pudieron enviar los avisos push", err);
  }
}

/** Dueños de una mascota (requiere la clave secreta). */
export async function petOwnerIds(petId: string): Promise<string[]> {
  const { data } = await createAdminClient().from("pet_owners").select("user_id").eq("pet_id", petId);
  return (data ?? []).map((o) => o.user_id);
}

/** "cédula 1234567" o "estudiante de UNAM, No profesionista". */
export function clinicianCredential(session: {
  vet: { cedula: string } | null;
  student: { university: string } | null;
}): string {
  if (session.student) return `estudiante de ${session.student.university}, No profesionista`;
  return `cédula ${session.vet?.cedula ?? ""}`;
}

/** Administradores activos de una clínica (requiere la clave secreta). */
export async function clinicAdminIds(clinicId: string): Promise<string[]> {
  const { data } = await createAdminClient()
    .from("clinic_members")
    .select("user_id")
    .eq("clinic_id", clinicId)
    .eq("role", "admin")
    .eq("status", "activo");
  return (data ?? []).map((m) => m.user_id);
}
