import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron diario (vercel.json). Mantiene activo el proyecto gratuito de Supabase,
 * que se pausa tras 7 días sin actividad. En el Hito 2 aquí irán los
 * recordatorios de vacunas.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  const admin = createAdminClient();
  const { count, error } = await admin.from("pets").select("id", { count: "exact", head: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, pets: count, at: new Date().toISOString() });
}
