"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { cedulaSchema, firstError, formObject, optionalText, phoneSchema, safeNext } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const baseSignup = z.object({
  full_name: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
  email: z.email("Correo no válido."),
  phone: phoneSchema,
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  privacy: z.literal("on", { error: "Debes aceptar el aviso de privacidad." }),
});

const vetSignup = baseSignup.extend({
  cedula: cedulaSchema,
  clinic_name: optionalText(120),
});

export async function signUp(formData: FormData) {
  const type = formData.get("tipo") === "vet" ? "vet" : "owner";
  const back = `/registro${type === "vet" ? "?tipo=vet&" : "?"}`;
  const parsed = (type === "vet" ? vetSignup : baseSignup).safeParse(formObject(formData));
  if (!parsed.success) {
    redirect(`${back}error=${encodeURIComponent(firstError(parsed.error))}`);
  }
  const data = parsed.data as z.infer<typeof vetSignup>;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm?next=/mascotas`,
      data: {
        role: type,
        full_name: data.full_name,
        phone: data.phone.replace(/\s/g, ""),
        privacy_accepted: "true",
        ...(type === "vet" ? { cedula: data.cedula, clinic_name: data.clinic_name ?? null } : {}),
      },
    },
  });

  if (error) {
    redirect(`${back}error=${encodeURIComponent("No se pudo crear la cuenta: " + error.message)}`);
  }
  redirect(`/entrar?ok=${encodeURIComponent("Te enviamos un correo para confirmar tu cuenta.")}`);
}

const loginSchema = z.object({
  email: z.email("Correo no válido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});

export async function signIn(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const parsed = loginSchema.safeParse(formObject(formData));
  if (!parsed.success) {
    redirect(`/entrar?next=${encodeURIComponent(next)}&error=${encodeURIComponent(firstError(parsed.error))}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const msg =
      error.code === "email_not_confirmed"
        ? "Confirma tu correo antes de entrar."
        : "Correo o contraseña incorrectos.";
    redirect(`/entrar?next=${encodeURIComponent(next)}&error=${encodeURIComponent(msg)}`);
  }
  redirect(next);
}

export async function requestPasswordReset(formData: FormData) {
  const email = z.email().safeParse(formData.get("email"));
  if (email.success) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${siteUrl()}/auth/confirm?next=/cuenta/contrasena`,
    });
  }
  // Mismo mensaje exista o no la cuenta, para no revelar correos registrados.
  redirect(`/recuperar?ok=${encodeURIComponent("Si el correo existe, te enviamos un enlace.")}`);
}
