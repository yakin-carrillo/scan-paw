import Link from "next/link";
import { CalendarDays, ChevronRight, PawPrint, Plus, QrCode, Siren, Syringe } from "lucide-react";
import { PushBanner } from "@/components/push-toggle";
import { Badge, ButtonLink, Card, EmptyState, FlashMessages, formatDate, PageTitle, PetAvatar, speciesLabel } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { petAge, vaccineStatus } from "@/lib/pets";
import { createClient } from "@/lib/supabase/server";
import { latestVersions, membershipActive, type Membership, type Pet, type Vaccination } from "@/lib/types";

export const metadata = { title: "Mis mascotas" };

export default async function MascotasPage({ searchParams }: PageProps<"/mascotas">) {
  const session = await requireSession("/mascotas");
  const params = await searchParams;
  const supabase = await createClient();

  const { data: ownRows } = await supabase.from("pet_owners").select("pets(*)").eq("user_id", session.userId);
  const pets = ((ownRows ?? []) as unknown as { pets: Pet | null }[])
    .map((r) => r.pets)
    .filter((p): p is Pet => Boolean(p))
    .sort((a, b) => Number(a.status === "fallecido") - Number(b.status === "fallecido") || a.name.localeCompare(b.name, "es"));

  const ids = pets.map((p) => p.id);
  const [{ data: memberships }, { data: tags }, photos, { data: vax }, { data: appts }] = await Promise.all([
    ids.length ? supabase.from("memberships").select("*").in("pet_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase.from("tags").select("pet_id").eq("status", "activa").in("pet_id", ids)
      : Promise.resolve({ data: [] }),
    (async () => {
      const paths = pets.map((p) => p.photo_path).filter((p): p is string => Boolean(p));
      if (!paths.length) return new Map<string, string>();
      const { data } = await supabase.storage.from("pet-photos").createSignedUrls(paths, 3600);
      return new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path ?? "", d.signedUrl]));
    })(),
    ids.length ? supabase.from("vaccinations").select("*").in("pet_id", ids) : Promise.resolve({ data: [] }),
    ids.length
      ? supabase
          .from("appointments")
          .select("pet_id, scheduled_at")
          .eq("status", "programada")
          .gte("scheduled_at", new Date().toISOString())
          .in("pet_id", ids)
          .order("scheduled_at")
      : Promise.resolve({ data: [] }),
  ]);
  const memberOf = new Map(((memberships ?? []) as Membership[]).map((m) => [m.pet_id, m]));
  const tagged = new Set(((tags ?? []) as { pet_id: string }[]).map((t) => t.pet_id));
  const firstName = session.profile.full_name.split(" ")[0];
  // Pendientes por mascota: vacunas vencidas o por vencer y la próxima cita.
  const due = new Map<string, "soon" | "overdue">();
  latestVersions((vax ?? []) as Vaccination[]).forEach((v) => {
    const s = vaccineStatus(v.next_due);
    if (s === "ok") return;
    if (s === "overdue" || !due.has(v.pet_id)) due.set(v.pet_id, s);
  });
  const nextAppt = new Map<string, string>();
  ((appts ?? []) as { pet_id: string; scheduled_at: string }[]).forEach(
    (a) => nextAppt.has(a.pet_id) || nextAppt.set(a.pet_id, a.scheduled_at),
  );

  return (
    <>
      <PageTitle
        eyebrow={`Hola, ${firstName}`}
        title="Mis mascotas"
        actions={
          pets.length > 0 && (
            <ButtonLink href="/mascotas/nueva">
              <Plus aria-hidden /> Registrar mascota
            </ButtonLink>
          )
        }
      />
      <FlashMessages error={params.error} ok={params.ok} />
      {pets.length > 0 && (
        <PushBanner text="Activa los avisos para saber al instante si alguien escanea la placa de tu mascota o abre su expediente." />
      )}
      {pets.length === 0 ? (
        <EmptyState
          icon={PawPrint}
          title="Aún no registras ninguna mascota"
          text="Crea su expediente en un minuto. Después podrás activar su placa QR y compartirlo con su MVZ."
          action={
            <ButtonLink href="/mascotas/nueva" size="lg">
              <Plus aria-hidden /> Registrar la primera
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {pets.map((pet) => {
            const age = petAge(pet.birth_date);
            const member = membershipActive(memberOf.get(pet.id));
            return (
              <li key={pet.id}>
                <Link href={`/mascotas/${pet.id}`} className="group block">
                  <Card className="flex items-center gap-4 transition group-hover:-translate-y-0.5 group-hover:shadow-lift">
                    <PetAvatar
                      species={pet.species}
                      name={pet.name}
                      photoUrl={pet.photo_path ? photos.get(pet.photo_path) : null}
                      size="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-xl font-semibold">{pet.name}</h2>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {speciesLabel(pet.species)}
                        {pet.breed ? ` · ${pet.breed}` : ""}
                        {age ? ` · ${age}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {pet.status === "fallecido" ? (
                          <Badge>En memoria</Badge>
                        ) : (
                          <>
                            {pet.lost_mode && (
                              <Badge tone="danger">
                                <Siren aria-hidden /> Extraviado
                              </Badge>
                            )}
                            {tagged.has(pet.id) ? (
                              <Badge tone="brand">
                                <QrCode aria-hidden /> Placa activa
                              </Badge>
                            ) : (
                              <Badge tone="accent">Sin placa</Badge>
                            )}
                            {member && <Badge tone="brand">Membresía</Badge>}
                            {due.get(pet.id) === "overdue" && (
                              <Badge tone="danger">
                                <Syringe aria-hidden /> Vacuna vencida
                              </Badge>
                            )}
                            {due.get(pet.id) === "soon" && (
                              <Badge tone="warning">
                                <Syringe aria-hidden /> Vacuna por vencer
                              </Badge>
                            )}
                            {nextAppt.has(pet.id) && (
                              <Badge tone="verified">
                                <CalendarDays aria-hidden /> Cita {formatDate(nextAppt.get(pet.id))}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5" />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {(session.profile.role === "vet" || session.profile.role === "student") && (
        <p className="mt-6 text-sm text-muted">
          Aquí ves tus propias mascotas. Tus pacientes están en el{" "}
          <Link href="/vet/pacientes" className="underline">
            espacio clínico
          </Link>
          .
        </p>
      )}
    </>
  );
}
