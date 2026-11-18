/**
 * Planes de membresía por mascota. Precios de referencia para la demo:
 * el cliente aún debe confirmar el precio final (se habló de 20 USD).
 * Las clínicas, MVZ y estudiantes no pagan.
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
