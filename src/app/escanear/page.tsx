import { QrScanner } from "@/components/qr-scanner";
import { PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/auth";

export const metadata = { title: "Escanear placa" };

export default async function EscanearPage({ searchParams }: PageProps<"/escanear">) {
  const session = await requireSession("/escanear");
  const query = await searchParams;
  const mode = query.modo === "activar" ? "activar" : "abrir";
  const clinician = session.isClinician;

  return (
    <div className="mx-auto max-w-lg">
      <PageTitle
        eyebrow={mode === "activar" ? "Activar placa" : clinician ? "Consulta" : "Placa encontrada"}
        title="Escanear placa"
        subtitle={
          mode === "activar"
            ? "Escanea la placa nueva para ligarla con tu mascota."
            : clinician
              ? "Escanea el collar del paciente para abrir su expediente por 7 días."
              : "Escanea una placa Scan-Paw para ver cómo contactar a su familia."
        }
      />
      <QrScanner mode={mode} />
    </div>
  );
}
