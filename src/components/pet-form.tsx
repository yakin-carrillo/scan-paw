import { Button, Field, Input, Select } from "@/components/ui";
import type { Pet } from "@/lib/types";

export function PetForm({
  action,
  pet,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  pet?: Pet;
  submitLabel: string;
}) {
  const sterilized = pet?.sterilized == null ? "" : pet.sterilized ? "si" : "no";
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre">
        <Input name="name" required maxLength={60} defaultValue={pet?.name} />
      </Field>
      <Field label="Especie">
        <Select name="species" required defaultValue={pet?.species ?? ""}>
          <option value="" disabled>
            Elige…
          </option>
          <option value="perro">Perro</option>
          <option value="gato">Gato</option>
        </Select>
      </Field>
      <Field label="Raza">
        <Input name="breed" maxLength={80} defaultValue={pet?.breed ?? ""} placeholder="Mestizo" />
      </Field>
      <Field label="Sexo">
        <Select name="sex" defaultValue={pet?.sex ?? ""}>
          <option value="">Sin especificar</option>
          <option value="macho">Macho</option>
          <option value="hembra">Hembra</option>
        </Select>
      </Field>
      <Field label="Fecha de nacimiento" hint="Aproximada si no la conoces.">
        <Input name="birth_date" type="date" defaultValue={pet?.birth_date ?? ""} />
      </Field>
      <Field label="Color / señas particulares">
        <Input name="color" maxLength={80} defaultValue={pet?.color ?? ""} />
      </Field>
      <Field label="¿Esterilizado?">
        <Select name="sterilized" defaultValue={sterilized}>
          <option value="">No sé</option>
          <option value="si">Sí</option>
          <option value="no">No</option>
        </Select>
      </Field>
      <Field label="Microchip (opcional)">
        <Input name="microchip" maxLength={30} defaultValue={pet?.microchip ?? ""} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
