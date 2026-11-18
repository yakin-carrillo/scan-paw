import { z } from "zod";

/** Convierte "" en undefined para campos opcionales de formularios. */
export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const optionalDate = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.iso.date().optional(),
);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{10,15}$/, "Escribe un teléfono de 10 dígitos (puede incluir +52).");

export const cedulaSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{7,8}$/, "La cédula profesional tiene 7 u 8 dígitos.");

export function formObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa los datos del formulario.";
}

/** Traduce errores comunes de Supabase/Postgres a mensajes para el usuario. */
export function friendlyDbError(message: string | undefined): string {
  if (!message) return "Ocurrió un error. Intenta de nuevo.";
  if (message.includes("row-level security") || message.includes("permission denied")) {
    return "No tienes permiso para hacer esto.";
  }
  return message;
}

/** Evita redirecciones abiertas: solo rutas internas. */
export function safeNext(value: unknown, fallback = "/mascotas"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
