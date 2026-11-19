"use client";

import type { ComponentProps, MouseEvent } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { buttonBase, buttonStyles, cx, sizes, type Variant } from "./button-styles";

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: keyof typeof sizes;
  /** Si se indica, pide confirmación antes de enviar el formulario. */
  confirm?: string;
};

/**
 * Botón de la app. Dentro de un formulario con Server Action se desactiva y
 * muestra un indicador mientras se envía, para evitar envíos dobles.
 */
export function Button({ variant = "primary", size = "md", className, confirm, onClick, children, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  const busy = (props.type ?? "submit") === "submit" && pending;

  function handleClick(e: MouseEvent<HTMLButtonElement>) {
    if (confirm && !window.confirm(confirm)) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  }

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      className={cx(buttonBase, sizes[size], buttonStyles[variant], className)}
    >
      {busy && <LoaderCircle aria-hidden className="animate-spin" />}
      {children}
    </button>
  );
}
