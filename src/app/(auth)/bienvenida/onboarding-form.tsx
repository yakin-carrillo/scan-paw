"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { GraduationCap, PawPrint, Stethoscope } from "lucide-react";
import { Alert, Button, Card, cx, Field, Input } from "@/components/ui";
import { completeOnboarding, type OnboardingState } from "../actions";

const TYPES = [
  { id: "owner", label: "Propietario", text: "Tengo perros o gatos", icon: PawPrint },
  { id: "vet", label: "Médico veterinario", text: "Con cédula profesional", icon: Stethoscope },
  { id: "student", label: "Estudiante", text: "De medicina veterinaria", icon: GraduationCap },
] as const;

type Tipo = (typeof TYPES)[number]["id"];

export function OnboardingForm({ initialTipo, next, defaultName }: { initialTipo: Tipo; next: string; defaultName: string }) {
  const [tipo, setTipo] = useState<Tipo>(initialTipo);
  const [state, action] = useActionState<OnboardingState, FormData>(completeOnboarding, { error: null });
  const v = state.values ?? {};

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-3 text-sm font-medium">¿Cómo usarás Scan-Paw?</legend>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => {
            const active = t.id === tipo;
            return (
              <label
                key={t.id}
                className={cx(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border p-3 text-center transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand",
                  active ? "border-brand bg-brand-soft shadow-card" : "border-border bg-surface hover:border-brand/40",
                )}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={t.id}
                  checked={active}
                  onChange={() => setTipo(t.id)}
                  className="sr-only"
                />
                <t.icon aria-hidden className={cx("size-6", active ? "text-brand" : "text-muted")} />
                <span className="text-sm leading-tight font-semibold">{t.label}</span>
                <span className="hidden text-xs text-muted sm:block">{t.text}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {state.error && <Alert tone="error">{state.error}</Alert>}

      <Card className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Nombre completo" hint={tipo === "vet" ? "Tal como aparece en tu cédula profesional." : undefined}>
          <Input name="full_name" required minLength={3} maxLength={120} autoComplete="name" defaultValue={v.full_name ?? defaultName} />
        </Field>
        <Field label="Teléfono (WhatsApp)" hint="10 dígitos. Se mostrará en la placa de tus mascotas solo si lo permites.">
          <Input
            name="phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="55 1234 5678"
            defaultValue={v.phone}
            pattern="\+?[0-9 ]{10,15}"
          />
        </Field>
        {tipo === "vet" && (
          <>
            <Field label="Cédula profesional" hint="7 u 8 dígitos. La verificamos en el Registro Nacional de Profesionistas.">
              <Input name="cedula" inputMode="numeric" required pattern="[0-9]{7,8}" autoComplete="off" defaultValue={v.cedula} />
            </Field>
            <Field label="Clínica (opcional)">
              <Input name="clinic_name" maxLength={120} autoComplete="organization" defaultValue={v.clinic_name} />
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
              <Input
                name="university"
                required
                minLength={3}
                maxLength={120}
                placeholder="UNAM, Facultad de Medicina Veterinaria y Zootecnia"
                defaultValue={v.university}
              />
            </Field>
            <Field label="Matrícula o número de cuenta" hint="La validamos con tu credencial o constancia de estudios.">
              <Input name="enrollment_id" required pattern="[0-9A-Za-z\-]{4,20}" autoComplete="off" defaultValue={v.enrollment_id} />
            </Field>
            <Alert tone="warning" title="Cuenta de estudiante · No profesionista">
              Una vez verificada podrás consultar expedientes y registrar información, pero cada entrada llevará la marca
              &quot;No profesionista&quot; para que el propietario y los MVZ lo sepan.
            </Alert>
          </>
        )}
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="privacy" required defaultChecked={v.privacy === "on"} className="mt-0.5 size-4 accent-[var(--brand)]" />
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
      </Card>
    </form>
  );
}
