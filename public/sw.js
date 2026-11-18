// Service worker mínimo de Scan-Paw.
// No guarda en caché páginas ni datos: el expediente clínico siempre se pide
// a la red para no mostrar información vieja ni dejar datos en el teléfono.
// Solo muestra una página amable cuando no hay conexión.

const OFFLINE_HTML = `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión · Scan-Paw</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;
       background:#f7f8f6;color:#1c2321;padding:16px;text-align:center}
  @media (prefers-color-scheme:dark){body{background:#111614;color:#e8eeeb}}
  button{margin-top:16px;min-height:44px;padding:0 20px;border:0;border-radius:8px;
         background:#0f766e;color:#fff;font-size:16px}
</style></head>
<body><main>
  <div style="font-size:48px">🐾</div>
  <h1 style="font-size:20px">Sin conexión</h1>
  <p>Scan-Paw necesita internet para mostrar el expediente.</p>
  <button onclick="location.reload()">Reintentar</button>
</main></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // el navegador maneja lo demás
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});
