import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino de los enlaces de correo (confirmación y recuperación).
 * Acepta ?token_hash=&type= (recomendado: funciona aunque se abra en otro
 * dispositivo) y ?code= (flujo PKCE por defecto).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(
      `${origin}/entrar?error=${encodeURIComponent("El enlace no es válido o ya venció.")}`,
    );
  }
  const destination = type === "recovery" ? "/cuenta/contrasena" : next;
  return NextResponse.redirect(`${origin}${destination}`);
}
