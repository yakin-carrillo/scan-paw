/*
 * Espacios de trabajo. Una cuenta puede tener varios a la vez (un MVZ también
 * puede ser dueño de mascotas). Esto solo decide qué navegación y qué pantallas
 * se muestran: los permisos reales los aplica la base de datos (RLS).
 */
import type { Session } from "@/lib/auth";

export type SpaceId = "propietario" | "clinico" | "clinica" | "admin";

export type NavIcon =
  | "mascotas"
  | "escanear"
  | "cuenta"
  | "hoy"
  | "pacientes"
  | "agenda"
  | "panel"
  | "calendario"
  | "equipo"
  | "plan"
  | "verificaciones"
  | "placas";

export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean };

export type SpaceInfo = {
  id: SpaceId;
  /** Texto del indicador en el encabezado. */
  label: string;
  /** Versión corta para pantallas angostas. */
  short: string;
  /** Segunda línea opcional (por ejemplo, el nombre de la clínica). */
  detail?: string;
  /** Cuenta pendiente de verificación. */
  pending?: boolean;
  home: string;
  nav: NavItem[];
};

const cuenta: NavItem = { href: "/cuenta", label: "Cuenta", icon: "cuenta" };

function clinicoSpace(session: Session): SpaceInfo | null {
  const role = session.profile.role;
  if (role !== "vet" && role !== "student") return null;
  const status = role === "vet" ? session.vet?.status : session.student?.status;
  const pending = status !== "approved";
  const label =
    role === "vet"
      ? pending
        ? "MVZ en revisión"
        : "MVZ verificado"
      : pending
        ? "Estudiante en revisión"
        : "Estudiante · No profesionista";
  return {
    id: "clinico",
    label,
    short: role === "vet" ? "MVZ" : "Estudiante",
    detail: session.clinic?.name,
    pending,
    home: "/vet",
    nav: pending
      ? [{ href: "/vet", label: "Inicio", icon: "hoy", exact: true }, cuenta]
      : [
          { href: "/vet", label: "Hoy", icon: "hoy", exact: true },
          { href: "/vet/pacientes", label: "Pacientes", icon: "pacientes" },
          { href: "/vet/agenda", label: "Agenda", icon: "agenda" },
          { href: "/escanear", label: "Escanear", icon: "escanear" },
          cuenta,
        ],
  };
}

/** Espacios disponibles para la sesión, el principal primero. */
export function buildSpaces(session: Session): SpaceInfo[] {
  const spaces: SpaceInfo[] = [];
  const propietario: SpaceInfo = {
    id: "propietario",
    label: "Propietario",
    short: "Propietario",
    home: "/mascotas",
    nav: [
      { href: "/mascotas", label: "Mascotas", icon: "mascotas" },
      { href: "/escanear", label: "Escanear", icon: "escanear" },
      cuenta,
    ],
  };

  if (session.profile.role === "admin") {
    spaces.push({
      id: "admin",
      label: "Administración",
      short: "Admin",
      home: "/admin",
      nav: [
        { href: "/admin", label: "Verificar", icon: "verificaciones", exact: true },
        { href: "/admin/placas", label: "Placas", icon: "placas" },
        cuenta,
      ],
    });
  }

  if (session.clinic?.isAdmin) {
    const pending = session.clinic.status !== "verificada";
    spaces.push({
      id: "clinica",
      label: pending ? "Clínica en revisión" : "Admin. de clínica",
      short: "Clínica",
      detail: session.clinic.name,
      pending,
      home: "/clinica",
      nav: [
        { href: "/clinica", label: "Panel", icon: "panel", exact: true },
        { href: "/clinica/calendario", label: "Calendario", icon: "calendario" },
        { href: "/clinica/equipo", label: "Equipo", icon: "equipo" },
        { href: "/clinica/plan", label: "Plan", icon: "plan" },
        cuenta,
      ],
    });
  }

  const clinico = clinicoSpace(session);
  if (clinico) spaces.push(clinico);
  spaces.push(propietario);
  return spaces;
}

/** Espacio que corresponde sin ambigüedad a una ruta, si lo hay. */
export function spaceForPath(pathname: string): SpaceId | null {
  if (pathname === "/mascotas" || pathname === "/mascotas/nueva" || pathname.startsWith("/placas")) return "propietario";
  if (pathname === "/vet" || pathname.startsWith("/vet/")) return "clinico";
  if (pathname === "/clinica" || pathname.startsWith("/clinica/")) return "clinica";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  return null;
}

export const SPACE_COOKIE = "sp-espacio";

export function isSpaceId(value: string | undefined): value is SpaceId {
  return value === "propietario" || value === "clinico" || value === "clinica" || value === "admin";
}
