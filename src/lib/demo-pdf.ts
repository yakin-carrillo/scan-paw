import "server-only";

/**
 * PDF mínimo (una página, Helvetica) generado a mano para el estudio de
 * ejemplo de los datos de demostración. Evita depender de una librería.
 */
export function demoLabPdf(petName: string): Uint8Array {
  const lines = [
    ["Laboratorio Clinico Veterinario (ejemplo)", 16],
    [`Paciente: ${petName}   Especie: Canino`, 11],
    ["Estudio: Hemograma y quimica sanguinea", 11],
    ["", 11],
    ["Hematocrito ........ 46 %        (37 - 55)", 11],
    ["Hemoglobina ........ 15.8 g/dL   (12 - 18)", 11],
    ["Leucocitos ......... 11.2 x10^3  (6 - 17)", 11],
    ["Eosinofilos ........ 1.4 x10^3   (0.1 - 1.2)  ALTO", 11],
    ["Plaquetas .......... 310 x10^3   (200 - 500)", 11],
    ["Glucosa ............ 92 mg/dL    (70 - 120)", 11],
    ["Creatinina ......... 1.1 mg/dL   (0.5 - 1.6)", 11],
    ["ALT ................ 48 U/L      (10 - 100)", 11],
    ["", 11],
    ["Documento de ejemplo generado por Scan-Paw para demostracion.", 9],
  ] as const;
  let y = 760;
  const ops = lines
    .map(([text, size]) => {
      const safe = text.replace(/[\\()]/g, "\\$&");
      const op = `BT /F1 ${size} Tf 56 ${y} Td (${safe}) Tj ET`;
      y -= size + 10;
      return op;
    })
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
