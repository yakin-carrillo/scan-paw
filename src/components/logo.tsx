import { cx } from "./button-styles";

/*
 * Símbolo de Scan-Paw (guía de identidad 1.1): huella dentro de un visor de
 * escaneo con extremos redondeados. Mismas coordenadas que
 * brand/scanpaw-icono.svg (caja de 512).
 */
const TOES = [
  { cx: 171, cy: 246, rx: 28, ry: 40, rot: -32 },
  { cx: 219, cy: 182, rx: 30, ry: 42, rot: -12 },
  { cx: 293, cy: 182, rx: 30, ry: 42, rot: 12 },
  { cx: 341, cy: 246, rx: 28, ry: 40, rot: 32 },
];
/** Almohadilla principal: domo arriba y dos lóbulos abajo, simétrica. */
export const PAD_PATH =
  "M256 255C283 255 303 270 317 289C326 302 333 316 338 328C344 344 339 361 322 361C305 361 285 346 256 346C227 346 207 361 190 361C173 361 168 344 174 328C179 316 186 302 195 289C209 270 229 255 256 255Z";
const FRAME_PATHS = ["M66 165V66H165", "M347 66H446V165", "M446 347V446H347", "M165 446H66V347"];

function Paw() {
  return (
    <>
      {TOES.map((t) => (
        <ellipse key={t.cx} cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} transform={`rotate(${t.rot} ${t.cx} ${t.cy})`} />
      ))}
      <path d={PAD_PATH} />
    </>
  );
}

function Frame({ color }: { color: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth={30} strokeLinecap="round" strokeLinejoin="round">
      {FRAME_PATHS.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
}

/** Huella sola, en el color del texto (para sellos e íconos pequeños). */
export function PawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="132 134 248 232" aria-hidden className={className} fill="currentColor">
      <Paw />
    </svg>
  );
}

/** Símbolo completo: visor coral y huella en el color del texto. */
export function BrandSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="46 46 420 420" aria-hidden className={className}>
      <Frame color="var(--coral)" />
      <g fill="currentColor">
        <Paw />
      </g>
    </svg>
  );
}

/** Ícono de la app: símbolo sobre índigo. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden className={cx("shrink-0", className)}>
      <rect width={512} height={512} rx={116} fill="#262a6b" />
      <Frame color="#ff6f59" />
      <g fill="#f6f1ea">
        <Paw />
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
