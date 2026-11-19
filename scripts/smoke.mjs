// Prueba de humo de las rutas públicas de un despliegue (no inicia sesión).
//   npm run test:smoke                       → https://scan-paw.vercel.app
//   npm run test:smoke -- http://localhost:3000
const base = (process.argv[2] ?? "https://scan-paw.vercel.app").replace(/\/$/, "");

const checks = [
  ["/", 200, "siempre con ellos"],
  ["/entrar", 200, "Continuar con Google"],
  ["/privacidad", 200, "Aviso de privacidad"],
  ["/p/NOEXISTE00", 200, "Placa no encontrada"],
  ["/manifest.webmanifest", 200, '"display":"standalone"'],
  ["/sw.js", 200, "Service worker"],
  ["/icon", 200, null],
  ["/apple-icon", 200, null],
  ["/mascotas", 307, null],
  ["/vet/agenda", 307, null],
  ["/escanear", 307, null],
  ["/api/cron/diario", 401, null],
];

let failed = 0;
for (const [path, status, text] of checks) {
  try {
    const res = await fetch(base + path, { redirect: "manual" });
    const body = text ? await res.text() : "";
    const ok = res.status === status && (!text || body.includes(text));
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FALLA"} ${res.status} ${path}${ok ? "" : ` (se esperaba ${status}${text ? ` con "${text}"` : ""})`}`);
  } catch (err) {
    failed++;
    console.log(`FALLA ${path}: ${err.message}`);
  }
}
console.log(`\n${checks.length - failed}/${checks.length} correctas en ${base}`);
process.exit(failed ? 1 : 0);
