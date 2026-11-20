import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  clinicPlanActive,
  type Clinic,
  type ClinicMembership,
  type Profile,
  type StudentProfile,
  type UserRole,
  type VetProfile,
} from "@/lib/types";

export type Session = {
  userId: string;
  email: string | null;
  profile: Profile;
  vet: VetProfile | null;
  student: StudentProfile | null;
  /** Clínica a la que pertenece (como administrador o clínico), si hay. */
  clinic: ClinicMembership | null;
  /** MVZ con cédula aprobada. */
  isVerifiedVet: boolean;
  /** MVZ o estudiante verificado: puede abrir expedientes. */
  isVerifiedClinician: boolean;
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
  let student: StudentProfile | null = null;
  if (profile.role === "vet") {
    const { data } = await supabase
      .from("vet_profiles")
      .select("user_id, cedula, clinic_name, status, review_note")
      .eq("user_id", profile.id)
      .maybeSingle<VetProfile>();
    vet = data;
  } else if (profile.role === "student") {
    const { data } = await supabase
      .from("student_profiles")
      .select("user_id, university, enrollment_id, status, review_note")
      .eq("user_id", profile.id)
      .maybeSingle<StudentProfile>();
    student = data;
  }

  // Una persona pertenece a lo más a una clínica (índice único en la base).
  const { data: member } = await supabase
    .from("clinic_members")
    .select("role, status, clinics(id, name, status, plan_status, plan_until)")
    .eq("user_id", profile.id)
    .neq("status", "baja")
    .maybeSingle();
  const c = (member as unknown as { clinics: Clinic | null } | null)?.clinics;
  const clinic: ClinicMembership | null =
    member && c
      ? {
          clinicId: c.id,
          name: c.name,
          status: c.status,
          isAdmin: member.role === "admin" && member.status === "activo",
          memberStatus: member.status === "activo" ? "activo" : "pendiente",
          operational: c.status === "verificada" && clinicPlanActive(c),
          planStatus: c.plan_status,
          planUntil: c.plan_until,
        }
      : null;

  const isVerifiedVet = profile.role === "vet" && vet?.status === "approved";
  const isVerifiedStudent = profile.role === "student" && student?.status === "approved";

  return {
    userId: profile.id,
    email: typeof claims.email === "string" ? claims.email : null,
    profile,
    vet,
    student,
    clinic,
    isVerifiedVet,
    isVerifiedClinician: isVerifiedVet || isVerifiedStudent,
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

/** Exige ser MVZ o estudiante verificado (si está pendiente, vuelve a su inicio). */
export async function requireVerifiedClinician(): Promise<Session> {
  const session = await requireRole(["vet", "student"]);
  if (!session.isVerifiedClinician) redirect("/vet");
  return session;
}

export function isClinicianRole(role: UserRole | undefined): boolean {
  return role === "vet" || role === "student";
}

/** Pantalla de inicio según el tipo de cuenta (antes de conocer la sesión completa). */
export function homePath(role: UserRole | undefined): string {
  if (role === "admin") return "/admin";
  return isClinicianRole(role) ? "/vet" : "/mascotas";
}

/** Inicio del espacio principal de la sesión. */
export function sessionHome(session: Session): string {
  if (session.profile.role === "admin") return "/admin";
  if (session.clinic?.isAdmin) return "/clinica";
  return homePath(session.profile.role);
}

/** Exige ser administrador activo de una clínica. */
export async function requireClinicAdmin(): Promise<Session & { clinic: ClinicMembership }> {
  const session = await requireSession();
  if (!session.clinic?.isAdmin) redirect("/");
  return session as Session & { clinic: ClinicMembership };
}
