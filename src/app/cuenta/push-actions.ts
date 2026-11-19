"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { notifyUsers } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** Guarda el dispositivo donde el usuario activó los avisos. */
export async function savePushSubscription(input: unknown, userAgent: string) {
  const session = await requireSession();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const s = parsed.data;
  // Con la clave secreta: si otra cuenta usó antes este teléfono, el dispositivo pasa a la sesión actual.
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .upsert(
      {
        user_id: session.userId,
        endpoint: s.endpoint,
        p256dh: s.keys.p256dh,
        auth: s.keys.auth,
        user_agent: userAgent.slice(0, 300) || null,
      },
      { onConflict: "endpoint" },
    );
  if (error) console.error("No se pudo guardar la suscripción push", error.message);
  return { ok: !error };
}

/** Quita el dispositivo (al desactivar los avisos). */
export async function deletePushSubscription(endpoint: string) {
  await requireSession();
  if (typeof endpoint !== "string") return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: !error };
}

/** Aviso de prueba a todos los dispositivos de la cuenta. */
export async function sendTestPush() {
  const session = await requireSession();
  await notifyUsers([session.userId], {
    title: "Los avisos funcionan",
    body: "Así te avisaremos si alguien escanea la placa de tu mascota, de sus vacunas y de sus citas.",
    url: "/cuenta",
  });
  return { ok: true };
}
