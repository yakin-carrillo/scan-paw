import type { Metadata } from "next";
import { Alert, Button, ButtonLink, Card, FlashMessages } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { escapeHtml, ownerEmails, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PublicPet } from "@/lib/types";
import { vetOpenRecord } from "./actions";
import { ShareLocationButton } from "./share-location";

// La página de la placa no debe indexarse ni guardarse en caché.
export const metadata: Metadata = { title: "Placa Scan-Paw", robots: { index: false, follow: false } };

function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `52${digits}` : digits;
}

/** Registra el escaneo y, si está en modo extraviado, avisa al dueño (máx. 1 correo / 10 min). */
async function recordPublicScan(token: string, petName: string, lostMode: boolean) {
  try {
    const admin = createAdminClient();
    const { data: tag } = await admin.from("tags").select("id, pet_id").eq("public_token", token).maybeSingle();
    if (!tag?.pet_id) return;

    const { data: last } = await admin
      .from("scan_events")
      .select("created_at")
      .eq("tag_id", tag.id)
      .eq("kind", "publico")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const recent = last && Date.now() - new Date(last.created_at).getTime() < 10 * 60 * 1000;
    if (recent) return;

    await admin.from("scan_events").insert({ tag_id: tag.id, pet_id: tag.pet_id, kind: "publico" });
    if (lostMode) {
      await sendEmail({
        to: await ownerEmails(tag.pet_id),
        subject: `Alguien escaneó la placa de ${petName}`,
        html: `<p>La placa de <strong>${escapeHtml(petName)}</strong> se acaba de escanear. Si quien la encontró
               comparte su ubicación, te llegará otro correo con el mapa.</p>`,
      });
    }
  } catch (err) {
    console.error("No se pudo registrar el escaneo", err);
  }
}

export default async function PublicTagPage({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token: rawToken } = await params;
  const query = await searchParams;
  const token = rawToken.toUpperCase();
  const session = await getSession();
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_public_pet", { p_token: token });
  const info = (data as PublicPet[] | null)?.[0];

  if (!info) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-semibold">Placa no encontrada</h1>
        <p className="mt-2 text-sm text-muted">Revisa que el código esté bien escrito.</p>
      </Card>
    );
  }

  if (info.tag_status === "sin_asignar") {
    return (
      <Card className="mx-auto flex max-w-md flex-col gap-3 text-center">
        <h1 className="text-xl font-semibold">Placa nueva sin activar</h1>
        <p className="text-sm text-muted">
          Si esta placa es tuya, actívala con el código que viene en su empaque.
        </p>
        <ButtonLink href={`/placas/activar?placa=${token}`}>Activar placa</ButtonLink>
      </Card>
    );
  }

  if (info.tag_status === "revocada" || !info.pet_name || info.pet_status === "fallecido") {
    return (
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-xl font-semibold">Placa inactiva</h1>
        <p className="mt-2 text-sm text-muted">Esta placa ya no está en uso.</p>
      </Card>
    );
  }

  // No registrar escaneos del propio dueño ni de MVZ (estos se registran al abrir el expediente).
  if (!session) await recordPublicScan(token, info.pet_name, info.lost_mode);

  let photoUrl: string | null = null;
  if (info.photo_path) {
    const { data: signed } = await createAdminClient()
      .storage.from("pet-photos")
      .createSignedUrl(info.photo_path, 600);
    photoUrl = signed?.signedUrl ?? null;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <FlashMessages error={query.error} />
      {info.lost_mode && (
        <div className="rounded-xl bg-danger p-4 text-white">
          <p className="text-lg font-semibold">¡{info.pet_name} está extraviado!</p>
          <p className="mt-1 text-sm">Por favor contacta a su familia. Gracias por ayudar.</p>
          {info.lost_message && <p className="mt-2 rounded-lg bg-white/15 p-3 text-sm">{info.lost_message}</p>}
        </div>
      )}
      <Card className="flex flex-col items-center gap-3 text-center">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal
          <img src={photoUrl} alt={`Foto de ${info.pet_name}`} className="size-40 rounded-2xl object-cover" />
        ) : (
          <div aria-hidden className="grid size-24 place-items-center rounded-2xl bg-brand-soft text-5xl">
            {info.species === "gato" ? "🐱" : "🐶"}
          </div>
        )}
        <h1 className="text-2xl font-semibold">Hola, soy {info.pet_name}</h1>
        {info.owner_first_name && <p className="text-muted">Mi familia: {info.owner_first_name}</p>}
        {info.contact_phone ? (
          <div className="grid w-full gap-2 sm:grid-cols-2">
            <ButtonLink href={`tel:${info.contact_phone}`}>📞 Llamar</ButtonLink>
            <ButtonLink
              variant="secondary"
              href={`https://wa.me/${whatsappNumber(info.contact_phone)}?text=${encodeURIComponent(
                `Hola, encontré a ${info.pet_name} (escaneé su placa Scan-Paw).`,
              )}`}
              target="_blank"
            >
              💬 WhatsApp
            </ButtonLink>
          </div>
        ) : (
          <p className="text-sm text-muted">El dueño decidió no mostrar su teléfono.</p>
        )}
        <ShareLocationButton token={token} />
      </Card>

      <Card className="text-sm">
        <h2 className="font-semibold">¿Eres médico veterinario?</h2>
        {session?.isVerifiedVet ? (
          <form action={vetOpenRecord.bind(null, token)} className="mt-3 flex flex-col gap-2">
            <p className="text-muted">
              Abrirás el expediente completo por 7 días. El acceso queda registrado y se avisa al dueño.
            </p>
            <Button>Abrir expediente clínico</Button>
          </form>
        ) : session?.profile.role === "vet" ? (
          <Alert tone="warning">Tu cédula aún está en revisión. Podrás abrir expedientes cuando se apruebe.</Alert>
        ) : session ? (
          <p className="mt-2 text-muted">El historial clínico solo está disponible para MVZ verificados.</p>
        ) : (
          <p className="mt-2 text-muted">
            <a href={`/entrar?next=/p/${token}`} className="underline">
              Inicia sesión
            </a>{" "}
            con tu cuenta verificada para ver el historial clínico.
          </p>
        )}
      </Card>
    </div>
  );
}
