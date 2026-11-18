"use client";

import { useEffect } from "react";

/** Registra el service worker (necesario para instalar la app en Android). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Si falla, la app sigue funcionando como sitio web normal.
    });
  }, []);
  return null;
}
