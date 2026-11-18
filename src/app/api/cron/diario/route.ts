import { NextResponse, type NextRequest } from "next/server";
import { formatDate, formatDateTime } from "@/components/ui";
import { escapeHtml, ownerEmails, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
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

  let vaccineMails = 0;
  for (const [petId, items] of byPet) {
    const name = escapeHtml(items[0].pets.name);
    const list = items.map((v) => `<li>${escapeHtml(v.vaccine)}: ${formatDate(v.next_due)}</li>`).join("");
    await sendEmail({
      to: await ownerEmails(petId),
      subject: `Vacunas de ${items[0].pets.name} por vencer`,
      html: `<p>Estas vacunas de <strong>${name}</strong> vencen pronto:</p><ul>${list}</ul>
             <p><a href="${siteUrl()}/mascotas/${petId}?tab=vacunas">Ver su cartilla en Scan-Paw</a></p>`,
    });
    await admin.from("reminder_log").insert(items.map((v) => ({ kind: "vacuna", ref_id: v.id })));
    vaccineMails++;
  }

  let appointmentMails = 0;
  for (const a of (appts ?? []) as Appointment[]) {
    if (sent.has(`cita:${a.id}`)) continue;
    const to = await ownerEmails(a.pet_id);
    if (a.clinician_id) {
      const { data } = await admin.auth.admin.getUserById(a.clinician_id);
      if (data.user?.email) to.push(data.user.email);
    }
    await sendEmail({
      to,
      subject: `Recordatorio: cita de ${a.pet_name}`,
      html: `<p>Cita de <strong>${escapeHtml(a.pet_name)}</strong> el ${escapeHtml(formatDateTime(a.scheduled_at))}
             con ${escapeHtml(a.clinician_name ?? "su MVZ")}${a.clinic_name ? ` (${escapeHtml(a.clinic_name)})` : ""}.</p>
             <p>Motivo: ${escapeHtml(a.reason)}</p>`,
    });
    await admin.from("reminder_log").insert({ kind: "cita", ref_id: a.id });
    appointmentMails++;
  }

  return NextResponse.json({ ok: true, vaccineMails, appointmentMails, at: new Date().toISOString() });
}
