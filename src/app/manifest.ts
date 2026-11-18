import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Scan-Paw · Historial clínico de tu mascota",
    short_name: "Scan-Paw",
    description: "Historial clínico universal de perros y gatos en una placa con código QR.",
    lang: "es-MX",
    start_url: "/?origen=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f3ee",
    theme_color: "#0f6f66",
    categories: ["medical", "lifestyle"],
    icons: [
      { src: "/iconos/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mis mascotas", url: "/mascotas", icons: [{ src: "/iconos/192", sizes: "192x192" }] },
      { name: "Panel MVZ", url: "/vet", icons: [{ src: "/iconos/192", sizes: "192x192" }] },
    ],
  };
}
