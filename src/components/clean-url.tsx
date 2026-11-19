"use client";

import { useEffect } from "react";

const FLASH_KEYS = ["ok", "error", "codigo"];

/**
 * Quita de la barra de direcciones los mensajes que dejan las Server Actions
 * (?ok=, ?error=, ?codigo=) para que no reaparezcan al recargar ni queden en
 * el historial. Conserva los demás parámetros, como ?tab=.
 */
export function CleanFlashParams() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!FLASH_KEYS.some((k) => url.searchParams.has(k))) return;
    FLASH_KEYS.forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
