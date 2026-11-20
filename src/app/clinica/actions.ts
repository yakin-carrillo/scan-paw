"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formatDateTime } from "@/components/ui";
import { requireClinicAdmin, requireSession } from "@/lib/auth";
import { mexicoCityToIso } from "@/lib/clinic";
import { firstError, formObject, friendlyDbError, optionalText } from "@/lib/forms";
import { notifyUsers, petOwnerIds } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/* Acciones del espacio Clínica. Cada RPC vuelve a comprobar en la base que
 * quien llama administra la clínica y que esta tiene el plan vigente. */

function go(path: string, params: { error?: string; ok?: string; [k: string]: string | undefined }): never {
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  redirect(`${path}${qs.size ? `?${qs}` : ""}`);
}

const clinicSchema = z.object({
  name: z.string().trim().min(3, "Escribe el nombre de la clínica.").max(120),
  address: optionalText(200),
  phone: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().regex(/^\+?[0-9 ]{10,15}$/, "Escribe un teléfono de 10 dígitos.").optional(),
  ),
  rfc: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : String(v).trim().toUpperCase()),
    z.string().regex(/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/, "El RFC no tiene un formato válido.").optional(),
  ),
});

export async function registerClinic(formData: FormData) {
  await requireSession();
  const parsed = clinicSchema.safeParse(formObject(formData));
  if (!parsed.success) go("/clinica/registrar", { error: firstError(parsed.error) });
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_clinic", {
    p_name: d.name,
    p_address: d.address ?? null,
    p_phone: d.phone?.replace(/\s/g, "") ?? null,
    p_rfc: d.rfc ?? null,
  });
  if (error) go("/clinica/registrar", { error: friendlyDbError(error.message) });
  revalidatePath("/", "layout");
  go("/clinica", { ok: "Clínica registrada. La verificaremos en breve." });
}

export async function activateClinicPlan() {
  const { clinic } = await requireClinicAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("demo_activate_clinic_plan", { p_clinic: clinic.clinicId });
  if (error) go("/clinica/plan", { error: friendlyDbError(error.message) });
  revalidatePath("/", "layout");
  go("/clinica/plan", { ok: "Plan activado (modo demostración, sin cobro)." });
}

export async function cancelClinicPlan() {
  const { clinic } = await requireClinicAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_clinic_plan", { p_clinic: clinic.clinicId });
  if (error) go("/clinica/plan", { error: friendlyDbError(error.message) });
  revalidatePath("/", "layout");
  go("/clinica/plan", { ok: "Plan cancelado. Sigue vigente hasta el fin del periodo." });
}

export async function createInvite() {
  const { clinic } = await requireClinicAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("clinic_create_invite", { p_clinic: clinic.clinicId });
  if (error || !data) go("/clinica/equipo", { error: friendlyDbError(error?.message) });
  go("/clinica/equipo", { codigo: data });
}

export async function reviewMember(userId: string, approve: boolean) {
  z.uuid().parse(userId);
  const { clinic } = await requireClinicAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clinic_review_member", {
    p_clinic: clinic.clinicId,
    p_user: userId,
    p_approve: approve,
  });
  if (error) go("/clinica/equipo", { error: friendlyDbError(error.message) });
  await notifyUsers([userId], approve
    ? {
        title: `${clinic.name} te validó`,
        body: "Ya puedes abrir expedientes y tus citas aparecen en la agenda de la clínica.",
        url: "/vet",
      }
    : { title: `${clinic.name} no aprobó tu solicitud`, body: "Contacta a la clínica si crees que es un error.", url: "/vet" });
  revalidatePath("/clinica/equipo");
  go("/clinica/equipo", { ok: approve ? "Miembro validado." : "Solicitud rechazada." });
}

export async function removeMember(userId: string) {
  z.uuid().parse(userId);
  const { clinic } = await requireClinicAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clinic_remove_member", { p_clinic: clinic.clinicId, p_user: userId });
  if (error) go("/clinica/equipo", { error: friendlyDbError(error.message) });
  await notifyUsers([userId], {
    title: `Ya no formas parte de ${clinic.name}`,
    body: "Tus citas futuras con la clínica quedaron sin asignar.",
    url: "/vet",
  });
  revalidatePath("/clinica/equipo");
  go("/clinica/equipo", { ok: "Miembro dado de baja. Sus citas futuras quedaron sin asignar." });
}

export async function rotateCalendarLinks(back: string) {
  await requireSession();
  const supabase = await createClient();
  const { error } = await supabase.rpc("rotate_calendar_links");
  const path = back === "/cuenta" ? "/cuenta" : "/clinica";
  if (error) go(path, { error: friendlyDbError(error.message) });
  go(path, { ok: "Enlaces de calendario renovados. Los anteriores dejaron de funcionar." });
}

// ------------------------------- Agenda -------------------------------

const scheduleSchema = z.object({
  pet: z.uuid("Elige un paciente."),
  clinician: z.uuid("Elige al MVZ."),
  at: z.string().min(1, "Elige fecha y hora."),
  reason: z.string().trim().min(1, "Escribe el motivo.").max(200),
});

function calendarPath(formData: FormData) {
  const semana = String(formData.get("semana") ?? "");
  return { path: "/clinica/calendario", semana: /^\d{4}-\d{2}-\d{2}$/.test(semana) ? semana : undefined };
}

export async function clinicSchedule(formData: FormData) {
  const { clinic } = await requireClinicAdmin();
  const { path, semana } = calendarPath(formData);
  const parsed = scheduleSchema.safeParse(formObject(formData));
  if (!parsed.success) go(path, { semana, error: firstError(parsed.error) });
  const d = parsed.data;
  const iso = mexicoCityToIso(d.at);
  if (!iso) go(path, { semana, error: "Fecha no válida." });

  const supabase = await createClient();
  const { error } = await supabase.rpc("clinic_schedule_appointment", {
    p_clinic: clinic.clinicId,
    p_clinician: d.clinician,
    p_pet: d.pet,
    p_at: iso,
    p_reason: d.reason,
  });
  if (error) go(path, { semana, error: friendlyDbError(error.message) });

  const when = formatDateTime(iso);
  await Promise.all([
    notifyUsers([d.clinician], {
      title: "Nueva cita asignada",
      body: `${clinic.name} te asignó una cita el ${when}. Motivo: ${d.reason}`,
      url: "/vet/agenda",
    }),
    notifyUsers(await petOwnerIds(d.pet), {
      title: "Nueva cita para tu mascota",
      body: `${clinic.name} agendó una cita el ${when}. Motivo: ${d.reason}`,
      url: `/mascotas/${d.pet}`,
    }),
  ]);
  revalidatePath(path);
  go(path, { semana, ok: "Cita agendada. Avisamos al MVZ y a la familia." });
}

const updateSchema = z.object({ clinician: z.uuid("Elige al MVZ."), at: z.string().min(1, "Elige fecha y hora.") });

export async function clinicUpdateAppointment(appointmentId: string, formData: FormData) {
  z.uuid().parse(appointmentId);
  const { clinic } = await requireClinicAdmin();
  const { path, semana } = calendarPath(formData);
  const parsed = updateSchema.safeParse(formObject(formData));
  if (!parsed.success) go(path, { semana, error: firstError(parsed.error) });
  const iso = mexicoCityToIso(parsed.data.at);
  if (!iso) go(path, { semana, error: "Fecha no válida." });

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("appointments")
    .select("pet_id, pet_name, clinician_id, scheduled_at, clinic_id")
    .eq("id", appointmentId)
    .maybeSingle();
  const supabase = await createClient();
  const { error } = await supabase.rpc("clinic_update_appointment", {
    p_id: appointmentId,
    p_clinician: parsed.data.clinician,
    p_at: iso,
  });
  if (error || !before) go(path, { semana, error: friendlyDbError(error?.message) });

  const when = formatDateTime(iso);
  const moved = new Date(before.scheduled_at).getTime() !== new Date(iso).getTime();
  const reassigned = before.clinician_id !== parsed.data.clinician;
  const tasks: Promise<void>[] = [
    notifyUsers([parsed.data.clinician], {
      title: reassigned ? "Te asignaron una cita" : "Cita reagendada",
      body: `${before.pet_name}: ${when} (${clinic.name}).`,
      url: "/vet/agenda",
    }),
  ];
  if (reassigned && before.clinician_id) {
    tasks.push(
      notifyUsers([before.clinician_id], {
        title: "Una cita pasó a otro MVZ",
        body: `${clinic.name} reasignó la cita de ${before.pet_name}.`,
        url: "/vet/agenda",
      }),
    );
  }
  if (moved) {
    tasks.push(
      notifyUsers(await petOwnerIds(before.pet_id), {
        title: `Cambió la cita de ${before.pet_name}`,
        body: `${clinic.name} la movió al ${when}.`,
        url: `/mascotas/${before.pet_id}`,
      }),
    );
  }
  await Promise.all(tasks);
  revalidatePath(path);
  go(path, { semana, ok: "Cita actualizada. Avisamos a los involucrados." });
}

export async function clinicSetStatus(appointmentId: string, status: "completada" | "cancelada", formData: FormData) {
  z.uuid().parse(appointmentId);
  z.enum(["completada", "cancelada"]).parse(status);
  const { clinic } = await requireClinicAdmin();
  const { path, semana } = calendarPath(formData);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_appointment_status", { p_id: appointmentId, p_status: status });
  if (error) go(path, { semana, error: friendlyDbError(error.message) });
  if (status === "cancelada") {
    const { data: a } = await createAdminClient()
      .from("appointments")
      .select("pet_id, pet_name, clinician_id, scheduled_at")
      .eq("id", appointmentId)
      .maybeSingle();
    if (a) {
      const body = `${clinic.name} canceló la cita del ${formatDateTime(a.scheduled_at)}.`;
      await Promise.all([
        notifyUsers(await petOwnerIds(a.pet_id), { title: `Cita de ${a.pet_name} cancelada`, body, url: `/mascotas/${a.pet_id}` }),
        a.clinician_id
          ? notifyUsers([a.clinician_id], { title: `Cita de ${a.pet_name} cancelada`, body, url: "/vet/agenda" })
          : Promise.resolve(),
      ]);
    }
  }
  revalidatePath(path);
  go(path, { semana, ok: status === "completada" ? "Cita completada." : "Cita cancelada." });
}
