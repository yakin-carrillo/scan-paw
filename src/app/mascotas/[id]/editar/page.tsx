import { notFound } from "next/navigation";
import { PetForm } from "@/components/pet-form";
import { BackLink, Card, FlashMessages, PageTitle } from "@/components/ui";
import { loadPetRecord } from "@/lib/pets";
import { updatePet } from "../../actions";

export const metadata = { title: "Editar mascota" };

export default async function EditarMascotaPage({
  params,
  searchParams,
}: PageProps<"/mascotas/[id]/editar">) {
  const { id } = await params;
  const query = await searchParams;
  const record = await loadPetRecord(id);
  if (!record.isOwner) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href={`/mascotas/${id}`}>{record.pet.name}</BackLink>
      <PageTitle title={`Editar a ${record.pet.name}`} />
      <FlashMessages error={query.error} />
      <Card>
        <PetForm action={updatePet.bind(null, id)} pet={record.pet} submitLabel="Guardar cambios" />
      </Card>
    </div>
  );
}
