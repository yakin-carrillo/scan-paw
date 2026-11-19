# Scan-Paw

Historial clínico universal de perros y gatos, ligado a una placa con código QR.

- **Propietarios**: registran mascotas, vacunas, alergias, padecimientos crónicos y anexos (estudios, recetas); activan la placa; controlan qué ve quien la escanea; activan el modo extraviado.
- **Quien encuentra una mascota**: escanea la placa sin necesidad de cuenta. Ve el nombre de la mascota y los datos de contacto, y puede enviar su ubicación al dueño.
- **Médicos veterinarios (MVZ) verificados**: escanean la placa (o capturan un código del dueño) y obtienen acceso al expediente por **7 días**. Todo lo que registran queda firmado con su nombre y cédula, y el dueño recibe un aviso.
- **Administración**: revisa cédulas y genera lotes de placas para grabado.

Stack: **Next.js 16** (App Router, Server Actions) en **Vercel** + **Supabase** (Postgres con RLS, Auth y Storage) + **Web Push** (notificaciones de la app instalada) para los avisos. Todo funciona en los planes gratuitos.

---

## Estructura

```
src/
  app/
    (auth)/          registro, entrar, recuperar contraseña
    p/[token]/       página pública de la placa (lo que se abre al escanear)
    mascotas/        lista, alta, expediente con pestañas, edición
    placas/activar/  ligar una placa nueva a una mascota
    vet/             panel MVZ (pacientes con acceso, canjear código)
    admin/           verificación de cédulas y lotes de placas (+ CSV)
    cuenta/          perfil, contraseña, exportar datos, eliminar cuenta
    api/             QR en SVG, anexos con URL firmada, cron diario
  lib/               sesión, clientes Supabase, avisos push, validación, QR
  proxy.ts           refresca la sesión y protege rutas privadas
supabase/
  migrations/        esquema, RLS, funciones y buckets
  tests/rls.test.mjs pruebas de seguridad sobre Postgres embebido
```

### Modelo de seguridad

- La autorización vive en la **base de datos**: RLS en todas las tablas y funciones `SECURITY DEFINER` para las operaciones sensibles (activar placa, abrir expediente, canjear código, revisar cédulas).
- El rol anónimo **no puede leer ninguna tabla**. La página pública usa `get_public_pet(token)`, que devuelve solo lo que el dueño permite.
- Las entradas clínicas son **inmutables**. Una corrección es una nueva fila con `amends_id`. El origen (MVZ o propietario) y la firma los asigna un trigger, nunca el cliente.
- El administrador **no puede leer expedientes**.
- La clave secreta de Supabase solo se usa en el servidor: para registrar escaneos anónimos, enviar avisos push, firmar la foto pública y eliminar cuentas.

---

## Desarrollo local

Requisitos: Node.js 20 o superior.

```powershell
npm install
copy .env.example .env.local   # y llena los valores de tu proyecto Supabase
npm run dev
```

Comprobaciones:

```powershell
npm run lint
npm run typecheck
npm run test:db    # 57 pruebas de RLS, sin Docker
npm run build
```

---

## Despliegue (planes gratuitos)

### 1. Supabase

1. Crea un proyecto en <https://supabase.com/dashboard>. Elige la región **East US (North Virginia)**, la misma que Vercel (`iad1`).
2. Aplica la migración:
   ```powershell
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push
   ```
   Alternativa: pega el contenido de `supabase/migrations/20261118000000_init.sql` en el **SQL Editor**.
3. **Authentication → URL Configuration**
   - Site URL: `https://TU-APP.vercel.app`
   - Redirect URLs: `https://TU-APP.vercel.app/**` y `http://localhost:3000/**`
4. **Inicio de sesión con Google** (la app no usa contraseñas):
   1. En <https://console.cloud.google.com> crea un proyecto y, en **APIs y servicios → Pantalla de consentimiento de OAuth**, configúrala como *Externa*. Nombre de la app: Scan-Paw. Permisos: `email`, `profile`, `openid`.
   2. En **Credenciales → Crear credenciales → ID de cliente de OAuth**, elige *Aplicación web*:
      - Orígenes autorizados de JavaScript: `https://TU-APP.vercel.app`
      - URI de redireccionamiento autorizados: `https://TU_PROJECT_REF.supabase.co/auth/v1/callback`
   3. En Supabase, **Authentication → Sign In / Providers → Google**: actívalo y pega el *Client ID* y el *Client Secret*.
   4. Mientras la pantalla de consentimiento esté en modo *Prueba*, solo podrán entrar los correos que agregues como usuarios de prueba. Para abrirla a todos, publícala; con los permisos básicos no requiere verificación de Google.
5. **Project Settings → API Keys**: copia la URL, la *publishable key* y la *secret key*.

Con Google ya no hace falta configurar SMTP en Supabase. La app no envía correos.

### 2. Avisos push (Web Push)

Todos los avisos (escaneos, ubicación, accesos de MVZ, citas, vacunas y verificación de cuentas) son
notificaciones push. Cada persona las activa en **Cuenta → Avisos** en cada dispositivo.

1. Genera un par de llaves VAPID (una sola vez):
   ```powershell
   npx web-push generate-vapid-keys
   ```
2. Guarda la pública en `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y la privada en `VAPID_PRIVATE_KEY` (tabla de abajo).
   Si cambias las llaves, todos tendrán que volver a activar los avisos.

Compatibilidad: Chrome, Edge y Firefox (también en Android sin instalar la app) y Safari en macOS. En
**iPhone** requiere iOS 16.4 o posterior y que la app esté **agregada a la pantalla de inicio**.

### 3. Vercel

1. Sube el proyecto a un repositorio de GitHub.
2. En <https://vercel.com/new>, importa el repositorio. Next.js se detecta solo.
3. Variables de entorno (Production y Preview):

   | Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `SUPABASE_SECRET_KEY` | secret key (**no** pública) |
   | `NEXT_PUBLIC_SITE_URL` | `https://TU-APP.vercel.app`, sin `/` final. Es la URL que llevan los QR |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | llave pública VAPID |
   | `VAPID_PRIVATE_KEY` | llave privada VAPID (**no** pública) |
   | `CRON_SECRET` | valor largo y aleatorio |

4. Despliega. El cron diario (`vercel.json`) llama a `/api/cron/diario` para que Supabase no pause el proyecto por inactividad.

> **Importante:** el dominio de `NEXT_PUBLIC_SITE_URL` queda grabado en las placas. Decide el dominio definitivo **antes** de grabar placas reales.

### 4. Primer administrador

Regístrate en la app y luego ejecuta en el SQL Editor de Supabase:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'tu-correo@ejemplo.com');
```

### 5. Respaldos (opcional, recomendado)

Agrega en GitHub el secreto `SUPABASE_DB_URL` (Supabase → Connect → Session pooler). El workflow `.github/workflows/backup.yml` hace un `pg_dump` cada domingo.

---

## Flujo de placas

1. **Administración → Placas → Generar**: crea un lote con un código de placa (10 caracteres) y un código de activación (8 caracteres) por placa.
2. **Descargar CSV**: se envía al proveedor de grabado. Cada placa lleva el QR (URL `/p/CODIGO`) y el código impreso debajo; el código de activación va en una tarjeta dentro del empaque, **no** en la placa.
3. El dueño escanea su placa nueva, inicia sesión e ingresa el código de activación.
4. Si la placa se pierde, el dueño la desactiva y activa otra.

Especificación sugerida: QR de al menos 2.5 × 2.5 cm, corrección de errores Q y grabado láser sobre aluminio anodizado o acero inoxidable. Pruébala con varios teléfonos antes de producir el lote.

---

## Límites del plan gratuito

| Servicio | Límite | Mitigación |
|---|---|---|
| Supabase | Pausa tras 7 días sin actividad | Cron diario |
| Supabase | 500 MB de base de datos, 1 GB de archivos | Fotos comprimidas en el navegador; anexos de máximo 5 MB |
| Supabase | Sin respaldos descargables | Workflow semanal de `pg_dump` |
| Vercel Hobby | Solo uso **no comercial** | Pasar a Pro antes de cobrar membresías |
| Web Push | Sin costo; la entrega depende del teléfono (ahorro de batería) | Avisos de escaneo limitados a 1 cada 10 min por placa |

---

## Estado del Hito 1

- [x] Inicio de sesión con Google y registro guiado (propietario o MVZ con cédula en revisión; teléfono y consentimiento)
- [x] Mascotas: alta, edición, foto, fallecimiento
- [x] Expediente: identificación, vacunas, alergias y padecimientos crónicos, anexos; entradas firmadas e inmutables con enmiendas
- [x] Placas: lotes, CSV, QR en SVG, activación, revocación
- [x] Página pública, privacidad configurable, modo extraviado, aviso push, ubicación opcional de quien encuentra la mascota
- [x] Acceso MVZ por escaneo o por código del dueño (7 días), bitácora de accesos y escaneos
- [x] Administración: revisión de cédulas con alerta de cédula repetida
- [x] Exportar datos (JSON) y eliminar cuenta (derechos ARCO)
- [x] Pruebas de RLS, CI y respaldo
- [ ] Prueba técnica: consulta automática de la cédula en la SEP (hoy la revisión es manual)
- [ ] Copropietarios y transferencia de mascota
- [ ] Aviso de privacidad definitivo (revisión legal)

## Preparación de la demo (Hito 2 parcial)

- [x] Identidad de marca 1.2: logo de huella dentro de un visor de escaneo (SVG en `brand/`), paleta Índigo Guardián, Coral Latido, Menta Vital y Arena, tipografías Sora, Figtree y JetBrains Mono, íconos Lucide (sin emojis)
- [x] Escáner QR dentro de la app (`/escanear`): BarcodeDetector en Android, jsQR en iPhone, captura manual del código
- [x] Resumen clínico imprimible / PDF (`/mascotas/[id]/resumen`) y cartel "Se busca" (`/mascotas/[id]/cartel`)
- [x] Modo extraviado con un toque desde el expediente; página pública con aviso destacado
- [x] Cuenta de estudiante con matrícula, verificación del admin y marca "No profesionista" en cada entrada
- [x] Portal de clínica: agenda de citas (`/vet/agenda`), vacunas por vencer de los pacientes, "Preparar consulta"
- [x] Al agendar una cita, el acceso del clínico se extiende hasta el día siguiente a la cita (el dueño recibe aviso)
- [x] Membresía por mascota en modo demostración (sin cobro); precios de referencia en `src/lib/plans.ts`
- [x] Recordatorios push de vacunas (7 días antes) y citas (36 h antes) desde el cron diario
- [x] Límite de 10 intentos fallidos por hora al activar placas y canjear códigos
- [x] Datos de demostración desde `/admin` (Luna y Michi, una placa activa y otra para activar en vivo)
- [x] Vercel Web Analytics y prueba de humo `npm run test:smoke`

## Pulido del MVP

- [x] Escáner QR funcional en producción (el encabezado `Permissions-Policy` bloqueaba la cámara) y lectura de placas con QR claro sobre fondo oscuro
- [x] El dueño puede retirar el acceso de un clínico (también cancela sus citas pendientes); cancelar una cita recorta el acceso que se extendió por ella
- [x] Las citas cerradas no se pueden reabrir; una mascota en memoria no puede estar en modo extraviado
- [x] Rutas de fotos y anexos restringidas a la carpeta de su mascota; teléfono validado en la base de datos
- [x] Botones con estado de envío (sin envíos dobles) y confirmación en acciones destructivas
- [x] Registro guiado que conserva lo escrito al cambiar de tipo de cuenta o si hay un error
- [x] Pantallas de carga y de error; los mensajes `?ok=` / `?error=` se limpian de la URL
- [x] Código para compartir con botón de copiar y visible una sola vez
- [x] Contraste AA del acento y del aviso de extraviado en modo oscuro
- [x] El QR de ejemplo de la portada abre una placa de demostración (`/p/EJEMPLO`)
- [x] Índices y políticas RLS optimizadas según los avisos de Supabase

La verificación de cédulas sigue siendo manual: la consulta de la SEP no ofrece una API pública estable y
automatizarla implicaría saltar sus controles anti-robots.
