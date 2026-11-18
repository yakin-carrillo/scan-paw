function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa .env.example.`);
  }
  return value;
}

// Las variables NEXT_PUBLIC_ deben leerse de forma literal para que Next las incruste.
export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);
export const SUPABASE_PUBLISHABLE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
