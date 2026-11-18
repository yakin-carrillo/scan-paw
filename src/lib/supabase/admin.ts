import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

/**
 * Cliente con la clave secreta: SALTA RLS.
 * Úsalo solo en el servidor y solo para tareas que el usuario no puede hacer
 * por sí mismo (registrar escaneos anónimos, leer correos para avisos, firmar
 * la foto pública). Nunca lo uses para leer expedientes.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error("Falta SUPABASE_SECRET_KEY en el entorno del servidor.");
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
