import { ImageResponse } from "next/og";

const INDIGO = "#262a6b";
const CORAL = "#ff6f59";
const ARENA = "#f6f1ea";

const TOES = [
  "<rect x='124' y='194' width='60' height='68' rx='23' transform='rotate(-24 154 228)'/>",
  "<rect x='188' y='134' width='60' height='70' rx='23' transform='rotate(-8 218 169)'/>",
  "<rect x='264' y='134' width='60' height='70' rx='23' transform='rotate(8 294 169)'/>",
  "<rect x='328' y='194' width='60' height='68' rx='23' transform='rotate(24 358 228)'/>",
].join("");
const HEART =
  "M256 398c-17-11-90-53-90-106 0-30 22-51 49-51 18 0 32 9 41 23 9-14 23-23 41-23 27 0 49 21 49 51 0 53-73 95-90 106z";
const FRAME =
  "<path d='M96 168V128a32 32 0 0 1 32-32h40'/><path d='M344 96h40a32 32 0 0 1 32 32v40'/><path d='M416 344v40a32 32 0 0 1-32 32h-40'/><path d='M168 416h-40a32 32 0 0 1-32-32v-40'/>";

/** Contenido del ícono en la caja de 512 (igual que brand/scanpaw-icono.svg y scanpaw-favicon.svg). */
function symbol(small: boolean): string {
  if (small) {
    // Hasta 64 px: sin visor, huella más grande y corazón coral.
    return `<g transform='translate(256 262) scale(1.38) translate(-256 -266)'><g fill='${ARENA}'>${TOES}</g><path fill='${CORAL}' d='${HEART}'/></g>`;
  }
  return `<g fill='none' stroke='${CORAL}' stroke-width='22' stroke-linecap='round' stroke-linejoin='round'>${FRAME}</g><g fill='${ARENA}'>${TOES}<path d='${HEART}'/></g>`;
}

/**
 * Íconos PNG de la app (favicon, Apple, manifest) a partir del logo vectorial.
 * `padded` deja el símbolo dentro de la zona segura de los íconos "maskable".
 */
export function brandIcon(size: number, { padded = false, rounded = false } = {}) {
  const inner = padded ? `<g transform='translate(256 256) scale(0.8) translate(-256 -256)'>${symbol(false)}</g>` : symbol(size <= 64);
  const radius = rounded ? 116 : 0;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect width='512' height='512' rx='${radius}' fill='${INDIGO}'/>${inner}</svg>`;
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element -- ImageResponse dibuja <img> con data URI
      <img src={src} width={size} height={size} alt="" />
    ),
    { width: size, height: size },
  );
}
