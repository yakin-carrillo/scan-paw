import { cx } from "./ui";

/** Huella de Scan-Paw (misma silueta que el ícono de la app). */
export function PawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className} fill="currentColor">
      <ellipse cx="7.6" cy="14.2" rx="3" ry="3.7" transform="rotate(-18 7.6 14.2)" />
      <ellipse cx="12.6" cy="8.4" rx="3.1" ry="3.9" transform="rotate(-6 12.6 8.4)" />
      <ellipse cx="19.4" cy="8.4" rx="3.1" ry="3.9" transform="rotate(6 19.4 8.4)" />
      <ellipse cx="24.4" cy="14.2" rx="3" ry="3.7" transform="rotate(18 24.4 14.2)" />
      <path d="M16 15.2c-4.6 0-8.4 5.1-8.4 8.6 0 2.6 2 3.6 4.4 3.6 1.6 0 2.7-.7 4-.7s2.4.7 4 .7c2.4 0 4.4-1 4.4-3.6 0-3.5-3.8-8.6-8.4-8.6z" />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-brand-ink shadow-sm">
        <PawMark className="size-5" />
      </span>
      {!compact && (
        <span className="font-display text-xl font-semibold tracking-tight">
          Scan<span className="text-accent">-</span>Paw
        </span>
      )}
    </span>
  );
}
