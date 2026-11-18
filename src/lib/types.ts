export type UserRole = "owner" | "vet" | "student" | "admin";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type Species = "perro" | "gato";
export type RecordSource = "vet" | "estudiante" | "propietario";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  privacy_accepted_at: string | null;
};

export type VetProfile = {
  user_id: string;
  cedula: string;
  clinic_name: string | null;
  status: VerificationStatus;
  review_note: string | null;
};

export type Pet = {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  sex: "macho" | "hembra" | null;
  birth_date: string | null;
  color: string | null;
  sterilized: boolean | null;
  microchip: string | null;
  photo_path: string | null;
  status: "activo" | "fallecido";
  deceased_at: string | null;
  lost_mode: boolean;
  lost_message: string | null;
  show_phone: boolean;
  show_photo: boolean;
  created_at: string;
};

type Authored = {
  id: string;
  pet_id: string;
  amends_id: string | null;
  source: RecordSource;
  author_id: string | null;
  author_name: string | null;
  author_cedula: string | null;
  created_at: string;
};

export type Vaccination = Authored & {
  vaccine: string;
  batch_number: string | null;
  applied_on: string;
  next_due: string | null;
  notes: string | null;
};

export type Condition = Authored & {
  kind: "alergia" | "cronica";
  description: string;
  severity: "leve" | "moderada" | "grave" | null;
  active: boolean;
  notes: string | null;
};

export type Attachment = Authored & {
  kind: "estudio" | "receta" | "otro";
  title: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  notes: string | null;
};

export type Tag = {
  id: string;
  public_token: string;
  activation_code: string;
  pet_id: string | null;
  status: "sin_asignar" | "activa" | "revocada";
  batch: string | null;
  activated_at: string | null;
  created_at: string;
};

export type PublicPet = {
  tag_status: Tag["status"];
  pet_name: string | null;
  species: Species | null;
  pet_status: Pet["status"] | null;
  owner_first_name: string | null;
  contact_phone: string | null;
  lost_mode: boolean;
  lost_message: string | null;
  photo_path: string | null;
};

/** Oculta las entradas que fueron corregidas por una enmienda posterior. */
export function latestVersions<T extends { id: string; amends_id: string | null }>(
  rows: T[],
): T[] {
  const amended = new Set(rows.map((r) => r.amends_id).filter(Boolean));
  return rows.filter((r) => !amended.has(r.id));
}

export type StudentProfile = {
  user_id: string;
  university: string;
  enrollment_id: string;
  status: VerificationStatus;
  review_note: string | null;
};

export type AppointmentStatus = "programada" | "completada" | "cancelada";

export type Appointment = {
  id: string;
  pet_id: string;
  clinician_id: string | null;
  pet_name: string;
  clinician_name: string | null;
  clinic_name: string | null;
  scheduled_at: string;
  reason: string;
  status: AppointmentStatus;
  notes: string | null;
};

export type Membership = {
  pet_id: string;
  plan: "mensual" | "anual";
  status: "activa" | "cancelada";
  current_period_end: string;
  provider: string;
};

export function membershipActive(m: Membership | null | undefined): boolean {
  return Boolean(m && m.status === "activa" && new Date(m.current_period_end) > new Date());
}
