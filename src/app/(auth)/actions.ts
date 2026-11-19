"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession, homePath } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { cedulaSchema, firstError, formObject, friendlyDbError, optionalText, phoneSchema, safeNext } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/** Inicia el flujo OAuth con Google; vuelve a /auth/confirm con ?code=. */
export async function signInWithGoogle(formData: FormData) {
  // "/" envía a cada quien a su panel (o al registro guiado si es su primera vez).
  const next = safeNext(formData.get("next"), "/");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    redirect(`/entrar?error=${encodeURIComponent("No se pudo iniciar sesión con Google.")}`);
  }
  redirect(data.url);
}

const onboardingSchema = z
  .object({
    tipo: z.enum(["owner", "vet", "student"]),
    full_name: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
    phone: phoneSchema,
    cedula: optionalText(8),
    clinic_name: optionalText(120),
    university: optionalText(120),
    enrollment_id: optionalText(20),
    privacy: z.literal("on", { error: "Debes aceptar el aviso de privacidad." }),
    next: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.tipo === "vet" && !cedulaSchema.safeParse(d.cedula ?? "").success) {
      ctx.addIssue({ code: "custom", message: "La cédula profesional tiene 7 u 8 dígitos.", path: ["cedula"] });
    }
    if (d.tipo === "student") {
      if (!d.university || d.university.length < 3) {
        ctx.addIssue({ code: "custom", message: "Escribe el nombre de tu universidad.", path: ["university"] });
      }
      if (!/^[0-9A-Za-z-]{4,20}$/.test(d.enrollment_id ?? "")) {
        ctx.addIssue({ code: "custom", message: "La matrícula tiene de 4 a 20 letras o números.", path: ["enrollment_id"] });
      }
    }
  });

export type OnboardingState = { error: string | null; values?: Record<string, string> };

/**
 * Registro guiado: tipo de cuenta, teléfono, cédula o matrícula y consentimiento.
 * Se usa con useActionState para conservar lo escrito si hay un error.
 */
export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const session = await getSession();
  if (!session) redirect("/entrar");

  const raw = formObject(formData);
  // React reinicia el formulario tras la acción: devolvemos lo escrito para restaurarlo.
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error), values };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_role: d.tipo,
    p_full_name: d.full_name,
    p_phone: d.phone.replace(/\s/g, ""),
    p_cedula: d.tipo === "vet" ? d.cedula : null,
    p_clinic: d.tipo === "vet" ? (d.clinic_name ?? null) : null,
    p_university: d.tipo === "student" ? d.university : null,
    p_enrollment: d.tipo === "student" ? d.enrollment_id : null,
  });
  if (error) return { error: friendlyDbError(error.message), values };
  // Respeta el destino original (p. ej. la placa que escaneó antes de registrarse).
  const next = safeNext(d.next, "");
  const generic = !next || next === "/" || next === "/mascotas" || next.startsWith("/bienvenida");
  redirect(generic ? homePath(d.tipo) : next);
}
