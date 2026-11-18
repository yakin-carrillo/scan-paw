import Link from "next/link";
import { Badge, ButtonLink, Card, FlashMessages, PageTitle } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { petAge } from "@/lib/pets";
import { createClient } from "@/lib/supabase/server";
import type { Pet } from "@/lib/types";

export const metadata = { title: "Mis mascotas" };

export default async function MascotasPage({ searchParams }: PageProps<"/mascotas">) {
  const session = await requireSession("/mascotas");
  const params = await searchParams;
  const supabase = await createClient();

  const { data: ownRows } = await supabase
    .from("pet_owners")
    .select("pets(*)")
    .eq("user_id", session.userId);
  const pets = ((ownRows ?? []) as unknown as { pets: Pet | null }[])
    .map((r) => r.pets)
    .filter((p): p is Pet => Boolean(p))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <>
      <PageTitle
        title="Mis mascotas"
        actions={<ButtonLink href="/mascotas/nueva">Registrar mascota</ButtonLink>}
      />
      <FlashMessages error={params.error} ok={params.ok} />
      {session.profile.role === "vet" && (
        <p className="mb-4 text-sm text-muted">
          Aquí ves tus propias mascotas. Los pacientes están en el{" "}
          <Link href="/vet" className="underline">
            panel MVZ
          </Link>
          .
        </p>
      )}
      {pets.length === 0 ? (
        <Card className="text-center">
          <p className="text-muted">Aún no registras ninguna mascota.</p>
          <ButtonLink href="/mascotas/nueva" className="mt-4">
            Registrar la primera
          </ButtonLink>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {pets.map((pet) => (
            <li key={pet.id}>
              <Link href={`/mascotas/${pet.id}`} className="block">
                <Card className="transition hover:border-brand">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">{pet.name}</h2>
                    {pet.status === "fallecido" ? (
                      <Badge>Fallecido</Badge>
                    ) : pet.lost_mode ? (
                      <Badge tone="danger">Extraviado</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {pet.species === "perro" ? "Perro" : "Gato"}
                    {pet.breed ? ` · ${pet.breed}` : ""}
                    {petAge(pet.birth_date) ? ` · ${petAge(pet.birth_date)}` : ""}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
