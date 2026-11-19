// Service worker mínimo de Scan-Paw (v3).
// No guarda en caché páginas ni datos: el expediente clínico siempre se pide
// a la red para no mostrar información vieja ni dejar datos en el teléfono.
// Solo muestra una página amable cuando no hay conexión.

const OFFLINE_HTML = `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión · Scan-Paw</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;
       background:#f6f1ea;color:#161833;padding:16px;text-align:center}
  @media (prefers-color-scheme:dark){body{background:#11132b;color:#f1ece4}}
  button{margin-top:16px;min-height:44px;padding:0 20px;border:0;border-radius:12px;
         background:#262a6b;color:#f6f1ea;font-size:16px}
</style></head>
<body><main>
  <svg width="64" height="64" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="116" fill="#262a6b"/><g fill="none" stroke="#ff6f59" stroke-width="22" stroke-linecap="round"><path d="M96 168V128a32 32 0 0 1 32-32h40"/><path d="M344 96h40a32 32 0 0 1 32 32v40"/><path d="M416 344v40a32 32 0 0 1-32 32h-40"/><path d="M168 416h-40a32 32 0 0 1-32-32v-40"/></g><g fill="#f6f1ea"><rect x="124" y="194" width="60" height="68" rx="23" transform="rotate(-24 154 228)"/><rect x="188" y="134" width="60" height="70" rx="23" transform="rotate(-8 218 169)"/><rect x="264" y="134" width="60" height="70" rx="23" transform="rotate(8 294 169)"/><rect x="328" y="194" width="60" height="68" rx="23" transform="rotate(24 358 228)"/><path d="M256 398c-17-11-90-53-90-106 0-30 22-51 49-51 18 0 32 9 41 23 9-14 23-23 41-23 27 0 49 21 49 51 0 53-73 95-90 106z"/></g></svg>
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
