import { redirect } from "next/navigation";
import { z } from "zod";
import { Button, ButtonLink, Card, Field, FlashMessages, Input, PageTitle, Select } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { friendlyDbError } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Activar placa" };

const schema = z.object({
  token: z.string().trim().toUpperCase().regex(/^[0-9A-Z]{6,16}$/, "Código de placa no válido."),
  code: z.string().trim().toUpperCase().min(6, "Escribe el código de activación."),
  pet: z.uuid("Elige una mascota."),
});

async function activate(formData: FormData) {
  "use server";
  const parsed = schema.safeParse({
    token: formData.get("token"),
    code: formData.get("code"),
    pet: formData.get("pet"),
  });
  if (!parsed.success) {
    const qs = new URLSearchParams({
      placa: String(formData.get("token") ?? ""),
      error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
    });
    redirect(`/placas/activar?${qs}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_tag", {
    p_token: parsed.data.token,
    p_code: parsed.data.code,
    p_pet: parsed.data.pet,
  });
  if (error) {
    const qs = new URLSearchParams({ placa: parsed.data.token, error: friendlyDbError(error.message) });
    redirect(`/placas/activar?${qs}`);
  }
  redirect(`/mascotas/${parsed.data.pet}?tab=placa&ok=${encodeURIComponent("¡Placa activada!")}`);
}

export default async function ActivarPlacaPage({ searchParams }: PageProps<"/placas/activar">) {
  const query = await searchParams;
  const placa = typeof query.placa === "string" ? query.placa.toUpperCase() : "";
  const preselected = typeof query.mascota === "string" ? query.mascota : "";
  const session = await requireSession(`/placas/activar${placa ? `?placa=${placa}` : ""}`);
  const supabase = await createClient();

  const { data } = await supabase
    .from("pet_owners")
    .select("pets(id, name, status)")
    .eq("user_id", session.userId);
  const pets = ((data ?? []) as unknown as { pets: { id: string; name: string; status: string } | null }[])
    .map((r) => r.pets)
    .filter((p): p is { id: string; name: string; status: string } => Boolean(p) && p!.status === "activo");

  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Activar placa" subtitle="Liga tu placa Scan-Paw con una de tus mascotas." />
      <FlashMessages error={query.error} />
      {pets.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-muted">Primero registra a tu mascota.</p>
          <ButtonLink href="/mascotas/nueva" className="mt-3">
            Registrar mascota
          </ButtonLink>
        </Card>
      ) : (
        <Card>
          <form action={activate} className="flex flex-col gap-4">
            <Field label="Código de la placa" hint="Aparece impreso debajo del QR.">
              <Input name="token" required defaultValue={placa} className="font-mono uppercase" autoCapitalize="characters" />
            </Field>
            <Field label="Código de activación" hint="Viene en la tarjeta del empaque, no en la placa.">
              <Input name="code" required className="font-mono uppercase" autoCapitalize="characters" autoComplete="off" />
            </Field>
            <Field label="Mascota">
              <Select name="pet" required defaultValue={preselected}>
                <option value="" disabled>
                  Elige…
                </option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-muted">Si la mascota ya tenía una placa activa, la anterior se desactivará.</p>
            <Button type="submit">Activar</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
