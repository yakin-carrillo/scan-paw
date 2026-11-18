"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { escapeHtml, ownerEmails, sendEmail } from "@/lib/email";
import { friendlyDbError } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";

const tokenSchema = z.string().trim().toUpperCase().regex(/^[0-9A-Z]{6,16}$/);

/** MVZ verificado: abre el expediente por 7 días y avisa a los dueños. */
export async function vetOpenRecord(token: string) {
  const t = tokenSchema.parse(token);
  const session = await requireSession(`/p/${t}`);
  const supabase = await createClient();
  const { data: petId, error } = await supabase.rpc("vet_open_pet", { p_token: t });
  if (error || !petId) {
    redirect(`/p/${t}?error=${encodeURIComponent(friendlyDbError(error?.message))}`);
  }

  const vetName = escapeHtml(session.profile.full_name);
  const cedula = escapeHtml(session.vet?.cedula ?? "");
  await sendEmail({
    to: await ownerEmails(petId),
    subject: "Un médico veterinario abrió el expediente de tu mascota",
    html: `<p><strong>${vetName}</strong> (cédula ${cedula}) escaneó la placa y tiene acceso al expediente por 7 días.</p>
           <p>Si no reconoces este acceso, revisa la pestaña "Accesos" de tu mascota en Scan-Paw.</p>`,
  });

  redirect(`/mascotas/${petId}`);
}

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/** Quien encontró la mascota comparte su ubicación (opcional y explícito). */
export async function shareFinderLocation(token: string, coords: { latitude: number; longitude: number }) {
  const t = tokenSchema.safeParse(token);
  const c = locationSchema.safeParse(coords);
  if (!t.success || !c.success) return { ok: false };

  const admin = createAdminClient();
  const { data: tag } = await admin
    .from("tags")
    .select("id, pet_id, status, pets(name, lost_mode)")
    .eq("public_token", t.data)
    .maybeSingle();
  const pet = tag?.pets as unknown as { name: string; lost_mode: boolean } | null;
  if (!tag || tag.status !== "activa" || !tag.pet_id || !pet) return { ok: false };

  // Límite simple anti-abuso: máximo 5 ubicaciones por placa por hora.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("scan_events")
    .select("id", { count: "exact", head: true })
    .eq("tag_id", tag.id)
    .not("latitude", "is", null)
    .gte("created_at", since);
  if ((count ?? 0) >= 5) return { ok: true };

  const lat = Number(c.data.latitude.toFixed(4)); // ~11 m de precisión
  const lng = Number(c.data.longitude.toFixed(4));
  await admin.from("scan_events").insert({
    tag_id: tag.id,
    pet_id: tag.pet_id,
    kind: "publico",
    latitude: lat,
    longitude: lng,
  });

  await sendEmail({
    to: await ownerEmails(tag.pet_id),
    subject: `Alguien encontró a ${pet.name} y compartió su ubicación`,
    html: `<p>Quien escaneó la placa de <strong>${escapeHtml(pet.name)}</strong> compartió su ubicación:</p>
           <p><a href="https://maps.google.com/?q=${lat},${lng}">Ver en el mapa</a></p>`,
  });
  return { ok: true };
}
