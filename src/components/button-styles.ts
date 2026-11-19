// Estilos compartidos entre Button (cliente) y ButtonLink (servidor).

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const buttonStyles = {
  primary: "bg-brand text-brand-ink shadow-sm hover:bg-brand-strong",
  secondary: "border border-border bg-surface text-foreground hover:border-brand/40 hover:bg-brand-soft",
  accent: "bg-coral text-coral-ink shadow-sm hover:brightness-95",
  danger: "bg-danger text-danger-ink shadow-sm hover:brightness-95",
  ghost: "text-foreground hover:bg-brand-soft",
};

export type Variant = keyof typeof buttonStyles;
export const sizes = { md: "min-h-11 px-4 text-sm", lg: "min-h-13 px-5 text-base" };

export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.15em] [&_svg]:shrink-0";
