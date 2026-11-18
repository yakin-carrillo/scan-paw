import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

const buttonStyles = {
  primary: "bg-brand text-white hover:bg-brand-strong dark:text-black",
  secondary: "border border-border bg-surface hover:bg-brand-soft",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "hover:bg-brand-soft",
};

type Variant = keyof typeof buttonStyles;

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition disabled:opacity-50",
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition",
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
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
      className={cx("rounded-xl border border-border bg-surface p-5 shadow-sm", className)}
      {...props}
    />
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "error" | "warning" | "success";
  children: ReactNode;
}) {
  const tones = {
    info: "bg-brand-soft text-foreground",
    success: "bg-brand-soft text-brand-strong",
    error: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cx("rounded-lg px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "warning" | "danger";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-background text-muted border border-border",
    brand: "bg-brand-soft text-brand-strong",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Muestra ?error= / ?ok= que dejan las Server Actions al redirigir. */
export function FlashMessages({ error, ok }: { error?: string | string[]; ok?: string | string[] }) {
  const e = Array.isArray(error) ? error[0] : error;
  const o = Array.isArray(ok) ? ok[0] : ok;
  if (!e && !o) return null;
  return <div className="mb-4">{e ? <Alert tone="error">{e}</Alert> : <Alert tone="success">{o}</Alert>}</div>;
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
