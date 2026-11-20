"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { mexicoCityToIso } from "@/lib/clinic";
import { friendlyDbError } from "@/lib/forms";
import { clinicAdminIds, clinicianCredential, notifyUsers, petOwnerIds } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/components/ui";

/** MVZ o estudiante: canjea el código de 6 caracteres que generó el propietario. */
export async function redeemCode(formData: FormData) {
  const session = await requireRole(["vet", "student"]);
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!/^[0-9A-Z]{6}$/.test(code)) redirect(`/vet?error=${encodeURIComponent("El código tiene 6 caracteres.")}`);

  const supabase = await createClient();
  const { data: petId, error } = await supabase.rpc("redeem_share_code", { p_code: code });
  if (error || !petId) {
    const message = error ? friendlyDbError(error.message) : "Código no válido o vencido.";
    redirect(`/vet?error=${encodeURIComponent(message)}`);
  }

  await notifyUsers(await petOwnerIds(petId), {
    title: "Alguien usó tu código de acceso",
    body: `${session.profile.full_name} (${clinicianCredential(session)}) tiene acceso al expediente por 7 días.`,
    url: `/mascotas/${petId}?tab=accesos`,
  });
  redirect(`/mascotas/${petId}`);
}

const scheduleSchema = z.object({
  pet: z.uuid("Elige un paciente."),
  at: z.string().min(1, "Elige fecha y hora."),
  reason: z.string().trim().min(1, "Escribe el motivo.").max(200),
});

export async function scheduleAppointment(formData: FormData) {
  const session = await requireRole(["vet", "student"]);
  const parsed = scheduleSchema.safeParse({
    pet: formData.get("pet"),
    at: formData.get("at"),
    reason: formData.get("reason"),
  });
  const fail = (message: string): never => redirect(`/vet/agenda?error=${encodeURIComponent(message)}`);
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Datos no válidos.");
  const d = parsed.data!;
  const iso = mexicoCityToIso(d.at);
  if (!iso) fail("Fecha no válida.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("schedule_appointment", { p_pet: d.pet, p_at: iso, p_reason: d.reason });
  if (error) fail(friendlyDbError(error.message));

  const clinicName = session.clinic?.memberStatus === "activo" ? session.clinic.name : session.vet?.clinic_name;
  const clinic = clinicName ? ` en ${clinicName}` : "";
  await notifyUsers(await petOwnerIds(d.pet), {
    title: "Nueva cita para tu mascota",
    body: `${session.profile.full_name}${clinic} agendó una cita el ${formatDateTime(iso!)}. Motivo: ${d.reason}`,
    url: `/mascotas/${d.pet}`,
  });
  revalidatePath("/vet");
  revalidatePath("/vet/agenda");
  redirect(`/vet/agenda?ok=${encodeURIComponent("Cita agendada. Avisamos al propietario.")}`);
}

export async function updateAppointment(appointmentId: string, status: "completada" | "cancelada") {
  await requireRole(["vet", "student"]);
  z.uuid().parse(appointmentId);
  z.enum(["completada", "cancelada"]).parse(status);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_appointment_status", { p_id: appointmentId, p_status: status });
  if (error) redirect(`/vet/agenda?error=${encodeURIComponent(friendlyDbError(error.message))}`);
  if (status === "cancelada") {
    const { data: a } = await createAdminClient()
      .from("appointments")
      .select("pet_id, pet_name, scheduled_at")
      .eq("id", appointmentId)
      .maybeSingle();
    if (a) {
      await notifyUsers(await petOwnerIds(a.pet_id), {
        title: `Cita de ${a.pet_name} cancelada`,
        body: `El clínico canceló la cita del ${formatDateTime(a.scheduled_at)}.`,
        url: `/mascotas/${a.pet_id}`,
      });
    }
  }
  revalidatePath("/vet/agenda");
  revalidatePath("/vet");
  redirect(`/vet/agenda?ok=${encodeURIComponent(status === "completada" ? "Cita completada." : "Cita cancelada.")}`);
}

/** MVZ o estudiante: se une a una clínica con su código; queda pendiente de validación. */
export async function joinClinic(formData: FormData) {
  const session = await requireRole(["vet", "student"]);
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!/^[0-9A-Z]{8}$/.test(code)) redirect(`/vet?error=${encodeURIComponent("El código de la clínica tiene 8 caracteres.")}`);
  const supabase = await createClient();
  const { data: clinicId, error } = await supabase.rpc("clinic_join", { p_code: code });
  if (error || !clinicId) {
    redirect(`/vet?error=${encodeURIComponent(error ? friendlyDbError(error.message) : "Código no válido o vencido.")}`);
  }
  await notifyUsers(await clinicAdminIds(clinicId), {
    title: "Nueva solicitud para tu clínica",
    body: `${session.profile.full_name} (${clinicianCredential(session)}) quiere unirse. Valídalo en Equipo.`,
    url: "/clinica/equipo",
  });
  revalidatePath("/", "layout");
  redirect(`/vet?ok=${encodeURIComponent("Solicitud enviada. La clínica debe validarte.")}`);
}
