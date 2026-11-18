import { PetForm } from "@/components/pet-form";
import { Card, FlashMessages, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { createPet } from "../actions";

export const metadata = { title: "Registrar mascota" };

export default async function NuevaMascotaPage({ searchParams }: PageProps<"/mascotas/nueva">) {
  await requireSession("/mascotas/nueva");
  const params = await searchParams;
  return (
    <>
      <PageTitle title="Registrar mascota" subtitle="Podrás agregar foto, vacunas y anexos después." />
      <FlashMessages error={params.error} />
      <Card>
        <PetForm action={createPet} submitLabel="Guardar mascota" />
      </Card>
    </>
  );
}
