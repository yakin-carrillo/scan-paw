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
    tipo: z.enum(["owner", "vet"]),
    full_name: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
    phone: phoneSchema,
    cedula: optionalText(8),
    clinic_name: optionalText(120),
    privacy: z.literal("on", { error: "Debes aceptar el aviso de privacidad." }),
    next: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.tipo === "vet" && !cedulaSchema.safeParse(d.cedula ?? "").success) {
      ctx.addIssue({ code: "custom", message: "La cédula profesional tiene 7 u 8 dígitos.", path: ["cedula"] });
    }
  });

/** Registro guiado: tipo de cuenta, teléfono, cédula (MVZ) y consentimiento. */
export async function completeOnboarding(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/entrar");

  const tipo = formData.get("tipo") === "vet" ? "vet" : "owner";
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
  });
  if (error) {
    redirect(`/bienvenida?tipo=${tipo}&error=${encodeURIComponent(friendlyDbError(error.message))}`);
  }
  redirect(d.tipo === "vet" ? "/vet" : safeNext(d.next));
}
