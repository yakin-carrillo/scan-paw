import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, Cat, CircleCheck, Dog, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { buttonBase, buttonStyles, cx, sizes, type Variant } from "./button-styles";
import { CleanFlashParams } from "./clean-url";

export { cx } from "./button-styles";
export { Button } from "./button";

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={cx(buttonBase, sizes[size], buttonStyles[variant], className)} {...props} />;
}

const inputClass =
  "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 outline-none transition placeholder:text-muted/70 focus:border-brand focus:ring-4 focus:ring-brand/15";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea rows={3} {...props} className={cx(inputClass, props.className)} />;
}

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cx("rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6", className)}
      {...props}
    />
  );
}

/** Encabezado de tarjeta con ícono en pastilla. */
export function CardTitle({ icon: Icon, title, subtitle, tone = "brand" }: {
  icon?: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  tone?: "brand" | "accent" | "danger";
}) {
  const tones = { brand: "bg-brand-soft text-brand", accent: "bg-accent-soft text-accent", danger: "bg-danger-soft text-danger" };
  return (
    <div className="mb-4 flex items-start gap-3">
      {Icon && (
        <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", tones[tone])}>
          <Icon aria-hidden className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "error" | "warning" | "success";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: ["border-brand/20 bg-brand-soft text-foreground", Info],
    success: ["border-brand/25 bg-brand-soft text-brand-strong", CircleCheck],
    error: ["border-danger/25 bg-danger-soft text-danger", TriangleAlert],
    warning: ["border-warning/25 bg-warning-soft text-warning", TriangleAlert],
  } as const;
  const [style, Icon] = tones[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx("flex gap-3 rounded-xl border px-4 py-3 text-sm", style)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "brand" | "accent" | "verified" | "warning" | "danger";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted border border-border",
    brand: "bg-brand-soft text-brand-strong",
    accent: "bg-accent-soft text-accent",
    verified: "bg-verified-soft text-verified",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3.5",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg py-1 text-sm text-muted transition hover:text-foreground print:hidden"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {children}
    </Link>
  );
}

export function PageTitle({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
        <h1 className="text-[1.75rem] font-semibold leading-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon aria-hidden className="size-7" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1 max-w-sm text-sm text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Foto de la mascota o, si no hay, su silueta según la especie. */
export function PetAvatar({
  species,
  photoUrl,
  name,
  size = "md",
}: {
  species: "perro" | "gato" | null;
  photoUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dims = { sm: "size-12 rounded-xl", md: "size-16 rounded-2xl", lg: "size-24 rounded-3xl", xl: "size-36 rounded-[2rem]" };
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Storage
    return <img src={photoUrl} alt={`Foto de ${name}`} className={cx(dims[size], "shrink-0 object-cover shadow-card")} />;
  }
  const Icon = species === "gato" ? Cat : Dog;
  return (
    <div
      aria-hidden
      className={cx(dims[size], "grid shrink-0 place-items-center bg-gradient-to-br from-brand-soft to-accent-soft text-brand")}
    >
      <Icon className="size-1/2" strokeWidth={1.6} />
    </div>
  );
}

/** Muestra ?error= / ?ok= que dejan las Server Actions al redirigir. */
export function FlashMessages({ error, ok }: { error?: string | string[]; ok?: string | string[] }) {
  const e = Array.isArray(error) ? error[0] : error;
  const o = Array.isArray(ok) ? ok[0] : ok;
  if (!e && !o) return null;
  return (
    <div className="mb-4">
      {e ? <Alert tone="error">{e}</Alert> : <Alert tone="success">{o}</Alert>}
      <CleanFlashParams key={e ?? o} />
    </div>
  );
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return date.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: value.length === 10 ? "UTC" : "America/Mexico_City",
  });
}

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

export function speciesLabel(species: string | null | undefined): string {
  return species === "gato" ? "Gato" : "Perro";
}
