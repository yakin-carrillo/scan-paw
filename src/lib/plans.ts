/**
 * Planes de membresía por mascota. Precios de referencia para la demo:
 * el cliente aún debe confirmar el precio final (se habló de 20 USD).
 * Los MVZ y estudiantes no pagan; las clínicas tienen su propio plan de negocio (CLINIC_PLAN).
 */
export const PLANS = {
  mensual: { label: "Mensual", price: 99, period: "mes", note: "Cancela cuando quieras" },
  anual: { label: "Anual", price: 990, period: "año", note: "Equivale a 2 meses gratis" },
} as const;

export type PlanId = keyof typeof PLANS;

export const PLAN_FEATURES = [
  "Placa QR para el collar",
  "Expediente clínico ilimitado",
  "Modo extraviado con aviso al instante",
  "Acceso para MVZ verificados",
  "Recordatorios de vacunas y citas",
];

export function formatMXN(amount: number): string {
  return amount.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

/** Plan para clínicas (modo demostración). Precio de referencia por confirmar con el cliente. */
export const CLINIC_PLAN = { label: "Scan-Paw Clínicas", price: 1490, period: "mes", seats: 10 } as const;

export const CLINIC_FEATURES = [
  "Hasta 10 miembros: MVZ y estudiantes de tu equipo",
  "Validación de tu equipo: tus MVZ quedan verificados en toda la red",
  "Agenda centralizada de todos tus MVZ, con reasignación y reagenda",
  "Suscripción al calendario en Google o Apple, por MVZ y de toda la clínica",
  "Avisos al MVZ, a la familia y a ti en cada cambio de cita",
  "Resumen diario de la agenda",
];
