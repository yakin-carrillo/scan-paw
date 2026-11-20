import { BadgeCheck, CircleDashed, CreditCard, Lock } from "lucide-react";
import { Alert, ButtonLink, Card, cx, formatDate } from "@/components/ui";
import type { ClinicMembership } from "@/lib/types";

/** Pasos para que la clínica pueda operar: verificación y plan. */
export function SetupSteps({ clinic }: { clinic: ClinicMembership }) {
  const verified = clinic.status === "verificada";
  const planOk = clinic.planStatus !== "sin_plan" && clinic.planUntil && new Date(clinic.planUntil) > new Date();
  const steps = [
    {
      done: verified,
      icon: BadgeCheck,
      title: "Verificación de la clínica",
      text:
        clinic.status === "rechazada"
          ? "No pudimos verificar la clínica. Escríbenos para revisarlo."
          : verified
            ? "Verificada por Scan-Paw."
            : "Revisamos los datos de la clínica. Te avisaremos al terminar.",
    },
    {
      done: Boolean(planOk),
      icon: CreditCard,
      title: "Plan Scan-Paw Clínicas",
      text: planOk ? `Vigente hasta el ${formatDate(clinic.planUntil)}.` : "Actívalo para usar la agenda y validar a tu equipo.",
      action: planOk ? null : <ButtonLink href="/clinica/plan" className="mt-2">Ver el plan</ButtonLink>,
    },
  ];
  return (
    <Card>
      <h2 className="text-lg font-semibold">Para empezar</h2>
      <ol className="mt-4 flex flex-col gap-4">
        {steps.map((s) => (
          <li key={s.title} className="flex gap-3">
            <span
              className={cx(
                "grid size-9 shrink-0 place-items-center rounded-full",
                s.done ? "bg-verified-soft text-verified" : "bg-surface-2 text-muted",
              )}
            >
              {s.done ? <s.icon aria-hidden className="size-4" /> : <CircleDashed aria-hidden className="size-4" />}
            </span>
            <div className="min-w-0">
              <p className="font-medium">{s.title}</p>
              <p className="text-sm text-muted">{s.text}</p>
              {s.action}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Aviso para pantallas que requieren clínica verificada y plan vigente. */
export function OperationalGate({ clinic }: { clinic: ClinicMembership }) {
  if (clinic.operational) return null;
  return (
    <Alert tone="warning" title="Función del plan Scan-Paw Clínicas">
      <span className="inline-flex items-center gap-1.5">
        <Lock aria-hidden className="size-3.5" />
        {clinic.status !== "verificada"
          ? "Disponible cuando verifiquemos la clínica y actives el plan."
          : "Activa el plan para usar esta sección."}
      </span>{" "}
      <a href="/clinica/plan" className="font-medium underline">
        Ver el plan
      </a>
    </Alert>
  );
}
