"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registerAttachment, setPetPhoto } from "@/app/mascotas/actions";
import { createClient } from "@/lib/supabase/client";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

const MAX_BYTES = 5 * 1024 * 1024;

/** Reduce una imagen a máx. `maxSide` px en JPEG para ahorrar almacenamiento. */
async function compressImage(file: File, maxSide: number, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", quality),
  );
}

export function PhotoUploader({ petId }: { petId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const blob = await compressImage(file, 1024);
        const path = `${petId}/${crypto.randomUUID()}.jpg`;
        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from("pet-photos")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const res = await setPetPhoto(petId, path);
        if (res.error) throw new Error(res.error);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:bg-brand-soft">
        {pending ? "Subiendo…" : "Cambiar foto"}
        <input type="file" accept="image/*" className="sr-only" onChange={onChange} disabled={pending} />
      </label>
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

export function AttachmentUploader({ petId }: { petId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const title = String(data.get("title") ?? "").trim();
    const kind = String(data.get("kind")) as "estudio" | "receta" | "otro";
    if (!(file instanceof File) || file.size === 0) return setError("Elige un archivo.");
    if (!title) return setError("Escribe un título.");
    setError(null);
    setDone(false);

    startTransition(async () => {
      try {
        let body: Blob = file;
        let mime = file.type;
        let ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        if (mime.startsWith("image/")) {
          body = await compressImage(file, 2000, 0.85);
          mime = "image/jpeg";
          ext = "jpg";
        } else if (mime !== "application/pdf") {
          throw new Error("Solo se aceptan PDF o imágenes.");
        }
        if (body.size > MAX_BYTES) throw new Error("El archivo supera 5 MB.");

        const path = `${petId}/${crypto.randomUUID()}.${ext}`;
        const supabase = createClient();
        const { error: upErr } = await supabase.storage
          .from("attachments")
          .upload(path, body, { contentType: mime });
        if (upErr) throw upErr;

        const res = await registerAttachment(petId, {
          kind,
          title,
          path,
          mime: mime as "application/pdf",
          size: body.size,
          notes: String(data.get("notes") ?? ""),
        });
        if (res.error) throw new Error(res.error);
        form.reset();
        setDone(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Tipo">
        <Select name="kind" defaultValue="estudio">
          <option value="estudio">Estudio (laboratorio, rayos X…)</option>
          <option value="receta">Receta médica</option>
          <option value="otro">Otro</option>
        </Select>
      </Field>
      <Field label="Título">
        <Input name="title" maxLength={120} placeholder="Hemograma completo" required />
      </Field>
      <Field label="Archivo" hint="PDF o imagen, máximo 5 MB. Las fotos se comprimen automáticamente.">
        <Input name="file" type="file" accept="application/pdf,image/*" required />
      </Field>
      <Field label="Notas (opcional)">
        <Input name="notes" maxLength={500} />
      </Field>
      <div className="flex flex-col gap-2 sm:col-span-2">
        {error && <Alert tone="error">{error}</Alert>}
        {done && <Alert tone="success">Anexo guardado.</Alert>}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Subiendo…" : "Subir anexo"}
        </Button>
      </div>
    </form>
  );
}
