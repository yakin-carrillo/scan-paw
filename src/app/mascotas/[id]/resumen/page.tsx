import { PawMark } from "@/components/logo";
import { PrintButton } from "@/components/print-button";
import { BackLink, formatDate, formatDateTime, PetAvatar, speciesLabel } from "@/components/ui";
import { loadPetRecord, petAge, vaccineStatus } from "@/lib/pets";

export const metadata = { title: "Resumen clínico", robots: { index: false } };

const sourceLabel = { vet: "MVZ", estudiante: "Estudiante (No profesionista)", propietario: "Propietario" };

/**
 * Hoja de resumen para preparar la consulta o entregar en otra clínica.
 * Pensada para imprimirse en una sola hoja carta.
 */
export default async function ResumenPage({ params }: PageProps<"/mascotas/[id]/resumen">) {
  const { id } = await params;
  const r = await loadPetRecord(id);
  const { pet } = r;
  const allergies = r.conditions.filter((c) => c.kind === "alergia" && c.active);
  const chronic = r.conditions.filter((c) => c.kind === "cronica" && c.active);
  const owner = r.owners.find((o) => o.role === "principal") ?? r.owners[0];
  const upcoming = r.appointments.filter((a) => a.status === "programada" && new Date(a.scheduled_at) > new Date());

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/mascotas/${pet.id}`}>Expediente de {pet.name}</BackLink>
        <PrintButton />
      </div>

      <article className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b-2 border-foreground pb-4">
          <div className="flex items-center gap-4">
            <PetAvatar species={pet.species} name={pet.name} photoUrl={r.photoUrl} size="lg" />
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">Resumen clínico</p>
              <h1 className="text-3xl font-semibold">{pet.name}</h1>
              <p className="text-sm text-muted">
                {speciesLabel(pet.species)}
                {pet.breed ? ` · ${pet.breed}` : ""}
                {pet.sex ? ` · ${pet.sex === "macho" ? "Macho" : "Hembra"}` : ""}
                {petAge(pet.birth_date) ? ` · ${petAge(pet.birth_date)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-brand">
            <PawMark className="size-5" /> Scan-Paw
          </div>
        </header>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
          {[
            ["Nacimiento", pet.birth_date ? formatDate(pet.birth_date) : "—"],
            ["Esterilizado", pet.sterilized == null ? "—" : pet.sterilized ? "Sí" : "No"],
            ["Microchip", pet.microchip ?? "—"],
            ["Color / señas", pet.color ?? "—"],
            [
              "Último peso",
              r.weights.length
                ? `${r.weights[r.weights.length - 1].weight_kg.toLocaleString("es-MX", { maximumFractionDigits: 2 })} kg (${formatDate(r.weights[r.weights.length - 1].measured_on)})`
                : "—",
            ],
            ["Propietario", owner?.profiles?.full_name ?? "—"],
            ["Teléfono", owner?.profiles?.phone ?? "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-6 rounded-xl border-2 border-danger p-4">
          <h2 className="text-sm font-bold tracking-wider text-danger uppercase">Alergias</h2>
          {allergies.length === 0 ? (
            <p className="mt-1 text-sm">Sin alergias registradas.</p>
          ) : (
            <ul className="mt-1 text-sm">
              {allergies.map((a) => (
                <li key={a.id}>
                  <strong>{a.description}</strong>
                  {a.severity ? ` · ${a.severity}` : ""}
                  {a.notes ? ` · ${a.notes}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5">
          <h2 className="border-b border-border pb-1 text-lg font-semibold">Padecimientos crónicos</h2>
          {chronic.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Ninguno registrado.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {chronic.map((c) => (
                <li key={c.id}>
                  <strong>{c.description}</strong>
                  {c.severity ? ` (${c.severity})` : ""}
                  {c.notes ? ` · ${c.notes}` : ""}
                  <span className="text-muted"> · {sourceLabel[c.source]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5">
          <h2 className="border-b border-border pb-1 text-lg font-semibold">Vacunas</h2>
          {r.vaccinations.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Sin vacunas registradas.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-1 font-medium">Vacuna</th>
                  <th className="py-1 font-medium">Aplicada</th>
                  <th className="py-1 font-medium">Próxima</th>
                  <th className="py-1 font-medium">Registró</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {r.vaccinations.map((v) => {
                  const st = vaccineStatus(v.next_due);
                  return (
                    <tr key={v.id}>
                      <td className="py-1.5 font-medium">{v.vaccine}</td>
                      <td className="py-1.5">{formatDate(v.applied_on)}</td>
                      <td className={`py-1.5 ${st === "overdue" ? "font-semibold text-danger" : ""}`}>
                        {v.next_due ? formatDate(v.next_due) : "—"}
                        {st === "overdue" && v.next_due ? " (vencida)" : ""}
                      </td>
                      <td className="py-1.5 text-muted">{sourceLabel[v.source]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </section>

        {r.consultations.length > 0 && (
          <section className="mt-5">
            <h2 className="border-b border-border pb-1 text-lg font-semibold">Consultas recientes</h2>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {r.consultations.slice(0, 3).map((c) => (
                <li key={c.id}>
                  <p>
                    {formatDate(c.visit_date)} · <strong>{c.reason}</strong>
                    {c.diagnosis ? ` · ${c.diagnosis}` : ""}
                  </p>
                  {c.treatment && <p className="text-muted">Tratamiento: {c.treatment}</p>}
                  <p className="text-xs text-muted">
                    {sourceLabel[c.source]}: {c.author_name}
                    {c.author_cedula ? ` · Cédula ${c.author_cedula}` : ""}
                    {c.clinic_name ? ` · ${c.clinic_name}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {r.attachments.length > 0 && (
          <section className="mt-5">
            <h2 className="border-b border-border pb-1 text-lg font-semibold">Estudios y recetas</h2>
            <ul className="mt-2 text-sm">
              {r.attachments.map((a) => (
                <li key={a.id}>
                  {formatDate(a.created_at)} · <strong>{a.title}</strong>
                  {a.notes ? ` · ${a.notes}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        {upcoming.length > 0 && (
          <section className="mt-5">
            <h2 className="border-b border-border pb-1 text-lg font-semibold">Próximas citas</h2>
            <ul className="mt-2 text-sm">
              {upcoming.map((a) => (
                <li key={a.id}>
                  {formatDateTime(a.scheduled_at)} · {a.reason} · {a.clinician_name}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-8 border-t border-border pt-3 text-xs text-muted">
          Generado el {formatDateTime(new Date().toISOString())} por {r.session.profile.full_name}. Las entradas del
          propietario no están verificadas por un MVZ. Información confidencial.
        </footer>
      </article>
    </div>
  );
}
