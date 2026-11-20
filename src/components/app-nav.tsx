"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  PawPrint,
  QrCode,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Sun,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cx } from "./button-styles";
import { SPACE_COOKIE, spaceForPath, type NavIcon, type NavItem, type SpaceId, type SpaceInfo } from "@/lib/spaces";

const ICONS: Record<NavIcon, LucideIcon> = {
  mascotas: PawPrint,
  escanear: ScanLine,
  cuenta: User,
  hoy: Sun,
  pacientes: Stethoscope,
  agenda: CalendarDays,
  panel: LayoutDashboard,
  calendario: CalendarRange,
  equipo: Users,
  plan: CreditCard,
  verificaciones: ClipboardCheck,
  placas: QrCode,
};

/** Color de cada espacio dentro de la paleta de marca. */
const TONES: Record<SpaceId, { pill: string; nav: string; dot: string }> = {
  propietario: { pill: "bg-accent-soft text-accent", nav: "bg-accent-soft text-accent", dot: "bg-coral" },
  clinico: { pill: "bg-verified-soft text-verified", nav: "bg-verified-soft text-verified", dot: "bg-verified" },
  clinica: { pill: "bg-brand-soft text-brand", nav: "bg-brand-soft text-brand", dot: "bg-brand" },
  admin: { pill: "bg-foreground text-background", nav: "bg-surface-2 text-foreground", dot: "bg-foreground" },
};

function SpaceIcon({ space, className }: { space: SpaceInfo; className?: string }) {
  if (space.id === "propietario") return <PawPrint aria-hidden className={className} />;
  if (space.id === "clinica") return <Building2 aria-hidden className={className} />;
  if (space.id === "admin") return <ShieldCheck aria-hidden className={className} />;
  if (space.short === "Estudiante") return <GraduationCap aria-hidden className={className} />;
  return space.pending ? <Stethoscope aria-hidden className={className} /> : <BadgeCheck aria-hidden className={className} />;
}

type Ctx = { spaces: SpaceInfo[]; active: SpaceInfo | null };
const SpacesContext = createContext<Ctx>({ spaces: [], active: null });

/**
 * Decide el espacio activo: por la ruta cuando es inequívoca (/vet, /clinica…)
 * y, en rutas compartidas (/cuenta, un expediente), el último espacio usado.
 */
export function SpacesProvider({
  spaces,
  remembered,
  children,
}: {
  spaces: SpaceInfo[];
  remembered: SpaceId | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [last, setLast] = useState<SpaceId | null>(remembered);
  const fromPath = spaceForPath(pathname);
  const pick = (id: SpaceId | null) => (id ? spaces.find((s) => s.id === id) : undefined);
  const active = pick(fromPath) ?? pick(last) ?? spaces[0] ?? null;

  const known = fromPath !== null && spaces.some((s) => s.id === fromPath);
  if (known && fromPath !== last) setLast(fromPath);

  useEffect(() => {
    if (!known) return;
    document.cookie = `${SPACE_COOKIE}=${fromPath}; path=/; max-age=31536000; samesite=lax`;
  }, [known, fromPath]);

  return <SpacesContext.Provider value={{ spaces, active }}>{children}</SpacesContext.Provider>;
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Indicador del rol activo; si la cuenta tiene varios espacios, también es el selector. */
export function SpaceSwitcher() {
  const { spaces, active } = useContext(SpacesContext);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!active) return null;
  const multiple = spaces.length > 1;
  const pill = (
    <>
      <SpaceIcon space={active} className="size-4 shrink-0" />
      <span className="flex min-w-0 flex-col text-left leading-tight">
        <span className="truncate">
          <span className="sm:hidden">{active.short}</span>
          <span className="hidden sm:inline">{active.label}</span>
        </span>
        {active.detail && (
          <span className="hidden truncate text-[11px] font-normal opacity-80 sm:block">{active.detail}</span>
        )}
      </span>
      {active.pending && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />}
    </>
  );
  const pillClass = cx(
    "inline-flex max-w-[11rem] min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold sm:max-w-[16rem]",
    TONES[active.id].pill,
  );

  if (!multiple) {
    return (
      <span className={pillClass} title={active.pending ? `${active.label}: pendiente de verificación` : active.label}>
        <span className="sr-only">Estás en el espacio: </span>
        {pill}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cx(pillClass, "transition hover:brightness-95")}
      >
        <span className="sr-only">Espacio actual: </span>
        {pill}
        <ChevronDown aria-hidden className={cx("size-3.5 shrink-0 transition", open && "rotate-180")} />
        <span className="sr-only">. Cambiar de espacio</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-1.5 shadow-lift"
        >
          <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">Cambiar a</p>
          {spaces.map((s) => {
            const current = s.id === active.id;
            return (
              <Link
                key={s.id}
                role="menuitem"
                href={s.home}
                className={cx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-surface-2",
                  current && "bg-surface-2",
                )}
              >
                <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg", TONES[s.id].pill)}>
                  <SpaceIcon space={s} className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.label}</span>
                  {s.detail && <span className="block truncate text-xs text-muted">{s.detail}</span>}
                </span>
                {current && <Check aria-hidden className="size-4 text-muted" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Navegación de escritorio (en el encabezado). */
export function DesktopNav() {
  const { active } = useContext(SpacesContext);
  const pathname = usePathname();
  if (!active) return null;
  return (
    <div className="hidden items-center gap-1 sm:flex">
      {active.nav.map((item) => {
        const on = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "rounded-lg px-3 py-2 text-sm whitespace-nowrap transition",
              on ? cx("font-medium", TONES[active.id].nav) : "text-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Barra inferior para celular (oculta desde 640 px). Va al final del documento:
 * el espaciador reserva su altura para que nada quede tapado al hacer scroll.
 */
export function BottomNav() {
  const { active } = useContext(SpacesContext);
  const pathname = usePathname();
  if (!active || active.nav.length < 2) return null;
  const tone = TONES[active.id];
  return (
    <>
      <div aria-hidden className="h-[calc(5rem+env(safe-area-inset-bottom))] shrink-0 sm:hidden print:hidden" />
      <nav
        id="bottom-nav"
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] backdrop-blur-lg sm:hidden print:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {active.nav.map((item) => {
            const on = isActive(pathname, item);
            const Icon = ICONS[item.icon];
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "flex h-16 flex-col items-center justify-center gap-1 px-0.5 text-[11px] leading-none",
                    on ? "font-semibold text-foreground" : "text-muted",
                  )}
                >
                  <span className={cx("grid h-7 w-12 max-w-full place-items-center rounded-full transition", on && tone.nav)}>
                    <Icon aria-hidden className="size-5" strokeWidth={on ? 2.2 : 1.8} />
                  </span>
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
