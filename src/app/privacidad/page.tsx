import { Alert, Card, PageTitle } from "@/components/ui";

export const metadata = { title: "Aviso de privacidad" };

// BORRADOR: debe revisarlo un asesor legal antes de operar con usuarios reales.
export default function PrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="Legal" title="Aviso de privacidad" subtitle="Versión preliminar · noviembre 2026" />
      <div className="mb-4">
        <Alert tone="warning">
          Borrador para el proyecto académico. Debe completarse con los datos del responsable y revisarse con un asesor
          antes de operar con usuarios reales.
        </Alert>
      </div>
      <Card className="flex flex-col gap-4 text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold">Responsable</h2>
          <p>[Nombre o razón social del responsable], con domicilio en [domicilio] y correo de contacto [correo].</p>
        </section>
        <section>
          <h2 className="font-semibold">Datos que recabamos</h2>
          <p>
            Identificación y contacto del propietario (nombre, correo electrónico, teléfono); datos de identificación de
            sus mascotas; información clínica veterinaria (vacunas, alergias, padecimientos, estudios y recetas); para
            médicos veterinarios, número de cédula profesional y clínica; para estudiantes, universidad y matrícula; citas agendadas; registros de acceso y, solo si quien escanea
            una placa lo autoriza, su ubicación aproximada.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Finalidades</h2>
          <ul className="list-disc pl-5">
            <li>Mantener el historial clínico de la mascota y compartirlo con médicos veterinarios verificados.</li>
            <li>Permitir que quien encuentre una mascota extraviada contacte a su propietario.</li>
            <li>Verificar la cédula profesional de los médicos veterinarios y la matrícula de los estudiantes.</li>
            <li>Enviar recordatorios de vacunas y citas.</li>
            <li>Enviar avisos de seguridad (escaneos, accesos al expediente).</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">Con quién se comparten</h2>
          <p>
            Quien escanee la placa solo ve el nombre de la mascota, el nombre de pila del propietario y, si así lo
            decide el propietario, su teléfono y la foto de la mascota. El expediente clínico solo lo ven el propietario
            y los médicos veterinarios o estudiantes verificados que escanean la placa o reciben un código del
            propietario, por 7 días (o hasta el día siguiente de una cita agendada). Las entradas de estudiantes se marcan
            como &quot;No profesionista&quot;. Utilizamos proveedores de infraestructura (Supabase, Vercel) que tratan los datos por cuenta
            nuestra. Los avisos se envían como notificaciones push a través del servicio de tu navegador (Google, Apple o
            Mozilla), cifradas de extremo a extremo, y solo a los dispositivos donde los activaste.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Derechos ARCO y revocación</h2>
          <p>
            Puedes acceder, rectificar, cancelar u oponerte al tratamiento de tus datos, así como revocar tu
            consentimiento. Desde &quot;Mi cuenta&quot; puedes editar tus datos, descargar una copia completa y eliminar tu
            cuenta. Para otras solicitudes escribe a [correo].
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Cambios</h2>
          <p>Cualquier cambio a este aviso se publicará en esta página.</p>
        </section>
      </Card>
    </div>
  );
}
