import Link from "next/link";
import { ChevronRight, Clock, ScanLine, Stethoscope } from "lucide-react";
import { Badge, ButtonLink, Card, EmptyState, formatDate, PageTitle, PetAvatar, speciesLabel } from "@/components/ui";
import { requireVerifiedClinician } from "@/lib/auth";
import { activePatients, isoDaysFromNow } from "@/lib/clinic";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pacientes" };

export default async function PacientesPage() {
  const session = await requireVerifiedClinician();
  const supabase = await createClient();
  const patients = await activePatients(session);
  const paths = patients.map((p) => p.pets?.photo_path).filter((p): p is string => Boolean(p));
  const photos = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("pet-photos").createSignedUrls(paths, 3600);
    (data ?? []).forEach((d) => d.signedUrl && photos.set(d.path ?? "", d.signedUrl));
  }
  const soon = isoDaysFromNow(2);

  return (
    <>
      <PageTitle
        eyebrow="Espacio clínico"
        title="Pacientes"
        subtitle="Expedientes a los que tienes acceso vigente. El acceso dura 7 días desde el escaneo o el código."
        actions={
          <ButtonLink href="/escanear">
            <ScanLine aria-hidden /> Escanear placa
          </ButtonLink>
        }
      />
      {patients.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="Sin pacientes por ahora"
          text="Escanea la placa de un paciente o usa el código del propietario para abrir su expediente."
          action={<ButtonLink href="/vet">Usar un código</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {patients.map((p) => {
            const ending = p.expires_at < soon;
            return (
              <li key={p.pet_id}>
                <Link href={`/mascotas/${p.pet_id}`} className="group block">
                  <Card className="flex items-center gap-4 p-4 transition group-hover:shadow-lift sm:p-4">
                    <PetAvatar
                      species={p.pets?.species ?? null}
                      name={p.pets?.name ?? ""}
                      photoUrl={p.pets?.photo_path ? photos.get(p.pets.photo_path) : null}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-semibold">{p.pets?.name}</h2>
                      <p className="truncate text-sm text-muted">
                        {speciesLabel(p.pets?.species)}
                        {p.pets?.breed ? ` · ${p.pets.breed}` : ""}
                      </p>
                      <p className="mt-1">
                        <Badge tone={ending ? "warning" : "neutral"}>
                          <Clock aria-hidden /> Acceso hasta {formatDate(p.expires_at)}
                        </Badge>
                      </p>
                    </div>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
