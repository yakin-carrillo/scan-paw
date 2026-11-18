import { SearchX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md">
      <EmptyState
        icon={SearchX}
        title="No encontramos esta página"
        text="La página no existe o no tienes permiso para verla. Si es un expediente, tu acceso pudo haber vencido."
        action={<ButtonLink href="/">Ir al inicio</ButtonLink>}
      />
    </div>
  );
}
