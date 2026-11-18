import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { PawMark } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { BackLink, PetAvatar, speciesLabel } from "@/components/ui";
import { loadPetRecord } from "@/lib/pets";
import { tagSvg } from "@/lib/qr";

export const metadata = { title: "Cartel de búsqueda", robots: { index: false } };

/** Cartel imprimible "Se busca" con foto, datos de contacto y el QR de la placa. */
export default async function CartelPage({ params }: PageProps<"/mascotas/[id]/cartel">) {
  const { id } = await params;
  const r = await loadPetRecord(id);
  if (!r.isOwner) notFound();
  const { pet } = r;
  const tag = r.tags.find((t) => t.status === "activa");
  const qr = tag ? await tagSvg(tag.public_token) : null;
  const phone = r.session.profile.phone;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/mascotas/${pet.id}`}>Expediente de {pet.name}</BackLink>
        <PrintButton label="Imprimir cartel" />
      </div>

      <article className="flex flex-col items-center gap-5 rounded-2xl border border-border bg-surface p-8 text-center shadow-card print:border-0 print:p-0 print:shadow-none">
        <p className="w-full rounded-xl bg-danger py-3 font-display text-4xl font-bold tracking-wide text-white uppercase sm:text-5xl print:text-6xl">
          Se busca
        </p>
        <PetAvatar species={pet.species} name={pet.name} photoUrl={r.photoUrl} size="xl" />
        <div>
          <h1 className="text-5xl font-semibold">{pet.name}</h1>
          <p className="mt-2 text-lg text-muted">
            {speciesLabel(pet.species)}
            {pet.breed ? ` · ${pet.breed}` : ""}
            {pet.sex ? ` · ${pet.sex === "macho" ? "Macho" : "Hembra"}` : ""}
          </p>
          {pet.color && <p className="text-lg">{pet.color}</p>}
        </div>
        {pet.lost_message && <p className="max-w-lg rounded-xl bg-surface-2 p-4 text-lg">{pet.lost_message}</p>}
        {phone && (
          <p className="flex items-center gap-3 font-display text-3xl font-semibold sm:text-4xl">
            <Phone aria-hidden className="size-8 text-brand" /> {phone}
          </p>
        )}
        {qr && (
          <div className="flex items-center gap-4 rounded-2xl border border-border p-4 text-left">
            <div className="size-28 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="max-w-56 text-sm">
              Escanea el código para avisar a su familia y compartir dónde lo viste.
            </p>
          </div>
        )}
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <PawMark className="size-4 text-brand" /> Scan-Paw
        </p>
      </article>
    </div>
  );
}
