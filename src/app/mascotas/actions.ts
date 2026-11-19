"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { firstError, formObject, friendlyDbError, optionalDate, optionalText } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const uuid = z.uuid();
/** Nombre de archivo que generan los cargadores del navegador (crypto.randomUUID()). */
const UUID_FILE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

function back(petId: string, tab: string, params: { error?: string; ok?: string }): never {
  const qs = new URLSearchParams({ tab, ...params });
  redirect(`/mascotas/${petId}?${qs.toString()}`);
}

const petSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre de la mascota.").max(60),
  species: z.enum(["perro", "gato"], { error: "Elige perro o gato." }),
  breed: optionalText(80),
  sex: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["macho", "hembra"]).optional()),
  birth_date: optionalDate,
  color: optionalText(80),
  sterilized: z.preprocess((v) => (v === "" || v == null ? undefined : v === "si"), z.boolean().optional()),
  microchip: optionalText(30),
});

function petValues(data: z.infer<typeof petSchema>) {
  return {
    name: data.name,
    species: data.species,
    breed: data.breed ?? null,
    sex: data.sex ?? null,
    birth_date: data.birth_date ?? null,
    color: data.color ?? null,
    sterilized: data.sterilized ?? null,
    microchip: data.microchip ?? null,
  };
}

export async function createPet(formData: FormData) {
  const session = await requireSession();
  const parsed = petSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    redirect(`/mascotas/nueva?error=${encodeURIComponent(firstError(parsed.error))}`);
  }
  const id = crypto.randomUUID();
  const supabase = await createClient();
  // Sin .select(): evita RETURNING antes de que exista la fila en pet_owners.
  const { error } = await supabase
    .from("pets")
    .insert({ id, created_by: session.userId, ...petValues(parsed.data) });
  if (error) {
    redirect(`/mascotas/nueva?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  }
  revalidatePath("/mascotas");
  redirect(`/mascotas/${id}?ok=${encodeURIComponent("Mascota registrada. Ahora activa su placa.")}`);
}

export async function updatePet(petId: string, formData: FormData) {
  uuid.parse(petId);
  const parsed = petSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    redirect(`/mascotas/${petId}/editar?error=${encodeURIComponent(firstError(parsed.error))}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.from("pets").update(petValues(parsed.data)).eq("id", petId);
  if (error) {
    redirect(`/mascotas/${petId}/editar?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  }
  revalidatePath(`/mascotas/${petId}`);
  back(petId, "identificacion", { ok: "Datos actualizados." });
}

export async function updatePublicSettings(petId: string, formData: FormData) {
  uuid.parse(petId);
  const lostMessage = String(formData.get("lost_message") ?? "").trim().slice(0, 280);
  const supabase = await createClient();
  const { data: pet } = await supabase.from("pets").select("status").eq("id", petId).maybeSingle();
  const { error } = await supabase
    .from("pets")
    .update({
      lost_mode: pet?.status === "activo" && formData.get("lost_mode") === "on",
      lost_message: lostMessage || null,
      show_phone: formData.get("show_phone") === "on",
      show_photo: formData.get("show_photo") === "on",
    })
    .eq("id", petId);
  if (error) back(petId, "placa", { error: friendlyDbError(error.message) });
  revalidatePath(`/mascotas/${petId}`);
  back(petId, "placa", { ok: "Configuración de la placa guardada." });
}

export async function markDeceased(petId: string, formData: FormData) {
  uuid.parse(petId);
  if (formData.get("confirm") !== "on") {
    back(petId, "identificacion", { error: "Confirma la casilla para continuar." });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("pets")
    .update({ status: "fallecido", deceased_at: new Date().toISOString().slice(0, 10), lost_mode: false })
    .eq("id", petId);
  if (error) back(petId, "identificacion", { error: friendlyDbError(error.message) });
  revalidatePath(`/mascotas/${petId}`);
  back(petId, "identificacion", { ok: "Lamentamos tu pérdida. El historial se conserva." });
}

/** Se llama después de subir la foto desde el navegador directo a Storage. */
export async function setPetPhoto(petId: string, path: string) {
  uuid.parse(petId);
  if (typeof path !== "string" || !new RegExp(`^${petId}/${UUID_FILE}[.]jpg$`).test(path)) {
    return { error: "Ruta de foto no válida." };
  }
  const supabase = await createClient();
  const { data: pet } = await supabase.from("pets").select("photo_path").eq("id", petId).maybeSingle();
  const { error } = await supabase.from("pets").update({ photo_path: path }).eq("id", petId);
  if (error) return { error: friendlyDbError(error.message) };
  if (pet?.photo_path && pet.photo_path !== path) {
    await supabase.storage.from("pet-photos").remove([pet.photo_path]);
  }
  revalidatePath(`/mascotas/${petId}`);
  return { error: null };
}

// --------------------------- Expediente ---------------------------

const vaccineSchema = z.object({
  vaccine: z.string().trim().min(1, "Escribe el nombre de la vacuna.").max(120),
  applied_on: z.iso.date({ error: "Indica la fecha de aplicación." }),
  next_due: optionalDate,
  batch_number: optionalText(60),
  notes: optionalText(500),
  amends_id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
});

export async function addVaccination(petId: string, formData: FormData) {
  uuid.parse(petId);
  const parsed = vaccineSchema.safeParse(formObject(formData));
  if (!parsed.success) back(petId, "vacunas", { error: firstError(parsed.error) });
  const d = parsed.data;
  if (d.next_due && d.next_due < d.applied_on) {
    back(petId, "vacunas", { error: "La próxima dosis no puede ser anterior a la aplicación." });
  }
  const supabase = await createClient();
  // source/autor los asigna un trigger en la base de datos.
  const { error } = await supabase.from("vaccinations").insert({
    pet_id: petId,
    vaccine: d.vaccine,
    applied_on: d.applied_on,
    next_due: d.next_due ?? null,
    batch_number: d.batch_number ?? null,
    notes: d.notes ?? null,
    amends_id: d.amends_id ?? null,
    source: "propietario",
  });
  if (error) back(petId, "vacunas", { error: friendlyDbError(error.message) });
  revalidatePath(`/mascotas/${petId}`);
  back(petId, "vacunas", { ok: d.amends_id ? "Corrección registrada." : "Vacuna registrada." });
}

const conditionSchema = z.object({
  kind: z.enum(["alergia", "cronica"]),
  description: z.string().trim().min(1, "Describe la alergia o el padecimiento.").max(500),
  severity: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["leve", "moderada", "grave"]).optional()),
  active: z.preprocess((v) => v !== "no", z.boolean()),
  notes: optionalText(500),
  amends_id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
});

export async function addCondition(petId: string, formData: FormData) {
  uuid.parse(petId);
  const parsed = conditionSchema.safeParse(formObject(formData));
  if (!parsed.success) back(petId, "condiciones", { error: firstError(parsed.error) });
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("conditions").insert({
    pet_id: petId,
    kind: d.kind,
    description: d.description,
    severity: d.severity ?? null,
    active: d.active,
    notes: d.notes ?? null,
    amends_id: d.amends_id ?? null,
    source: "propietario",
  });
  if (error) back(petId, "condiciones", { error: friendlyDbError(error.message) });
  revalidatePath(`/mascotas/${petId}`);
  back(petId, "condiciones", { ok: d.amends_id ? "Actualización registrada." : "Registro agregado." });
}

const attachmentSchema = z.object({
  kind: z.enum(["estudio", "receta", "otro"]),
  title: z.string().trim().min(1).max(120),
  path: z.string().min(1),
  mime: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  size: z.number().int().positive().max(5 * 1024 * 1024),
  notes: z.string().trim().max(500).optional(),
});

/** Registra un anexo ya subido a Storage desde el navegador. */
export async function registerAttachment(petId: string, input: z.input<typeof attachmentSchema>) {
  uuid.parse(petId);
  const parsed = attachmentSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (!new RegExp(`^${petId}/${UUID_FILE}[.](pdf|jpg|png|webp)$`).test(d.path)) {
    return { error: "Ruta de archivo no válida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("attachments").insert({
    pet_id: petId,
    kind: d.kind,
    title: d.title,
    storage_path: d.path,
    mime_type: d.mime,
    size_bytes: d.size,
    notes: d.notes || null,
    source: "propietario",
  });
  if (error) {
    await supabase.storage.from("attachments").remove([d.path]);
    return { error: friendlyDbError(error.message) };
  }
  revalidatePath(`/mascotas/${petId}`);
  return { error: null };
}

// --------------------------- Accesos y placa ---------------------------

export async function createShareCode(petId: string) {
  uuid.parse(petId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_share_code", { p_pet: petId });
  if (error) back(petId, "accesos", { error: friendlyDbError(error.message) });
  redirect(`/mascotas/${petId}?${new URLSearchParams({ tab: "accesos", codigo: String(data) })}`);
}

/** El dueño retira el acceso de un MVZ o estudiante (también cancela sus citas pendientes). */
export async function revokeClinicianAccess(petId: string, clinicianId: string) {
  uuid.parse(petId);
  uuid.parse(clinicianId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("owner_revoke_access", { p_pet: petId, p_clinician: clinicianId });
  if (error) back(petId, "accesos", { error: friendlyDbError(error.message) });
  revalidatePath(`/mascotas/${petId}`);
  back(petId, "accesos", { ok: "Acceso retirado. Ya no puede ver el expediente." });
}

export async function revokeTag(petId: string, tagId: string) {
  uuid.parse(petId);
  uuid.parse(tagId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_tag", { p_tag: tagId });
  if (error) back(petId, "placa", { error: friendlyDbError(error.message) });
  revalidatePath(`/mascotas/${petId}`);
  back(petId, "placa", { ok: "Placa desactivada. Ya no mostrará datos al escanearse." });
}

/** Activa o desactiva el modo extraviado con un solo toque. */
export async function toggleLostMode(petId: string, enable: boolean) {
  uuid.parse(petId);
  z.boolean().parse(enable);
  const supabase = await createClient();
  const { error } = await supabase.from("pets").update({ lost_mode: enable }).eq("id", petId);
  if (error) back(petId, "identificacion", { error: friendlyDbError(error.message) });
  revalidatePath(`/mascotas/${petId}`);
  revalidatePath("/mascotas");
  back(petId, "identificacion", {
    ok: enable
      ? "Modo extraviado activado. Quien escanee la placa verá el aviso y te avisaremos."
      : "Modo extraviado desactivado. Qué bueno que volvió a casa.",
  });
}

// --------------------------- Citas y membresía ---------------------------

const appointmentStatus = z.enum(["completada", "cancelada"]);

export async function setAppointmentStatus(petId: string, appointmentId: string, status: string) {
  uuid.parse(petId);
  uuid.parse(appointmentId);
  const parsed = appointmentStatus.parse(status);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_appointment_status", { p_id: appointmentId, p_status: parsed });
  if (error) back(petId, "identificacion", { error: friendlyDbError(error.message) });
  revalidatePath(`/mascotas/${petId}`);
  back(petId, "identificacion", { ok: parsed === "cancelada" ? "Cita cancelada." : "Cita marcada como completada." });
}

export async function activateMembership(petId: string, plan: string) {
  uuid.parse(petId);
  const p = z.enum(["mensual", "anual"]).parse(plan);
  const supabase = await createClient();
  const { error } = await supabase.rpc("demo_activate_membership", { p_pet: petId, p_plan: p });
  if (error) redirect(`/mascotas/${petId}/membresia?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  revalidatePath(`/mascotas/${petId}`);
  redirect(`/mascotas/${petId}/membresia?ok=${encodeURIComponent("Membresía activada (modo demostración, sin cobro).")}`);
}

export async function cancelMembership(petId: string) {
  uuid.parse(petId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_membership", { p_pet: petId });
  if (error) redirect(`/mascotas/${petId}/membresia?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  revalidatePath(`/mascotas/${petId}`);
  redirect(`/mascotas/${petId}/membresia?ok=${encodeURIComponent("Membresía cancelada. Sigue vigente hasta el fin del periodo.")}`);
}
