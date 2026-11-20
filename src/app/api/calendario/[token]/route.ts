import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Suscripción de calendario (iCalendar). El enlace secreto identifica a un
 * miembro (sus citas) o a una clínica (todas). Solo incluye nombre de la
 * mascota, motivo y MVZ: nada del expediente clínico.
 */

function esc(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => `\\${c}`);
}
function stamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
/** Las líneas de iCalendar no deben pasar de 75 octetos. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 70) {
    out.push(rest.slice(0, 70));
    rest = ` ${rest.slice(70)}`;
  }
  out.push(rest);
  return out.join("\r\n");
}

export async function GET(_request: Request, ctx: RouteContext<"/api/calendario/[token]">) {
  const { token: raw } = await ctx.params;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[2-9A-HJ-NP-Z]{32}$/.test(token)) return new NextResponse("No encontrado", { status: 404 });

  const admin = createAdminClient();
  const [{ data: clinic }, { data: member }] = await Promise.all([
    admin.from("clinics").select("id, name, status, plan_status, plan_until").eq("calendar_token", token).maybeSingle(),
    admin
      .from("clinic_members")
      .select("user_id, clinic_id, status, clinics(name)")
      .eq("calendar_token", token)
      .eq("status", "activo")
      .maybeSingle(),
  ]);
  if (!clinic && !member) return new NextResponse("No encontrado", { status: 404 });

  const from = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const to = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
  let q = admin
    .from("appointments")
    .select("id, pet_name, clinician_name, clinic_name, scheduled_at, reason, status, updated_at")
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .order("scheduled_at")
    .limit(1000);
  if (clinic) {
    const vigente = clinic.status === "verificada" && clinic.plan_status !== "sin_plan" && clinic.plan_until && new Date(clinic.plan_until) > new Date();
    if (!vigente) return new NextResponse("El plan de la clínica no está vigente", { status: 403 });
    q = q.eq("clinic_id", clinic.id);
  } else {
    q = q.eq("clinician_id", member!.user_id);
  }
  const { data: appts } = await q;
  const name = clinic?.name ?? (member?.clinics as unknown as { name: string } | null)?.name ?? "Scan-Paw";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Scan-Paw//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(clinic ? `Agenda · ${name}` : `Mis citas · ${name}`)}`,
    "X-WR-TIMEZONE:America/Mexico_City",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
  ];
  for (const a of appts ?? []) {
    const start = new Date(a.scheduled_at);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${a.id}@scan-paw`,
      `DTSTAMP:${stamp(a.updated_at)}`,
      `DTSTART:${stamp(start.toISOString())}`,
      `DTEND:${stamp(end.toISOString())}`,
      fold(`SUMMARY:${esc(`${a.pet_name}: ${a.reason}`)}`),
      fold(`DESCRIPTION:${esc(`MVZ: ${a.clinician_name ?? "sin asignar"}`)}`),
      `STATUS:${a.status === "cancelada" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex",
    },
  });
}
