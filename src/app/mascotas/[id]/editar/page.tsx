import Link from "next/link";
import { notFound } from "next/navigation";
import { PetForm } from "@/components/pet-form";
import { Card, FlashMessages, PageTitle } from "@/components/ui";
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
    <>
      <Link href={`/mascotas/${id}`} className="mb-3 inline-block text-sm text-muted">
        ← {record.pet.name}
      </Link>
      <PageTitle title={`Editar a ${record.pet.name}`} />
      <FlashMessages error={query.error} />
      <Card>
        <PetForm action={updatePet.bind(null, id)} pet={record.pet} submitLabel="Guardar cambios" />
      </Card>
    </>
  );
}
