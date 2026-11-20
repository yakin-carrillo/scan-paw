"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { firstError, formObject, friendlyDbError, phoneSchema } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  full_name: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
  phone: phoneSchema,
});

export async function updateProfile(formData: FormData) {
  const session = await requireSession();
  const parsed = profileSchema.safeParse(formObject(formData));
  if (!parsed.success) redirect(`/cuenta?error=${encodeURIComponent(firstError(parsed.error))}`);
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone.replace(/\s/g, "") })
    .eq("id", session.userId);
  if (error) redirect(`/cuenta?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  redirect("/cuenta?ok=Datos%20actualizados");
}

async function removeFolder(admin: ReturnType<typeof createAdminClient>, bucket: string, folder: string) {
  const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
  if (data?.length) await admin.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
}

/**
 * Derecho de cancelación: borra la cuenta y las mascotas de las que el usuario
 * es el único propietario (con su expediente y archivos). Las mascotas
 * compartidas pasan a los demás copropietarios.
 */
export async function deleteAccount(formData: FormData) {
  const session = await requireSession();
  if (formData.get("confirm") !== "ELIMINAR") {
    redirect("/cuenta?error=Escribe%20ELIMINAR%20para%20confirmar");
  }
  const admin = createAdminClient();

  const { data: mine } = await admin.from("pet_owners").select("pet_id").eq("user_id", session.userId);
  const soleOwned: string[] = [];
  for (const { pet_id } of mine ?? []) {
    const { count } = await admin
      .from("pet_owners")
      .select("user_id", { count: "exact", head: true })
      .eq("pet_id", pet_id);
    if ((count ?? 0) <= 1) soleOwned.push(pet_id);
  }

  for (const petId of soleOwned) {
    await removeFolder(admin, "pet-photos", petId);
    await removeFolder(admin, "attachments", petId);
  }
  if (soleOwned.length) await admin.from("pets").delete().in("id", soleOwned);

  const { error } = await admin.auth.admin.deleteUser(session.userId);
  if (error) redirect(`/cuenta?error=${encodeURIComponent("No se pudo eliminar la cuenta: " + error.message)}`);

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?cuenta=eliminada");
}

const professionalSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("vet"),
    cedula: z.string().trim().regex(/^[0-9]{7,8}$/, "La cédula profesional tiene 7 u 8 dígitos."),
    clinic: z.string().trim().max(120).optional(),
  }),
  z.object({
    tipo: z.literal("student"),
    university: z.string().trim().min(3, "Escribe el nombre de tu universidad.").max(120),
    enrollment: z.string().trim().regex(/^[0-9A-Za-z-]{4,20}$/, "La matrícula tiene de 4 a 20 letras o números."),
  }),
]);

/** Un propietario agrega su perfil de MVZ o estudiante; conserva sus mascotas. */
export async function addProfessionalProfile(formData: FormData) {
  const session = await requireSession();
  if (session.profile.role !== "owner") redirect("/cuenta?error=Tu%20cuenta%20ya%20tiene%20un%20perfil%20profesional");
  const parsed = professionalSchema.safeParse(formObject(formData));
  if (!parsed.success) redirect(`/cuenta?error=${encodeURIComponent(firstError(parsed.error))}`);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_professional_profile", {
    p_role: d.tipo,
    p_cedula: d.tipo === "vet" ? d.cedula : null,
    p_clinic: d.tipo === "vet" ? (d.clinic ?? null) : null,
    p_university: d.tipo === "student" ? d.university : null,
    p_enrollment: d.tipo === "student" ? d.enrollment : null,
  });
  if (error) redirect(`/cuenta?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  revalidatePath("/", "layout");
  redirect(`/vet?ok=${encodeURIComponent("Perfil profesional agregado. Lo verificaremos en breve.")}`);
}
