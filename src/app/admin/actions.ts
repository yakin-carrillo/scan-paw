"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { demoLabPdf } from "@/lib/demo-pdf";
import { notifyUsers } from "@/lib/push";
import { friendlyDbError } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const reviewSchema = z.object({
  user: z.uuid(),
  kind: z.enum(["vet", "student"]),
  status: z.enum(["approved", "rejected"]),
  note: z.string().max(300).optional(),
});

/** Aprueba o rechaza una cédula (MVZ) o una matrícula (estudiante). */
export async function reviewAccount(formData: FormData) {
  await requireRole(["admin"]);
  const parsed = reviewSchema.safeParse({
    user: formData.get("user"),
    kind: formData.get("kind"),
    status: formData.get("status"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) redirect("/admin?error=Datos%20no%20v%C3%A1lidos");
  const d = parsed.data;
  if (d.status === "rejected" && !d.note?.trim()) redirect("/admin?error=Escribe%20el%20motivo%20del%20rechazo");

  const supabase = await createClient();
  const { error } = await supabase.rpc(d.kind === "vet" ? "admin_review_vet" : "admin_review_student", {
    p_user: d.user,
    p_status: d.status,
    p_note: d.note ?? "",
  });
  if (error) redirect(`/admin?error=${encodeURIComponent(friendlyDbError(error.message))}`);

  const what = d.kind === "vet" ? "tu cédula" : "tu cuenta de estudiante";
  await notifyUsers([d.user], {
    title: d.status === "approved" ? `Verificamos ${what}` : `No pudimos verificar ${what}`,
    body:
      d.status === "approved"
        ? "Ya puedes abrir expedientes escaneando las placas Scan-Paw."
        : `Motivo: ${d.note || "sin especificar"}`,
    url: "/vet",
  });
  revalidatePath("/admin");
  redirect("/admin?ok=Revisi%C3%B3n%20guardada");
}

type SeedResult = { luna: string; michi: string; luna_tag: string; new_tag: string; new_code: string };

/** Carga (o vuelve a cargar) las mascotas de ejemplo en la cuenta del administrador. */
export async function seedDemo() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const admin = createAdminClient();

  // Borra los archivos de la demo anterior antes de que se borren las mascotas.
  const { data: old } = await supabase.from("pets").select("id").like("microchip", "DEMO-%");
  const oldPaths = (old ?? []).map((p) => `${p.id}/demo-hemograma.pdf`);
  if (oldPaths.length) await admin.storage.from("attachments").remove(oldPaths);

  const { data, error } = await supabase.rpc("admin_seed_demo");
  if (error || !data) redirect(`/admin?error=${encodeURIComponent(friendlyDbError(error?.message))}`);
  const r = data as SeedResult;

  const { error: upErr } = await admin.storage
    .from("attachments")
    .upload(`${r.luna}/demo-hemograma.pdf`, demoLabPdf("Luna"), { contentType: "application/pdf", upsert: true });
  if (upErr) console.error("No se pudo subir el PDF de demo", upErr.message);

  revalidatePath("/mascotas");
  const qs = new URLSearchParams({
    ok: "Datos de demostración listos: Luna y Michi están en Mis mascotas.",
    placa: r.luna_tag,
    nueva: r.new_tag,
    codigo: r.new_code,
  });
  redirect(`/admin?${qs}`);
}

export async function resetDemo() {
  await requireRole(["admin"]);
  const supabase = await createClient();
  const { data: old } = await supabase.from("pets").select("id").like("microchip", "DEMO-%");
  const oldPaths = (old ?? []).map((p) => `${p.id}/demo-hemograma.pdf`);
  if (oldPaths.length) await createAdminClient().storage.from("attachments").remove(oldPaths);
  const { error } = await supabase.rpc("admin_reset_demo");
  if (error) redirect(`/admin?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  revalidatePath("/mascotas");
  redirect("/admin?ok=Datos%20de%20demostraci%C3%B3n%20eliminados");
}
