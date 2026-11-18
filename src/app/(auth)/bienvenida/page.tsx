import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, PawPrint, Stethoscope } from "lucide-react";
import { Alert, Button, Card, cx, Field, FlashMessages, Input, PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { completeOnboarding } from "../actions";

export const metadata = { title: "Completa tu registro" };

const TYPES = [
  { id: "owner", label: "Propietario", text: "Tengo perros o gatos", icon: PawPrint },
  { id: "vet", label: "Médico veterinario", text: "Con cédula profesional", icon: Stethoscope },
  { id: "student", label: "Estudiante", text: "De medicina veterinaria", icon: GraduationCap },
] as const;

export default async function BienvenidaPage({ searchParams }: PageProps<"/bienvenida">) {
  const params = await searchParams;
  const session = await getSession();
  if (!session) redirect("/entrar?next=/bienvenida");
  if (session.onboarded) redirect("/mascotas");

  const tipo = params.tipo === "vet" || params.tipo === "student" ? params.tipo : "owner";
  const next = safeNext(params.next);
  const qs = (t: string) => `/bienvenida?tipo=${t}${params.next ? `&next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="mx-auto max-w-lg">
      <PageTitle eyebrow="Último paso" title="Completa tu registro" subtitle={session.email ?? undefined} />
      <p className="mb-3 text-sm font-medium">¿Cómo usarás Scan-Paw?</p>
      <div className="mb-5 grid grid-cols-3 gap-2">
        {TYPES.map((t) => {
          const active = t.id === tipo;
          return (
            <Link
              key={t.id}
              href={qs(t.id)}
              aria-current={active ? "true" : undefined}
              className={cx(
                "flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition",
                active ? "border-brand bg-brand-soft shadow-card" : "border-border bg-surface hover:border-brand/40",
              )}
            >
              <t.icon aria-hidden className={cx("size-6", active ? "text-brand" : "text-muted")} />
              <span className="text-sm font-semibold leading-tight">{t.label}</span>
              <span className="hidden text-xs text-muted sm:block">{t.text}</span>
            </Link>
          );
        })}
      </div>
      <FlashMessages error={params.error} />
      <Card>
        <form action={completeOnboarding} className="flex flex-col gap-4">
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="next" value={next} />
          <Field label="Nombre completo" hint={tipo === "vet" ? "Tal como aparece en tu cédula profesional." : undefined}>
            <Input name="full_name" required autoComplete="name" defaultValue={session.profile.full_name} />
          </Field>
          <Field label="Teléfono (WhatsApp)" hint="Se mostrará en la placa de tus mascotas solo si lo permites.">
            <Input name="phone" type="tel" required autoComplete="tel" placeholder="55 1234 5678" />
          </Field>
          {tipo === "vet" && (
            <>
              <Field label="Cédula profesional" hint="7 u 8 dígitos. La verificamos en el Registro Nacional de Profesionistas.">
                <Input name="cedula" inputMode="numeric" required pattern="[0-9]{7,8}" />
              </Field>
              <Field label="Clínica (opcional)">
                <Input name="clinic_name" />
              </Field>
              <Alert tone="warning">
                Podrás consultar y escribir en expedientes cuando se verifique tu cédula. El tipo de cuenta no se puede
                cambiar después.
              </Alert>
            </>
          )}
          {tipo === "student" && (
            <>
              <Field label="Universidad y facultad">
                <Input name="university" required placeholder="UNAM, Facultad de Medicina Veterinaria y Zootecnia" />
              </Field>
              <Field label="Matrícula o número de cuenta" hint="La validamos con tu credencial o constancia de estudios.">
                <Input name="enrollment_id" required pattern="[0-9A-Za-z\-]{4,20}" autoComplete="off" />
              </Field>
              <Alert tone="warning" title="Cuenta de estudiante · No profesionista">
                Una vez verificada podrás consultar expedientes y registrar información, pero cada entrada llevará la
                marca &quot;No profesionista&quot; para que el propietario y los MVZ lo sepan.
              </Alert>
            </>
          )}
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="privacy" required className="mt-0.5 size-4 accent-[var(--brand)]" />
            <span>
              Leí y acepto el{" "}
              <Link href="/privacidad" className="underline" target="_blank">
                aviso de privacidad
              </Link>{" "}
              y doy mi consentimiento para el tratamiento de mis datos personales.
            </span>
          </label>
          <Button type="submit" size="lg">
            Continuar
          </Button>
        </form>
      </Card>
    </div>
  );
}
