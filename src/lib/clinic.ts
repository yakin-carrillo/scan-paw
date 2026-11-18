import "server-only";
import type { Session } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Patient = {
  pet_id: string;
  expires_at: string;
  source: string;
  pets: { name: string; species: "perro" | "gato"; breed: string | null; photo_path: string | null } | null;
};

/** Pacientes con acceso vigente del clínico (un registro por mascota, el de mayor vigencia). */
export async function activePatients(session: Session): Promise<Patient[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vet_access")
    .select("pet_id, source, expires_at, pets(name, species, breed, photo_path)")
    .eq("vet_id", session.userId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false });
  const seen = new Set<string>();
  return ((data ?? []) as unknown as Patient[]).filter((r) => r.pets && !seen.has(r.pet_id) && seen.add(r.pet_id));
}

/** Convierte "2026-11-20T10:30" (hora de la Ciudad de México, sin horario de verano) a ISO. */
export function mexicoCityToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const d = new Date(`${local}:00-06:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Fecha local (CDMX) en formato yyyy-mm-dd, para agrupar la agenda por día. */
export function mexicoCityDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

/** Instante desplazado `days` días desde ahora, en ISO (negativo = pasado). */
export function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
}
