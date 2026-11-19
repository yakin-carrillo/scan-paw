"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Share, X } from "lucide-react";
import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/app/cuenta/push-actions";
import { Alert, Button } from "./ui";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIosBrowserTab() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Detecta en qué punto están los avisos de este dispositivo y los mantiene registrados. */
function usePush() {
  const [state, setState] = useState<State>("loading");
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (!supported) next = isIosBrowserTab() ? "ios-install" : "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const sub = await (await registration()).pushManager.getSubscription();
        // Vuelve a guardarla por si cambió de cuenta o se borró en el servidor.
        if (sub) await savePushSubscription(sub.toJSON(), navigator.userAgent);
        next = sub ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [supported]);

  async function enable() {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) throw new Error("Los avisos aún no están configurados.");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "off");
      return;
    }
    const reg = await registration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
    const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
    if (!res.ok) throw new Error("No pudimos guardar este dispositivo. Intenta de nuevo.");
    setState("on");
  }

  async function disable() {
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  return { state, enable, disable };
}

/** Tarjeta completa para /cuenta: activar, probar y desactivar. */
export function PushSettings() {
  const { state, enable, disable } = usePush();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tested, setTested] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      {state === "loading" && <p className="text-muted">Revisando este dispositivo…</p>}
      {state === "on" && (
        <>
          <Alert tone="success">Los avisos están activos en este dispositivo.</Alert>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() =>
                run(async () => {
                  await sendTestPush();
                  setTested(true);
                })
              }
            >
              <BellRing aria-hidden /> Enviar aviso de prueba
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => run(disable)}>
              <BellOff aria-hidden /> Desactivar
            </Button>
          </div>
          {tested && <p className="text-muted">Enviado. Debería llegar en unos segundos.</p>}
        </>
      )}
      {state === "off" && (
        <>
          <p className="text-muted">
            Actívalos en cada teléfono o computadora donde quieras recibirlos. Son la única forma en que Scan-Paw te avisa.
          </p>
          <Button type="button" className="self-start" disabled={busy} onClick={() => run(enable)}>
            <Bell aria-hidden /> Activar avisos en este dispositivo
          </Button>
        </>
      )}
      {state === "ios-install" && <IosInstallHint />}
      {state === "denied" && (
        <Alert tone="warning">
          Bloqueaste los avisos para Scan-Paw. Actívalos en los ajustes del navegador o del teléfono y vuelve a esta página.
        </Alert>
      )}
      {state === "unsupported" && (
        <Alert tone="warning">Este navegador no admite avisos. Prueba con Chrome, Edge, Firefox o Safari actualizados.</Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

function IosInstallHint() {
  return (
    <Alert tone="info" title="En iPhone, primero instala la app">
      Toca <Share aria-hidden className="inline size-4 align-text-bottom" /> Compartir y luego “Agregar a pantalla de
      inicio”. Abre Scan-Paw desde ese ícono y activa aquí los avisos (iOS 16.4 o posterior).
    </Alert>
  );
}

const DISMISS_KEY = "scanpaw:aviso-push-oculto";

/** Recordatorio discreto para activar los avisos (se oculta si ya están activos o se descarta). */
export function PushBanner({ text }: { text: string }) {
  const { state, enable } = usePush();
  // El estado inicial "loading" no pinta nada, así que leer el almacenamiento aquí no desajusta la hidratación.
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window === "undefined" || window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed || !(state === "off" || state === "ios-install")) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sin almacenamiento: solo se oculta en esta visita.
    }
  }

  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-brand/20 bg-brand-soft p-4 text-sm">
      <Bell aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {state === "ios-install" ? <IosInstallHint /> : <p>{text}</p>}
        {state === "off" && (
          <Button
            type="button"
            className="self-start"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await enable();
              } catch (err) {
                setError(err instanceof Error ? err.message : "No se pudieron activar los avisos.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Activar avisos
          </Button>
        )}
        {error && <p className="text-danger">{error}</p>}
      </div>
      <button type="button" onClick={dismiss} aria-label="Ocultar" className="rounded-lg p-1 text-muted hover:text-foreground">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
