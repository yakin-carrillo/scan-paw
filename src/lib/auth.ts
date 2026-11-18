import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole, VetProfile } from "@/lib/types";

export type Session = {
  userId: string;
  email: string | null;
  profile: Profile;
  vet: VetProfile | null;
  isVerifiedVet: boolean;
  /** Completó el registro guiado (teléfono, tipo de cuenta y consentimiento). */
  onboarded: boolean;
};

/** Capa de acceso a datos: lee la sesión una vez por solicitud. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, privacy_accepted_at")
    .eq("id", claims.sub)
    .maybeSingle<Profile>();
  if (!profile) return null;

  let vet: VetProfile | null = null;
  if (profile.role === "vet") {
    const { data } = await supabase
      .from("vet_profiles")
      .select("user_id, cedula, clinic_name, status, review_note")
      .eq("user_id", profile.id)
      .maybeSingle<VetProfile>();
    vet = data;
  }

  return {
    userId: profile.id,
    email: typeof claims.email === "string" ? claims.email : null,
    profile,
    vet,
    isVerifiedVet: profile.role === "vet" && vet?.status === "approved",
    onboarded: Boolean(profile.privacy_accepted_at),
  };
});

/** Exige sesión iniciada y registro completo (si no, manda a /bienvenida). */
export async function requireSession(next?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect(next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar");
  }
  if (!session.onboarded) {
    redirect(next ? `/bienvenida?next=${encodeURIComponent(next)}` : "/bienvenida");
  }
  return session;
}

export async function requireRole(roles: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.profile.role)) redirect("/");
  return session;
}
