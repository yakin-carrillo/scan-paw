import type { Metadata } from "next";
import { BadgeCheck, GraduationCap, Lock, MessageCircle, Phone, QrCode, Siren, Stethoscope } from "lucide-react";
import { PawMark } from "@/components/logo";
import { Alert, Button, ButtonLink, Card, FlashMessages, PetAvatar } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { notifyUsers, petOwnerIds } from "@/lib/push";
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

/** Registra el escaneo y, si está en modo extraviado, avisa al dueño (máx. 1 aviso / 10 min). */
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
      await notifyUsers(await petOwnerIds(tag.pet_id), {
        title: `Alguien escaneó la placa de ${petName}`,
        body: "Si quien la encontró comparte su ubicación, te avisaremos con el mapa.",
        url: `/mascotas/${tag.pet_id}?tab=accesos`,
        tag: `escaneo-${tag.pet_id}`,
      });
    }
  } catch (err) {
    console.error("No se pudo registrar el escaneo", err);
  }
}

/** El QR de ejemplo de la portada (…/p/EJEMPLO) muestra esta vista sin datos reales. */
const DEMO_TOKEN = "EJEMPLO";
const DEMO_INFO: PublicPet = {
  tag_status: "activa",
  pet_name: "Luna",
  species: "perro",
  pet_status: "activo",
  owner_first_name: "Ana",
  contact_phone: null,
  lost_mode: true,
  lost_message: "Se perdió cerca del parque. Necesita su medicamento diario. ¡Gracias!",
  photo_path: null,
};

async function signedPhoto(path: string): Promise<string | null> {
  try {
    const { data } = await createAdminClient().storage.from("pet-photos").createSignedUrl(path, 600);
    return data?.signedUrl ?? null;
  } catch (err) {
    // Sin clave secreta (p. ej. en un despliegue de vista previa) se muestra la silueta.
    console.error("No se pudo firmar la foto pública", err);
    return null;
  }
}

function Notice({ icon: Icon, title, text, children }: {
  icon: typeof QrCode;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon aria-hidden className="size-7" />
      </span>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted">{text}</p>
      {children}
    </Card>
  );
}

export default async function PublicTagPage({ params, searchParams }: PageProps<"/p/[token]">) {
  const { token: rawToken } = await params;
  const query = await searchParams;
  const token = rawToken.toUpperCase();
  const session = await getSession();
  const supabase = await createClient();

  const demo = token === DEMO_TOKEN;
  const { data } = demo ? { data: [DEMO_INFO] } : await supabase.rpc("get_public_pet", { p_token: token });
  const info = (data as PublicPet[] | null)?.[0];

  if (!info) {
    return <Notice icon={QrCode} title="Placa no encontrada" text="Revisa que el código esté bien escrito." />;
  }

  if (info.tag_status === "sin_asignar") {
    return (
      <Notice icon={QrCode} title="Placa nueva sin activar" text="Si esta placa es tuya, actívala con el código que viene en su empaque.">
        <ButtonLink href={`/placas/activar?placa=${token}`} size="lg" className="w-full">
          Activar placa
        </ButtonLink>
      </Notice>
    );
  }

  if (info.tag_status === "revocada" || !info.pet_name || info.pet_status === "fallecido") {
    return <Notice icon={QrCode} title="Placa inactiva" text="Esta placa ya no está en uso." />;
  }

  // No registrar escaneos de usuarios con sesión (los clínicos se registran al abrir el expediente).
  if (!session && !demo) await recordPublicScan(token, info.pet_name, info.lost_mode);
  const photoUrl = info.photo_path ? await signedPhoto(info.photo_path) : null;

  const clinician = session?.profile.role === "vet" || session?.profile.role === "student";
  const isStudent = session?.profile.role === "student";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <FlashMessages error={query.error} />
      {demo && (
        <Alert tone="info" title="Placa de ejemplo">
          Así ve tu placa quien encuentra a tu mascota extraviada. Los datos son ficticios.{" "}
          <a href="/entrar" className="font-medium underline">
            Crea la de tu mascota
          </a>
          .
        </Alert>
      )}
      {info.lost_mode && (
        <div role="alert" className="overflow-hidden rounded-3xl bg-danger text-danger-ink shadow-lift">
          <div className="flex items-center gap-3 px-5 pt-5">
            <span className="grid size-11 place-items-center rounded-2xl bg-white/20">
              <Siren aria-hidden className="size-6" />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase opacity-90">Mascota extraviada</p>
              <p className="font-display text-2xl font-semibold">{info.pet_name} se perdió</p>
            </div>
          </div>
          <p className="px-5 pt-3 pb-5 text-sm">Su familia la está buscando. Contáctala por favor; gracias por ayudar.</p>
          {info.lost_message && <p className="bg-black/15 px-5 py-4 text-sm">{info.lost_message}</p>}
        </div>
      )}

      <Card className="flex flex-col items-center gap-4 text-center">
        <PetAvatar species={info.species} name={info.pet_name} photoUrl={photoUrl} size="xl" />
        <div>
          <h1 className="text-3xl font-semibold">Hola, soy {info.pet_name}</h1>
          {info.owner_first_name && <p className="mt-1 text-muted">Mi familia: {info.owner_first_name}</p>}
        </div>
        {info.contact_phone ? (
          <div className="grid w-full gap-2">
            <ButtonLink href={`tel:${info.contact_phone}`} size="lg" variant={info.lost_mode ? "danger" : "primary"}>
              <Phone aria-hidden /> Llamar a su familia
            </ButtonLink>
            <ButtonLink
              variant="secondary"
              size="lg"
              href={`https://wa.me/${whatsappNumber(info.contact_phone)}?text=${encodeURIComponent(
                `Hola, encontré a ${info.pet_name} (escaneé su placa Scan-Paw).`,
              )}`}
              target="_blank"
            >
              <MessageCircle aria-hidden /> Enviar WhatsApp
            </ButtonLink>
          </div>
        ) : demo ? (
          <p className="text-sm text-muted">
            En una placa real aquí aparecen los botones para llamar o escribir por WhatsApp a su familia y para enviarle
            tu ubicación.
          </p>
        ) : (
          <p className="text-sm text-muted">La familia decidió no mostrar su teléfono. Comparte tu ubicación para avisarle.</p>
        )}
        {!demo && (
          <div className="w-full">
            <ShareLocationButton token={token} />
          </div>
        )}
      </Card>

      {!demo && (
        <Card className="text-sm">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
              <Stethoscope aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">¿Eres médico veterinario?</h2>
              {session?.isVerifiedClinician ? (
                <form action={vetOpenRecord.bind(null, token)} className="mt-2 flex flex-col gap-3">
                  <p className="text-muted">
                    Abrirás el expediente completo por 7 días. El acceso queda registrado y se avisa al propietario.
                  </p>
                  {isStudent && (
                    <Alert tone="warning">
                      Entras como estudiante. Lo que registres se marcará como No profesionista.
                    </Alert>
                  )}
                  <Button size="lg">
                    {isStudent ? <GraduationCap aria-hidden /> : <BadgeCheck aria-hidden />} Abrir expediente clínico
                  </Button>
                </form>
              ) : clinician ? (
                <div className="mt-2">
                  <Alert tone="warning">
                    Tu cuenta aún está en revisión. Podrás abrir expedientes cuando se apruebe.
                  </Alert>
                </div>
              ) : session ? (
                <p className="mt-1 text-muted">El historial clínico solo está disponible para MVZ verificados.</p>
              ) : (
                <p className="mt-1 text-muted">
                  <a href={`/entrar?next=/p/${token}`} className="font-medium text-brand underline">
                    Inicia sesión
                  </a>{" "}
                  con tu cuenta verificada para ver el historial clínico.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock aria-hidden className="size-3.5" /> Protegido por <PawMark className="size-3.5 text-brand" /> Scan-Paw
      </p>
    </div>
  );
}
