// Service worker mínimo de Scan-Paw (v6).
// No guarda en caché páginas ni datos: el expediente clínico siempre se pide
// a la red para no mostrar información vieja ni dejar datos en el teléfono.
// Muestra una página amable cuando no hay conexión y los avisos push.

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
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="64" height="64" aria-hidden="true"><rect width="512" height="512" rx="116" fill="#262A6B"/><g fill="none" stroke="#FF6F59" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"><path d="M66 165V66H165"/><path d="M347 66H446V165"/><path d="M446 347V446H347"/><path d="M165 446H66V347"/></g><g fill="#F6F1EA"><ellipse cx="171" cy="246" rx="28" ry="40" transform="rotate(-32 171 246)"/><ellipse cx="219" cy="182" rx="30" ry="42" transform="rotate(-12 219 182)"/><ellipse cx="293" cy="182" rx="30" ry="42" transform="rotate(12 293 182)"/><ellipse cx="341" cy="246" rx="28" ry="40" transform="rotate(32 341 246)"/><path d="M256 255C283 255 303 270 317 289C326 302 333 316 338 328C344 344 339 361 322 361C305 361 285 346 256 346C227 346 207 361 190 361C173 361 168 344 174 328C179 316 186 302 195 289C209 270 229 255 256 255Z"/></g></svg>
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

// Avisos push: el servidor envía { title, body, url, tag } (src/lib/push.ts).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Scan-Paw", {
      body: data.body || "",
      icon: "/iconos/192",
      badge: "/iconos/insignia",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/" },
    }),
  );
});

// Al tocar el aviso: enfoca una ventana abierta de la app o abre la página indicada.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const sameOrigin = target.startsWith(self.location.origin);
      const open = sameOrigin && windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        await open.focus();
        return open.navigate(target);
      }
      return self.clients.openWindow(target);
    })(),
  );
});
