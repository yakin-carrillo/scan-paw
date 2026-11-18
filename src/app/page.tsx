import { redirect } from "next/navigation";
import { ButtonLink, Card } from "@/components/ui";
import { getSession } from "@/lib/auth";

const steps = [
  {
    title: "Registra a tu mascota",
    text: "Identificación, vacunas, alergias, padecimientos crónicos, estudios y recetas en un solo lugar.",
  },
  {
    title: "Activa su placa QR",
    text: "La placa va en el collar. Si alguien la encuentra, ve tu nombre y teléfono; nada más.",
  },
  {
    title: "Cualquier MVZ verificado la escanea",
    text: "Accede al historial completo por 7 días y tú recibes un aviso cada vez.",
  },
];

export default async function Home() {
  // Con sesión (p. ej. al abrir la app desde la pantalla de inicio) va directo a su panel.
  const session = await getSession();
  if (session && !session.onboarded) redirect("/bienvenida");
  if (session?.profile.role === "vet") redirect("/vet");
  if (session) redirect("/mascotas");

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 pt-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Un historial clínico que acompaña a tu mascota a cualquier clínica.
        </h1>
        <p className="max-w-2xl text-muted">
          Scan-Paw une la información médica de perros y gatos en una placa con código QR. Tú eres
          dueño de los datos; los médicos veterinarios con cédula verificada pueden consultarlos y
          agregar información.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/entrar">Crear cuenta gratis</ButtonLink>
          <ButtonLink href="/entrar?next=%2Fbienvenida%3Ftipo%3Dvet" variant="secondary">
            Soy médico veterinario
          </ButtonLink>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Card key={s.title}>
            <p className="text-sm font-medium text-brand">Paso {i + 1}</p>
            <h2 className="mt-1 font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-muted">{s.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
