import { NextResponse, type NextRequest } from "next/server";
import { formatDate, formatDateTime } from "@/components/ui";
import { clinicAdminIds, notifyUsers, petOwnerIds } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { latestVersions, type Appointment, type Vaccination } from "@/lib/types";

/**
 * Cron diario (vercel.json, 12:00 UTC = 6:00 en CDMX).
 *  - Recordatorio de vacunas que vencen en los próximos 7 días.
 *  - Recordatorio de citas en las próximas 36 horas (al dueño y al clínico).
 * Cada aviso se envía una sola vez (tabla reminder_log). También mantiene
 * activo el proyecto gratuito de Supabase, que se pausa tras 7 días sin uso.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [{ data: vax, error }, { data: appts }, { data: logged }] = await Promise.all([
    admin
      .from("vaccinations")
      .select("*, pets!inner(name, status)")
      .gte("next_due", today)
      .lte("next_due", in7)
      .eq("pets.status", "activo"),
    admin
      .from("appointments")
      .select("*")
      .eq("status", "programada")
      .gte("scheduled_at", new Date().toISOString())
      .lte("scheduled_at", new Date(Date.now() + 36 * 3600 * 1000).toISOString()),
    admin.from("reminder_log").select("kind, ref_id").gte("sent_at", new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString()),
  ]);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const sent = new Set((logged ?? []).map((l) => `${l.kind}:${l.ref_id}`));
  type VaxRow = Vaccination & { pets: { name: string } };
  // Solo la versión vigente de cada vacuna (sin las corregidas).
  const { data: amendments } = await admin
    .from("vaccinations")
    .select("amends_id")
    .in("amends_id", (vax ?? []).map((v) => v.id));
  const amended = new Set((amendments ?? []).map((a) => a.amends_id));
  const dueVax = latestVersions((vax ?? []) as VaxRow[]).filter((v) => !amended.has(v.id) && !sent.has(`vacuna:${v.id}`));

  const byPet = new Map<string, VaxRow[]>();
  dueVax.forEach((v) => byPet.set(v.pet_id, [...(byPet.get(v.pet_id) ?? []), v]));

  let vaccineReminders = 0;
  for (const [petId, items] of byPet) {
    const list = items.map((v) => `${v.vaccine} (${formatDate(v.next_due)})`).join(", ");
    await notifyUsers(await petOwnerIds(petId), {
      title: `Vacunas de ${items[0].pets.name} por vencer`,
      body: `Vencen pronto: ${list}. Agenda con su MVZ.`,
      url: `/mascotas/${petId}?tab=vacunas`,
      tag: `vacunas-${petId}`,
    });
    await admin.from("reminder_log").insert(items.map((v) => ({ kind: "vacuna", ref_id: v.id })));
    vaccineReminders++;
  }

  let appointmentReminders = 0;
  for (const a of (appts ?? []) as Appointment[]) {
    if (sent.has(`cita:${a.id}`)) continue;
    const when = formatDateTime(a.scheduled_at);
    const where = `${a.clinician_name ?? "su MVZ"}${a.clinic_name ? ` (${a.clinic_name})` : ""}`;
    await notifyUsers(await petOwnerIds(a.pet_id), {
      title: `Recordatorio: cita de ${a.pet_name}`,
      body: `${when} con ${where}. Motivo: ${a.reason}`,
      url: `/mascotas/${a.pet_id}`,
    });
    if (a.clinician_id) {
      await notifyUsers([a.clinician_id], {
        title: `Cita con ${a.pet_name}`,
        body: `${when}. Motivo: ${a.reason}`,
        url: "/vet/agenda",
      });
    }
    await admin.from("reminder_log").insert({ kind: "cita", ref_id: a.id });
    appointmentReminders++;
  }

  // Resumen de la agenda del día para cada clínica con plan vigente (6:00 en CDMX).
  const dayStart = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })}T00:00:00-06:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const { data: clinics } = await admin
    .from("clinics")
    .select("id, name")
    .eq("status", "verificada")
    .in("plan_status", ["activa", "cancelada"])
    .gt("plan_until", new Date().toISOString());
  let clinicSummaries = 0;
  for (const c of clinics ?? []) {
    const { data: today } = await admin
      .from("appointments")
      .select("clinician_id")
      .eq("clinic_id", c.id)
      .eq("status", "programada")
      .gte("scheduled_at", dayStart.toISOString())
      .lt("scheduled_at", dayEnd.toISOString());
    if (!today?.length) continue;
    const unassigned = today.filter((a) => !a.clinician_id).length;
    await notifyUsers(await clinicAdminIds(c.id), {
      title: `Agenda de hoy en ${c.name}`,
      body: `${today.length} ${today.length === 1 ? "cita" : "citas"}${unassigned ? `, ${unassigned} sin asignar` : ""}.`,
      url: "/clinica/calendario",
      tag: `agenda-${c.id}`,
    });
    clinicSummaries++;
  }

  return NextResponse.json({
    ok: true,
    vaccineReminders,
    appointmentReminders,
    clinicSummaries,
    at: new Date().toISOString(),
  });
}
