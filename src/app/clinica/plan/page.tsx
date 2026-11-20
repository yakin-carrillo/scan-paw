import { Building2, Check } from "lucide-react";
import { Alert, Badge, Button, Card, FlashMessages, formatDate, PageTitle } from "@/components/ui";
import { requireClinicAdmin } from "@/lib/auth";
import { CLINIC_FEATURES, CLINIC_PLAN, formatMXN } from "@/lib/plans";
import { activateClinicPlan, cancelClinicPlan } from "../actions";

export const metadata = { title: "Plan de la clínica" };

/** Paywall de negocio: sin plan vigente, las funciones de clínica se rechazan en la base de datos. */
export default async function ClinicaPlanPage({ searchParams }: PageProps<"/clinica/plan">) {
  const { clinic } = await requireClinicAdmin();
  const query = await searchParams;
  const vigente = clinic.planStatus !== "sin_plan" && clinic.planUntil && new Date(clinic.planUntil) > new Date();

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="Espacio Clínica" title="Plan para clínicas" subtitle="Para equipos que atienden juntos." />
      <FlashMessages error={query.error} ok={query.ok} />

      <div className="mb-5">
        <Alert tone="warning" title="Modo demostración">
          No se realiza ningún cobro. Activar el plan lo marca como pagado por 30 días para mostrar el flujo completo.
        </Alert>
      </div>

      <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
        <Card className="border-brand ring-4 ring-brand/10">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink">
              <Building2 aria-hidden className="size-5" />
            </span>
            <h2 className="text-xl font-semibold">{CLINIC_PLAN.label}</h2>
          </div>
          <p className="mt-4">
            <span className="font-display text-4xl font-semibold">{formatMXN(CLINIC_PLAN.price)}</span>
            <span className="text-sm text-muted"> / {CLINIC_PLAN.period} por clínica</span>
          </p>
          <ul className="mt-5 flex flex-col gap-2.5 text-sm">
            {CLINIC_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" /> {f}
              </li>
            ))}
          </ul>
          {!vigente || clinic.planStatus === "cancelada" ? (
            <form action={activateClinicPlan} className="mt-6">
              <Button size="lg" className="w-full">
                {clinic.planStatus === "cancelada" ? "Reactivar el plan" : "Activar plan (demo)"}
              </Button>
            </form>
          ) : null}
        </Card>

        <Card className="h-fit">
          <h2 className="font-semibold">Estado</h2>
          <p className="mt-2 text-sm">
            {vigente ? (
              <>
                <Badge tone={clinic.planStatus === "cancelada" ? "warning" : "verified"}>
                  {clinic.planStatus === "cancelada" ? "Cancelado" : "Activo"}
                </Badge>{" "}
                {clinic.planStatus === "cancelada" ? "Termina" : "Se renueva"} el {formatDate(clinic.planUntil)}.
              </>
            ) : (
              <Badge>Sin plan vigente</Badge>
            )}
          </p>
          <p className="mt-3 text-sm text-muted">
            {clinic.status === "verificada"
              ? "Clínica verificada."
              : "La clínica aún no está verificada: podrás usar el plan en cuanto la verifiquemos."}
          </p>
          {vigente && clinic.planStatus === "activa" && (
            <form action={cancelClinicPlan} className="mt-4">
              <Button
                variant="ghost"
                className="px-0 text-danger"
                confirm="¿Cancelar la renovación? El plan sigue vigente hasta el fin del periodo."
              >
                Cancelar renovación
              </Button>
            </form>
          )}
          <p className="mt-4 text-xs text-muted">
            Los propietarios siguen pagando la membresía de cada mascota; los MVZ y estudiantes usan Scan-Paw sin costo.
          </p>
        </Card>
      </div>
    </div>
  );
}
