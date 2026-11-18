import { ImageResponse } from "next/og";

const BRAND = "#0f6f66";

/**
 * Ícono de Scan-Paw (huella blanca sobre fondo verde) dibujado con divs,
 * para no depender de archivos binarios ni de fuentes externas.
 * `padded` deja margen de seguridad para íconos "maskable" de Android.
 */
export function brandIcon(size: number, { padded = false, rounded = false } = {}) {
  const s = padded ? size * 0.72 : size * 0.86; // área útil de la huella
  const toe = s * 0.2;
  const pad = { w: s * 0.5, h: s * 0.4 };
  const white = "#ffffff";

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND,
          borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <div style={{ position: "relative", width: s, height: s, display: "flex" }}>
          {/* dedos */}
          <div style={{ position: "absolute", left: s * 0.08, top: s * 0.34, width: toe, height: toe * 1.2, borderRadius: "50%", background: white }} />
          <div style={{ position: "absolute", left: s * 0.27, top: s * 0.12, width: toe, height: toe * 1.25, borderRadius: "50%", background: white }} />
          <div style={{ position: "absolute", left: s * 0.53, top: s * 0.12, width: toe, height: toe * 1.25, borderRadius: "50%", background: white }} />
          <div style={{ position: "absolute", left: s * 0.72, top: s * 0.34, width: toe, height: toe * 1.2, borderRadius: "50%", background: white }} />
          {/* almohadilla */}
          <div
            style={{
              position: "absolute",
              left: (s - pad.w) / 2,
              top: s * 0.5,
              width: pad.w,
              height: pad.h,
              borderRadius: "48% 48% 42% 42%",
              background: white,
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
