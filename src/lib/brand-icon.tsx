import { ImageResponse } from "next/og";

const INDIGO = "#262a6b";
const CORAL = "#ff6f59";
const ARENA = "#f6f1ea";

// Mismas formas que brand/scanpaw-icono.svg (caja de 512).
const PAW =
  "<ellipse cx='171' cy='246' rx='28' ry='40' transform='rotate(-32 171 246)'/>" +
  "<ellipse cx='219' cy='182' rx='30' ry='42' transform='rotate(-12 219 182)'/>" +
  "<ellipse cx='293' cy='182' rx='30' ry='42' transform='rotate(12 293 182)'/>" +
  "<ellipse cx='341' cy='246' rx='28' ry='40' transform='rotate(32 341 246)'/>" +
  "<path d='M256 255C283 255 303 270 317 289C326 302 333 316 338 328C344 344 339 361 322 361C305 361 285 346 256 346C227 346 207 361 190 361C173 361 168 344 174 328C179 316 186 302 195 289C209 270 229 255 256 255Z'/>";
const FRAME =
  "<path d='M66 165V66H165'/><path d='M347 66H446V165'/><path d='M446 347V446H347'/><path d='M165 446H66V347'/>";

/** Contenido del ícono en la caja de 512 (igual que brand/scanpaw-icono.svg y scanpaw-favicon.svg). */
function symbol(small: boolean): string {
  if (small) {
    // Hasta 64 px: sin visor y con la huella más grande.
    return `<g fill='${ARENA}' transform='translate(256 256) scale(1.6) translate(-256 -251)'>${PAW}</g>`;
  }
  return `<g fill='none' stroke='${CORAL}' stroke-width='30' stroke-linecap='round' stroke-linejoin='round'>${FRAME}</g><g fill='${ARENA}'>${PAW}</g>`;
}

/** Insignia monocroma de los avisos en Android: huella blanca sobre fondo transparente. */
export function brandBadge(size: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='132 134 248 232'><g fill='#ffffff'>${PAW}</g></svg>`;
  const src = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element -- ImageResponse dibuja <img> con data URI
      <img src={src} width={size} height={size} alt="" />
    ),
    { width: size, height: size },
  );
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
