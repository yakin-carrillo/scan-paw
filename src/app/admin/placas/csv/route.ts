import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { tagUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

/** CSV para el proveedor de grabado: código, URL del QR y código de activación. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (session?.profile.role !== "admin") return new NextResponse("Prohibido", { status: 403 });

  const lote = request.nextUrl.searchParams.get("lote") ?? "";
  const supabase = await createClient();
  const { data } = await supabase
    .from("tags")
    .select("public_token, activation_code, status")
    .eq("batch", lote)
    .order("created_at");

  const rows = [["codigo_placa", "url_qr", "codigo_activacion", "estado"]];
  for (const t of data ?? []) rows.push([t.public_token, tagUrl(t.public_token), t.activation_code, t.status]);
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\r\n");

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="placas-${lote.replace(/[^\w-]/g, "_")}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
