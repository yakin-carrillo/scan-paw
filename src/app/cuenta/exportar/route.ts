import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Portabilidad: todo lo que el usuario puede ver de sus mascotas, en JSON. */
export async function GET() {
  const session = await getSession();
  if (!session) return new NextResponse("No autorizado", { status: 401 });
  const supabase = await createClient();

  const { data: owned } = await supabase.from("pet_owners").select("pet_id").eq("user_id", session.userId);
  const ids = (owned ?? []).map((o) => o.pet_id);

  const [pets, vaccinations, conditions, attachments, access, appointments, memberships] = await Promise.all([
    supabase.from("pets").select("*").in("id", ids),
    supabase.from("vaccinations").select("*").in("pet_id", ids),
    supabase.from("conditions").select("*").in("pet_id", ids),
    supabase.from("attachments").select("id, pet_id, kind, title, mime_type, size_bytes, notes, source, author_name, author_cedula, created_at").in("pet_id", ids),
    supabase.from("vet_access").select("pet_id, source, granted_at, expires_at").in("pet_id", ids),
    supabase.from("appointments").select("pet_id, scheduled_at, reason, status, clinician_name, clinic_name").in("pet_id", ids),
    supabase.from("memberships").select("*").in("pet_id", ids),
  ]);

  const body = {
    exported_at: new Date().toISOString(),
    profile: session.profile,
    pets: pets.data ?? [],
    vaccinations: vaccinations.data ?? [],
    conditions: conditions.data ?? [],
    attachments: attachments.data ?? [],
    vet_access: access.data ?? [],
    appointments: appointments.data ?? [],
    memberships: memberships.data ?? [],
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scan-paw-mis-datos.json"',
      "Cache-Control": "no-store",
    },
  });
}
