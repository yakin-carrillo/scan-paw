import { redirect } from "next/navigation";
import QRCode from "qrcode";
import {
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  ClipboardList,
  GraduationCap,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  Siren,
  Stethoscope,
  Syringe,
} from "lucide-react";
import { PawMark } from "@/components/logo";
import { ButtonLink, Card, cx } from "@/components/ui";
import { getSession, isClinicianRole } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import { formatMXN, PLAN_FEATURES, PLANS } from "@/lib/plans";

const steps = [
  {
    icon: ClipboardList,
    title: "Registra a tu mascota",
    text: "Identificación, vacunas, alergias, padecimientos crónicos, estudios y recetas en un solo lugar.",
  },
  {
    icon: QrCode,
    title: "Activa su placa QR",
    text: "La placa va en el collar. Si alguien la encuentra, ve tu nombre y teléfono; nada más.",
  },
  {
    icon: Stethoscope,
    title: "El MVZ la escanea",
    text: "Cualquier médico verificado consulta el historial completo por 7 días y tú recibes un aviso.",
  },
];

const audiences = [
  {
    icon: PawPrint2,
    title: "Propietarios",
    points: ["Historial que viaja contigo de clínica en clínica", "Modo extraviado con ubicación", "Recordatorios de vacunas"],
  },
  {
    icon: Stethoscope,
    title: "MVZ y clínicas",
    points: ["Alergias y crónicos antes de la consulta", "Agenda de citas y vacunas", "Registros firmados con tu cédula"],
  },
  {
    icon: GraduationCap,
    title: "Estudiantes",
    points: ["Cuenta verificada con matrícula", "Práctica con expedientes reales", "Entradas marcadas como No profesionista"],
  },
];

function PawPrint2(props: { className?: string }) {
  return <PawMark className={props.className} />;
}

async function SampleQr() {
  const svg = await QRCode.toString(`${siteUrl()}/p/EJEMPLO`, {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 0,
    color: { dark: "#161833", light: "#00000000" },
  });
  return <div aria-hidden className="size-full [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** Ilustración del producto: la placa del collar y lo que ve quien la escanea. */
function HeroVisual() {
  return (
    <div aria-hidden className="relative mx-auto h-[23rem] w-full max-w-sm select-none sm:h-[26rem]">
      <div className="absolute inset-x-6 top-6 bottom-0 rounded-[2.5rem] bg-gradient-to-br from-brand-soft via-surface-2 to-accent-soft" />
      {/* teléfono */}
      <div className="absolute top-0 right-2 w-[13.5rem] rotate-3 rounded-[2rem] border border-border bg-surface p-3 shadow-lift sm:w-60">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
        <div className="rounded-2xl bg-danger px-3 py-2 text-[11px] font-semibold text-danger-ink">
          <span className="flex items-center gap-1.5">
            <Siren className="size-3.5" /> Luna está extraviada
          </span>
        </div>
        <div className="mt-3 flex flex-col items-center gap-2 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-soft to-accent-soft text-brand">
            <PawMark className="size-8" />
          </div>
          <p className="font-display text-lg font-semibold">Hola, soy Luna</p>
          <p className="text-[11px] text-muted">Mi familia: Ana</p>
          <div className="grid w-full grid-cols-2 gap-1.5">
            <span className="flex items-center justify-center gap-1 rounded-xl bg-deep py-2 text-[11px] font-medium text-on-deep">
              <Phone className="size-3.5" /> Llamar
            </span>
            <span className="flex items-center justify-center gap-1 rounded-xl border border-border py-2 text-[11px] font-medium">
              <MessageCircle className="size-3.5" /> WhatsApp
            </span>
          </div>
          <span className="flex w-full items-center justify-center gap-1 rounded-xl border border-border py-2 text-[11px]">
            <MapPin className="size-3.5" /> Enviar mi ubicación
          </span>
        </div>
      </div>
      {/* placa del collar */}
      <div className="absolute bottom-6 left-0 -rotate-6">
        <div className="mx-auto h-6 w-3 rounded-t-full border-4 border-b-0 border-coral/70" />
        <div className="grid size-40 place-items-center rounded-full border-[6px] border-coral bg-white p-7 shadow-lift sm:size-44">
          <SampleQr />
        </div>
        <p className="mt-2 text-center font-mono text-xs tracking-widest text-muted">SCAN-PAW</p>
      </div>
      {/* tarjeta flotante del MVZ */}
      <div className="absolute right-0 bottom-2 flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-lift">
        <span className="grid size-8 place-items-center rounded-lg bg-brand-soft text-brand">
          <BadgeCheck className="size-4" />
        </span>
        <span className="text-[11px] leading-tight">
          <span className="block font-semibold">Alergia: penicilina</span>
          <span className="text-muted">Registrado por MVZ</span>
        </span>
      </div>
    </div>
  );
}

export default async function Home() {
  // Con sesión (p. ej. al abrir la app desde la pantalla de inicio) va directo a su panel.
  const session = await getSession();
  if (session && !session.onboarded) redirect("/bienvenida");
  if (session && isClinicianRole(session.profile.role)) redirect("/vet");
  if (session) redirect("/mascotas");

  return (
    <div className="flex flex-col gap-20 pb-6">
      <section className="grid items-center gap-10 pt-2 md:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-5">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            <span className="size-1.5 rounded-full bg-coral" /> Para perros y gatos en México
          </p>
          <h1 className="text-4xl leading-[1.05] font-semibold sm:text-6xl">
            Su historia, <span className="text-accent">siempre con ellos.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted">
            El historial clínico de tu mascota viaja en su placa QR, a cualquier clínica. Tú decides quién lo ve; solo
            médicos veterinarios verificados pueden abrirlo, y si se pierde, quien la encuentre sabrá cómo avisarte.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/entrar" size="lg">
              Crear cuenta gratis
            </ButtonLink>
            <ButtonLink href="/entrar?next=%2Fbienvenida%3Ftipo%3Dvet" size="lg" variant="secondary">
              <Stethoscope aria-hidden /> Soy médico veterinario
            </ButtonLink>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <li className="flex items-center gap-1.5">
              <Lock aria-hidden className="size-4 text-brand" /> Datos protegidos
            </li>
            <li className="flex items-center gap-1.5">
              <BadgeCheck aria-hidden className="size-4 text-brand" /> Cédulas verificadas
            </li>
            <li className="flex items-center gap-1.5">
              <Bell aria-hidden className="size-4 text-brand" /> Avisos de cada acceso
            </li>
          </ul>
        </div>
        <HeroVisual />
      </section>

      <section>
        <p className="text-xs font-semibold tracking-wider text-accent uppercase">Cómo funciona</p>
        <h2 className="mt-1 text-3xl font-semibold">Tres pasos, una sola historia clínica</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Card className="h-full">
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                    <s.icon aria-hidden className="size-5" />
                  </span>
                  <span className="font-display text-4xl font-semibold text-border">{i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {audiences.map((a, i) => (
          <div
            key={a.title}
            className={cx(
              "rounded-3xl p-6",
              i === 0 ? "paw-pattern bg-deep text-on-deep" : "border border-border bg-surface shadow-card",
            )}
          >
            <a.icon className={cx("size-8", i === 0 ? "" : "text-brand")} />
            <h3 className="mt-4 text-xl font-semibold">{a.title}</h3>
            <ul className={cx("mt-3 flex flex-col gap-2 text-sm", i === 0 ? "text-on-deep/90" : "text-muted")}>
              {a.points.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="grid items-center gap-8 md:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-xs font-semibold tracking-wider text-accent uppercase">Membresía</p>
          <h2 className="mt-1 text-3xl font-semibold">Un plan por mascota. Gratis para clínicas.</h2>
          <p className="mt-3 text-muted">
            El propietario paga la membresía de cada mascota. Médicos veterinarios, clínicas y estudiantes usan Scan-Paw
            sin costo.
          </p>
          <ul className="mt-5 flex flex-col gap-2 text-sm">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <Check aria-hidden className="size-4 text-brand" /> {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((id) => {
            const p = PLANS[id];
            const featured = id === "anual";
            return (
              <Card key={id} className={cx(featured && "border-brand ring-4 ring-brand/10")}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{p.label}</h3>
                  {featured && (
                    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">
                      Recomendado
                    </span>
                  )}
                </div>
                <p className="mt-3">
                  <span className="font-display text-4xl font-semibold">{formatMXN(p.price)}</span>
                  <span className="text-sm text-muted"> / {p.period}</span>
                </p>
                <p className="mt-1 text-sm text-muted">{p.note}</p>
              </Card>
            );
          })}
          <p className="text-xs text-muted sm:col-span-2">Precios de referencia para la demostración, en pesos mexicanos.</p>
        </div>
      </section>

      <section className="paw-pattern flex flex-col items-start gap-5 rounded-3xl bg-deep p-8 text-on-deep sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div>
          <h2 className="text-2xl font-semibold sm:text-3xl">Que su historia clínica no se pierda.</h2>
          <p className="mt-2 flex items-center gap-2 text-sm opacity-80">
            <Syringe aria-hidden className="size-4" /> Vacunas, <CalendarDays aria-hidden className="size-4" /> citas y
            alergias en un solo lugar.
          </p>
        </div>
        <ButtonLink href="/entrar" size="lg" variant="accent">
          Empezar ahora
        </ButtonLink>
      </section>
    </div>
  );
}
