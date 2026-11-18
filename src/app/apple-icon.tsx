import { brandIcon } from "@/lib/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS redondea las esquinas por su cuenta: el ícono va cuadrado.
export default function AppleIcon() {
  return brandIcon(180);
}
