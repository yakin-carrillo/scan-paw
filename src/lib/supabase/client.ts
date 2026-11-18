"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Cliente de navegador (se usa para subir archivos directo a Storage). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
