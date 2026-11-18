import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Mail = { to: string[]; subject: string; html: string };

/** Envía un correo con Resend. Sin RESEND_API_KEY solo lo registra en consola. */
export async function sendEmail({ to, subject, html }: Mail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Scan-Paw <onboarding@resend.dev>";
  if (to.length === 0) return;
  if (!apiKey) {
    console.info(`[email omitido: sin RESEND_API_KEY] ${subject} → ${to.length} destinatario(s)`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) console.error("Resend respondió", res.status, await res.text());
  } catch (err) {
    console.error("No se pudo enviar el correo", err);
  }
}

/** Correos de todos los dueños de una mascota (requiere la clave secreta). */
export async function ownerEmails(petId: string): Promise<string[]> {
  const admin = createAdminClient();
  const { data: owners } = await admin.from("pet_owners").select("user_id").eq("pet_id", petId);
  const emails: string[] = [];
  for (const o of owners ?? []) {
    const { data } = await admin.auth.admin.getUserById(o.user_id);
    if (data.user?.email) emails.push(data.user.email);
  }
  return emails;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** "(cédula 1234567)" o "(estudiante de UNAM, No profesionista)", ya escapado. */
export function clinicianCredential(session: {
  vet: { cedula: string } | null;
  student: { university: string } | null;
}): string {
  if (session.student) return `(estudiante de ${escapeHtml(session.student.university)}, No profesionista)`;
  return `(cédula ${escapeHtml(session.vet?.cedula ?? "")})`;
}
