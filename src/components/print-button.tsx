"use client";

import { Printer } from "lucide-react";
import { Button } from "./ui";

/** Abre el diálogo de impresión (en el celular permite "Guardar como PDF"). */
export function PrintButton({ label = "Imprimir o guardar PDF" }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer aria-hidden /> {label}
    </Button>
  );
}
