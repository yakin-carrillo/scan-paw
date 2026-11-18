import { NextResponse, type NextRequest } from "next/server";
import { tagSvg } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";

/** SVG del QR. Solo para el dueño de la placa o un administrador (RLS en tags). */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/qr/[token]">) {
  const { token } = await ctx.params;
  const supabase = await createClient();
  const { data: tag } = await supabase
    .from("tags")
    .select("public_token")
    .eq("public_token", token.toUpperCase())
    .maybeSingle();
  if (!tag) return new NextResponse("No encontrado", { status: 404 });

  const svg = await tagSvg(tag.public_token);
  const download = request.nextUrl.searchParams.has("descargar");
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "private, max-age=3600",
      ...(download ? { "Content-Disposition": `attachment; filename="scanpaw-${tag.public_token}.svg"` } : {}),
    },
  });
}
