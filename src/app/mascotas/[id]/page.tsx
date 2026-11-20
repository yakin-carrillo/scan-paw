import { loadPetRecord } from "@/lib/pets";
import { ClinicalRecord, clinicalTab } from "./clinical-view";
import { OwnerRecord, ownerTab } from "./owner-view";

export async function generateMetadata() {
  return { title: "Expediente" };
}

/**
 * Un mismo expediente, dos pantallas: la cartilla para la familia y la ficha
 * clínica para el MVZ con acceso vigente. RLS decide qué datos llegan; esta
 * página solo decide cómo se presentan.
 */
export default async function PetPage({ params, searchParams }: PageProps<"/mascotas/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const record = await loadPetRecord(id);

  const ownerCanPreview = record.isOwner && record.session.isVerifiedClinician;
  const clinical = !record.isOwner || (ownerCanPreview && query.vista === "ficha");

  if (clinical) {
    return (
      <ClinicalRecord
        record={record}
        tab={clinicalTab(query.tab)}
        query={query}
        ownerPreview={record.isOwner}
      />
    );
  }

  const shareCode = typeof query.codigo === "string" && /^[0-9A-Z]{6}$/.test(query.codigo) ? query.codigo : null;
  return (
    <OwnerRecord
      record={record}
      tab={ownerTab(query.tab)}
      query={query}
      shareCode={shareCode}
      canSwitch={ownerCanPreview}
    />
  );
}
