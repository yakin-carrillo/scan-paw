import "server-only";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  latestVersions,
  type Appointment,
  type Attachment,
  type Membership,
  type Condition,
  type Consultation,
  type Pet,
  type Tag,
  type Vaccination,
  type Weight,
} from "@/lib/types";

export type PetRecord = Awaited<ReturnType<typeof loadPetRecord>>;

/**
 * Carga el expediente completo. RLS decide qué puede ver el usuario:
 * si no es dueño ni MVZ con acceso vigente, la mascota "no existe".
 */
export async function loadPetRecord(petId: string) {
  const session = await requireSession(`/mascotas/${petId}`);
  const supabase = await createClient();

  const { data: pet } = await supabase.from("pets").select("*").eq("id", petId).maybeSingle<Pet>();
  if (!pet) notFound();

  const [owners, vaccinations, conditions, attachments, tags, access, scans, appointments, membership, consultations, weights] =
    await Promise.all([
    supabase
      .from("pet_owners")
      .select("user_id, role, profiles(full_name, phone)")
      .eq("pet_id", petId),
    supabase.from("vaccinations").select("*").eq("pet_id", petId).order("applied_on", { ascending: false }),
    supabase.from("conditions").select("*").eq("pet_id", petId).order("created_at", { ascending: false }),
    supabase.from("attachments").select("*").eq("pet_id", petId).order("created_at", { ascending: false }),
    supabase.from("tags").select("*").eq("pet_id", petId).order("created_at", { ascending: false }),
    supabase
      .from("vet_access")
      .select(
        "id, vet_id, source, granted_at, expires_at, profiles(full_name, role, vet_profiles!vet_profiles_user_id_fkey(cedula, clinic_name), student_profiles!student_profiles_user_id_fkey(university))",
      )
      .eq("pet_id", petId)
      .order("granted_at", { ascending: false })
      .limit(50),
    supabase
      .from("scan_events")
      .select("id, kind, created_at, latitude, longitude")
      .eq("pet_id", petId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("appointments")
      .select("*")
      .eq("pet_id", petId)
      .gte("scheduled_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20),
    supabase.from("memberships").select("*").eq("pet_id", petId).maybeSingle<Membership>(),
    supabase
      .from("consultations")
      .select("*")
      .eq("pet_id", petId)
      .order("visit_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("weights").select("*").eq("pet_id", petId).order("measured_on", { ascending: true }),
  ]);

  type OwnerRow = { user_id: string; role: string; profiles: { full_name: string; phone: string | null } | null };
  const ownerRows = (owners.data ?? []) as unknown as OwnerRow[];
  const isOwner = ownerRows.some((o) => o.user_id === session.userId);

  type AccessRow = {
    id: string;
    vet_id: string;
    source: "escaneo" | "codigo" | "cita";
    granted_at: string;
    expires_at: string;
    profiles: {
      full_name: string;
      role: string;
      vet_profiles: { cedula: string; clinic_name: string | null } | null;
      student_profiles: { university: string } | null;
    } | null;
  };
  const accessRows = (access.data ?? []) as unknown as AccessRow[];
  const myAccess = accessRows
    .filter((a) => a.vet_id === session.userId && new Date(a.expires_at) > new Date())
    .sort((a, b) => b.expires_at.localeCompare(a.expires_at))[0];

  let photoUrl: string | null = null;
  if (pet.photo_path) {
    const { data } = await supabase.storage.from("pet-photos").createSignedUrl(pet.photo_path, 3600);
    photoUrl = data?.signedUrl ?? null;
  }

  return {
    session,
    pet,
    photoUrl,
    isOwner,
    /** Clínico verificado con acceso vigente: sus registros quedan firmados. */
    clinicalAccess: session.isVerifiedClinician && Boolean(myAccess),
    isVetViewer: !isOwner && session.isVerifiedClinician && Boolean(myAccess),
    viewerIsStudent: session.profile.role === "student",
    appointments: (appointments.data ?? []) as Appointment[],
    membership: membership.data ?? null,
    myAccessExpires: myAccess?.expires_at ?? null,
    owners: ownerRows,
    vaccinations: latestVersions((vaccinations.data ?? []) as Vaccination[]),
    conditions: latestVersions((conditions.data ?? []) as Condition[]),
    attachments: latestVersions((attachments.data ?? []) as Attachment[]),
    consultations: latestVersions((consultations.data ?? []) as Consultation[]),
    weights: latestVersions((weights.data ?? []) as Weight[]).map((w) => ({ ...w, weight_kg: Number(w.weight_kg) })),
    tags: (tags.data ?? []) as Tag[],
    access: accessRows,
    scans: scans.data ?? [],
  };
}

export function petAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00Z`);
  const now = new Date();
  let months = (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + now.getUTCMonth() - birth.getUTCMonth();
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  if (months < 0) return null;
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "año" : "años"}`;
}

/** Estado de una vacuna según su próxima dosis: vigente, por vencer (30 días) o vencida. */
export function vaccineStatus(nextDue: string | null): "ok" | "soon" | "overdue" {
  if (!nextDue) return "ok";
  const today = new Date().toISOString().slice(0, 10);
  if (nextDue < today) return "overdue";
  const soon = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return nextDue <= soon ? "soon" : "ok";
}
