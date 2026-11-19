import { cx } from "./button-styles";

/*
 * Símbolo de Scan-Paw (guía de identidad 1.0): huella con dedos como módulos
 * de QR y almohadilla de corazón, dentro de un visor de escaneo.
 * Mismas coordenadas que brand/scanpaw-icono.svg (caja de 512).
 */
const TOES = [
  { x: 124, y: 194, h: 68, r: -24, cx: 154, cy: 228 },
  { x: 188, y: 134, h: 70, r: -8, cx: 218, cy: 169 },
  { x: 264, y: 134, h: 70, r: 8, cx: 294, cy: 169 },
  { x: 328, y: 194, h: 68, r: 24, cx: 358, cy: 228 },
];
export const HEART_PATH =
  "M256 398c-17-11-90-53-90-106 0-30 22-51 49-51 18 0 32 9 41 23 9-14 23-23 41-23 27 0 49 21 49 51 0 53-73 95-90 106z";
const FRAME_PATHS = [
  "M96 168V128a32 32 0 0 1 32-32h40",
  "M344 96h40a32 32 0 0 1 32 32v40",
  "M416 344v40a32 32 0 0 1-32 32h-40",
  "M168 416h-40a32 32 0 0 1-32-32v-40",
];

function Toes() {
  return TOES.map((t) => (
    <rect key={t.x} x={t.x} y={t.y} width={60} height={t.h} rx={23} transform={`rotate(${t.r} ${t.cx} ${t.cy})`} />
  ));
}

/** Huella sola, en el color del texto (para sellos e íconos pequeños). */
export function PawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="112 124 288 284" aria-hidden className={className} fill="currentColor">
      <Toes />
      <path d={HEART_PATH} />
    </svg>
  );
}

/** Símbolo completo: visor coral y huella en el color del texto. */
export function BrandSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="80 80 352 352" aria-hidden className={className}>
      <g fill="none" stroke="var(--coral)" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round">
        {FRAME_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="currentColor">
        <Toes />
        <path d={HEART_PATH} />
      </g>
    </svg>
  );
}

/** Ícono de la app: símbolo sobre índigo. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={cx("shrink-0", className)}>
      <rect width={512} height={512} rx={116} fill="#262a6b" />
      <g fill="none" stroke="#ff6f59" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round">
        {FRAME_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="#f6f1ea">
        <Toes />
        <path d={HEART_PATH} />
      </g>
    </svg>
  );
}

/** Logotipo: ícono + "scanpaw" en Sora, como en brand/scanpaw-logo.svg. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <AppIcon className="size-9" />
      {!compact && (
        <span className="font-display text-[1.35rem] leading-none font-semibold tracking-[-0.02em]">
          <span className="text-brand">scan</span>
          <span className="text-coral">paw</span>
        </span>
      )}
    </span>
  );
}
