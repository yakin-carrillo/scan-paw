"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { mexicoCityToIso } from "@/lib/clinic";
import { clinicianCredential, escapeHtml, ownerEmails, sendEmail } from "@/lib/email";
import { friendlyDbError } from "@/lib/forms";
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

  await sendEmail({
    to: await ownerEmails(petId),
    subject: "Alguien usó tu código de acceso de Scan-Paw",
    html: `<p><strong>${escapeHtml(session.profile.full_name)}</strong> ${clinicianCredential(session)} tiene acceso al
           expediente por 7 días.</p>`,
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

  const clinic = session.vet?.clinic_name ? ` en ${escapeHtml(session.vet.clinic_name)}` : "";
  await sendEmail({
    to: await ownerEmails(d.pet),
    subject: "Nueva cita para tu mascota",
    html: `<p><strong>${escapeHtml(session.profile.full_name)}</strong>${clinic} agendó una cita el
           <strong>${escapeHtml(formatDateTime(iso!))}</strong>.</p>
           <p>Motivo: ${escapeHtml(d.reason)}</p>
           <p>Para preparar la consulta, su acceso al expediente se extiende hasta el día siguiente de la cita.
           Puedes cancelarla desde el expediente de tu mascota en Scan-Paw.</p>`,
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
  revalidatePath("/vet/agenda");
  revalidatePath("/vet");
  redirect(`/vet/agenda?ok=${encodeURIComponent(status === "completada" ? "Cita completada." : "Cita cancelada.")}`);
}
