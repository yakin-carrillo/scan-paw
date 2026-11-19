"use client";

/** Último recurso si falla el layout raíz: documento propio y estilos en línea. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es-MX">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 16,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f6f1ea",
          color: "#161833",
        }}
      >
        <title>Error · Scan-Paw</title>
        <main>
          <h1 style={{ fontSize: 22 }}>Scan-Paw no está disponible por el momento</h1>
          <p>Intenta de nuevo en unos minutos.</p>
          <button
            onClick={() => retry()}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: "0 20px",
              border: 0,
              borderRadius: 12,
              background: "#262a6b",
              color: "#f6f1ea",
              fontSize: 16,
            }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
