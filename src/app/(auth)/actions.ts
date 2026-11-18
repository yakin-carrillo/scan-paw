"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { cedulaSchema, firstError, formObject, friendlyDbError, optionalText, phoneSchema, safeNext } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

/** Inicia el flujo OAuth con Google; vuelve a /auth/confirm con ?code=. */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
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

/** Registro guiado: tipo de cuenta, teléfono, cédula o matrícula y consentimiento. */
export async function completeOnboarding(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/entrar");

  const raw = formData.get("tipo");
  const tipo = raw === "vet" || raw === "student" ? raw : "owner";
  const parsed = onboardingSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    redirect(`/bienvenida?tipo=${tipo}&error=${encodeURIComponent(firstError(parsed.error))}`);
  }
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
  if (error) {
    redirect(`/bienvenida?tipo=${tipo}&error=${encodeURIComponent(friendlyDbError(error.message))}`);
  }
  redirect(d.tipo === "owner" ? safeNext(d.next) : "/vet");
}
