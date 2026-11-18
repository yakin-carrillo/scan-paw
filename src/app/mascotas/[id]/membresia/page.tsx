import { notFound } from "next/navigation";
import { Check, Crown } from "lucide-react";
import { Alert, BackLink, Badge, Button, Card, cx, FlashMessages, formatDate, PageTitle } from "@/components/ui";
import { loadPetRecord } from "@/lib/pets";
import { formatMXN, PLAN_FEATURES, PLANS, type PlanId } from "@/lib/plans";
import { membershipActive } from "@/lib/types";
import { activateMembership, cancelMembership } from "../../actions";

export const metadata = { title: "Membresía" };

export default async function MembresiaPage({ params, searchParams }: PageProps<"/mascotas/[id]/membresia">) {
  const { id } = await params;
  const query = await searchParams;
  const r = await loadPetRecord(id);
  if (!r.isOwner) notFound();
  const m = r.membership;
  const active = membershipActive(m);

  return (
    <div className="mx-auto max-w-3xl">
      <BackLink href={`/mascotas/${id}`}>Expediente de {r.pet.name}</BackLink>
      <PageTitle eyebrow="Membresía" title={`Plan de ${r.pet.name}`} subtitle="Un plan por mascota. Las clínicas no pagan." />
      <FlashMessages error={query.error} ok={query.ok} />

      <div className="mb-5">
        <Alert tone="warning" title="Modo demostración">
          No se realiza ningún cobro. Al activar un plan se marca la membresía como pagada para mostrar el flujo
          completo. La pasarela de pago se conectará después de definir el precio final.
        </Alert>
      </div>

      {m && (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
              <Crown aria-hidden className="size-5" />
            </span>
            <div>
              <p className="font-semibold">
                Plan {PLANS[m.plan].label.toLowerCase()}{" "}
                {active ? (
                  <Badge tone="brand">{m.status === "cancelada" ? "Cancelada" : "Activa"}</Badge>
                ) : (
                  <Badge>Vencida</Badge>
                )}
              </p>
              <p className="text-sm text-muted">
                {m.status === "cancelada" ? "Termina" : "Se renueva"} el {formatDate(m.current_period_end)}
              </p>
            </div>
          </div>
          {active && m.status === "activa" && (
            <form action={cancelMembership.bind(null, id)}>
              <Button variant="ghost" className="text-danger">
                Cancelar renovación
              </Button>
            </form>
          )}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(Object.keys(PLANS) as PlanId[]).map((planId) => {
          const p = PLANS[planId];
          const current = active && m?.plan === planId && m.status === "activa";
          return (
            <Card key={planId} className={cx(planId === "anual" && "border-brand ring-4 ring-brand/10")}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{p.label}</h2>
                {planId === "anual" && <Badge tone="accent">Recomendado</Badge>}
              </div>
              <p className="mt-3">
                <span className="font-display text-4xl font-semibold">{formatMXN(p.price)}</span>
                <span className="text-sm text-muted"> / {p.period}</span>
              </p>
              <p className="mt-1 text-sm text-muted">{p.note}</p>
              <ul className="mt-4 flex flex-col gap-2 text-sm">
                {PLAN_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check aria-hidden className="size-4 text-brand" /> {f}
                  </li>
                ))}
              </ul>
              <form action={activateMembership.bind(null, id, planId)} className="mt-5">
                <Button className="w-full" variant={planId === "anual" ? "primary" : "secondary"} disabled={current}>
                  {current ? "Plan actual" : active ? "Cambiar a este plan" : "Activar (demostración)"}
                </Button>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
