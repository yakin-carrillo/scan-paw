import "server-only";
import QRCode from "qrcode";
import { siteUrl } from "@/lib/env";

export function tagUrl(token: string): string {
  return `${siteUrl()}/p/${token}`;
}

/**
 * SVG listo para grabado láser. Corrección de errores "Q" (25 %) para tolerar
 * rayones; URL corta para que los módulos sean grandes en placas de ~2.5 cm.
 */
export function tagSvg(token: string): Promise<string> {
  return QRCode.toString(tagUrl(token), {
    type: "svg",
    errorCorrectionLevel: "Q",
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
