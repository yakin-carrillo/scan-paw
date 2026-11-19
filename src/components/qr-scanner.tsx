"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import { Alert, Button, Field, Input } from "./ui";

type Mode = "abrir" | "activar";

/** Extrae el código de placa de una URL de Scan-Paw (…/p/CODIGO) o de un código suelto. */
export function tokenFrom(text: string): string | null {
  const trimmed = text.trim();
  const fromUrl = trimmed.match(/\/p\/([0-9A-Za-z]{6,16})(?:[/?#]|$)/);
  const raw = fromUrl?.[1] ?? (/^[0-9A-Za-z]{6,16}$/.test(trimmed) ? trimmed : null);
  return raw ? raw.toUpperCase() : null;
}

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Escáner de placas con la cámara. Usa BarcodeDetector si el navegador lo
 * tiene (Chrome en Android) y, si no, decodifica los cuadros con jsQR
 * (Safari en iPhone). Nada sale del teléfono: solo se navega a la placa.
 */
export function QrScanner({ mode = "abrir" }: { mode?: Mode }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "scanning" | "found" | "denied" | "unsupported">("idle");
  const [notScanPaw, setNotScanPaw] = useState(false);
  const [manual, setManual] = useState("");

  const go = useCallback(
    (token: string) => {
      setState("found");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      router.push(mode === "activar" ? `/placas/activar?placa=${token}` : `/p/${token}`);
    },
    [mode, router],
  );

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) return setState("unsupported");
    setState("starting");
    setNotScanPaw(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setState("scanning");

      const Native = (globalThis as unknown as { BarcodeDetector?: new (o: object) => Detector }).BarcodeDetector;
      const detector = Native ? new Native({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

      const tick = async () => {
        if (!streamRef.current || video.readyState < 2) {
          if (streamRef.current) requestAnimationFrame(tick);
          return;
        }
        let text: string | null = null;
        if (detector) {
          const codes = await detector.detect(video).catch(() => []);
          text = codes[0]?.rawValue ?? null;
        } else if (jsQR) {
          const w = Math.min(640, video.videoWidth);
          const h = Math.round((video.videoHeight / video.videoWidth) * w);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          // Las placas grabadas en aluminio anodizado suelen tener el QR claro sobre fondo oscuro.
          text = jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" })?.data ?? null;
        }
        if (text) {
          const token = tokenFrom(text);
          if (token) return go(token);
          setNotScanPaw(true);
        }
        setTimeout(() => requestAnimationFrame(tick), 120);
      };
      requestAnimationFrame(tick);
    } catch {
      stop();
      setState("denied");
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const token = tokenFrom(manual);
    if (token) go(token);
  }

  const scanning = state === "scanning" || state === "starting";

  return (
    <div className="flex flex-col gap-5">
      <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-foreground shadow-lift">
        <video ref={videoRef} playsInline muted className={`size-full object-cover ${scanning ? "" : "hidden"}`} />
        <canvas ref={canvasRef} className="hidden" />
        {scanning ? (
          <>
            {/* marco de enfoque */}
            <div aria-hidden className="pointer-events-none absolute inset-10 rounded-3xl border-4 border-white/85 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
            <p className="absolute inset-x-0 bottom-4 text-center text-sm font-medium text-white">
              {state === "starting" ? "Abriendo cámara…" : "Apunta al QR de la placa"}
            </p>
          </>
        ) : (
          <div className="paw-pattern flex size-full flex-col items-center justify-center gap-4 p-6 text-center text-background">
            {state === "denied" || state === "unsupported" ? (
              <CameraOff aria-hidden className="size-12 opacity-80" />
            ) : (
              <Camera aria-hidden className="size-12 opacity-80" />
            )}
            <p className="text-sm opacity-90">
              {state === "denied"
                ? "No pudimos usar la cámara. Revisa el permiso en los ajustes del navegador o escribe el código."
                : state === "unsupported"
                  ? "Este navegador no permite usar la cámara. Escribe el código de la placa."
                  : state === "found"
                    ? "Placa encontrada. Abriendo…"
                    : "Usa la cámara trasera para leer el código QR del collar."}
            </p>
            {state !== "found" && state !== "unsupported" && (
              <Button variant="accent" size="lg" onClick={start}>
                <Camera aria-hidden /> {state === "denied" ? "Intentar de nuevo" : "Abrir cámara"}
              </Button>
            )}
          </div>
        )}
      </div>

      {notScanPaw && (
        <Alert tone="warning">Ese código QR no es de una placa Scan-Paw. Sigue apuntando a la placa.</Alert>
      )}

      <form onSubmit={submitManual} className="mx-auto flex w-full max-w-sm items-end gap-2">
        <Field label="O escribe el código de la placa">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Ej. 7KQ2M9XA4T"
            className="font-mono uppercase"
            autoCapitalize="characters"
            autoComplete="off"
          />
        </Field>
        <Button type="submit" variant="secondary" aria-label="Abrir placa con el código escrito" disabled={!tokenFrom(manual)}>
          <Keyboard aria-hidden />
        </Button>
      </form>
    </div>
  );
}
