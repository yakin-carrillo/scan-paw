import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Abre un anexo con una URL firmada de 5 minutos. RLS valida el acceso. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/archivos/[id]">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!row) return new NextResponse("No encontrado", { status: 404 });

  const { data, error } = await supabase.storage.from("attachments").createSignedUrl(row.storage_path, 300);
  if (error || !data) return new NextResponse("No disponible", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
