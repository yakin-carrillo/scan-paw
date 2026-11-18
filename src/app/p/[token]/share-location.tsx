"use client";

import { useState } from "react";
import { Alert, Button } from "@/components/ui";
import { shareFinderLocation } from "./actions";

export function ShareLocationButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  function share() {
    if (!navigator.geolocation) return setState("error");
    setState("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await shareFinderLocation(token, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setState(res.ok ? "done" : "error");
      },
      () => setState("error"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (state === "done") return <Alert tone="success">¡Gracias! Enviamos tu ubicación al dueño.</Alert>;
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={share} disabled={state === "loading"}>
        {state === "loading" ? "Obteniendo ubicación…" : "📍 Enviar mi ubicación al dueño"}
      </Button>
      {state === "error" && <Alert tone="error">No se pudo obtener la ubicación.</Alert>}
      <p className="text-xs text-muted">Solo se envía si tocas el botón, y únicamente la ve el dueño.</p>
    </div>
  );
}
