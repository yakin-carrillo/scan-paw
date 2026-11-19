import { redirect } from "next/navigation";
import { PageTitle } from "@/components/ui";
import { getSession, homePath } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Completa tu registro" };

export default async function BienvenidaPage({ searchParams }: PageProps<"/bienvenida">) {
  const params = await searchParams;
  const session = await getSession();
  if (!session) redirect("/entrar?next=/bienvenida");
  if (session.onboarded) redirect(homePath(session.profile.role));

  const tipo = params.tipo === "vet" || params.tipo === "student" ? params.tipo : "owner";

  return (
    <div className="mx-auto max-w-lg">
      <PageTitle eyebrow="Último paso" title="Completa tu registro" subtitle={session.email ?? undefined} />
      <OnboardingForm initialTipo={tipo} next={safeNext(params.next, "")} defaultName={session.profile.full_name} />
    </div>
  );
}
