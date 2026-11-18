"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
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

  if (state === "done") return <Alert tone="success">Gracias. Enviamos tu ubicación a su familia.</Alert>;
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" size="lg" className="w-full" onClick={share} disabled={state === "loading"}>
        <MapPin aria-hidden />
        {state === "loading" ? "Obteniendo ubicación…" : "Enviar mi ubicación a su familia"}
      </Button>
      {state === "error" && <Alert tone="error">No se pudo obtener la ubicación.</Alert>}
      <p className="text-xs text-muted">Solo se envía si tocas el botón, y únicamente la ve su familia.</p>
    </div>
  );
}
