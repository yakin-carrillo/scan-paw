// Service worker mínimo de Scan-Paw (v2).
// No guarda en caché páginas ni datos: el expediente clínico siempre se pide
// a la red para no mostrar información vieja ni dejar datos en el teléfono.
// Solo muestra una página amable cuando no hay conexión.

const OFFLINE_HTML = `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión · Scan-Paw</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;
       background:#f6f3ee;color:#17302b;padding:16px;text-align:center}
  @media (prefers-color-scheme:dark){body{background:#0e1513;color:#e8eeeb}}
  button{margin-top:16px;min-height:44px;padding:0 20px;border:0;border-radius:12px;
         background:#0f6f66;color:#fff;font-size:16px}
</style></head>
<body><main>
  <svg width="56" height="56" viewBox="0 0 32 32" fill="#0f6f66" aria-hidden="true"><ellipse cx="7.6" cy="14.2" rx="3" ry="3.7"/><ellipse cx="12.6" cy="8.4" rx="3.1" ry="3.9"/><ellipse cx="19.4" cy="8.4" rx="3.1" ry="3.9"/><ellipse cx="24.4" cy="14.2" rx="3" ry="3.7"/><path d="M16 15.2c-4.6 0-8.4 5.1-8.4 8.6 0 2.6 2 3.6 4.4 3.6 1.6 0 2.7-.7 4-.7s2.4.7 4 .7c2.4 0 4.4-1 4.4-3.6 0-3.5-3.8-8.6-8.4-8.6z"/></svg>
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
