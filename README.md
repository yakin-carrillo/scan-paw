# Scan-Paw

Historial clínico universal de perros y gatos, ligado a una placa con código QR.

- **Propietarios**: registran mascotas, vacunas, alergias, padecimientos crónicos y anexos (estudios, recetas); activan la placa; controlan qué ve quien la escanea; activan el modo extraviado.
- **Quien encuentra una mascota**: escanea la placa sin necesidad de cuenta. Ve el nombre de la mascota y los datos de contacto, y puede enviar su ubicación al dueño.
- **Médicos veterinarios (MVZ) verificados**: escanean la placa (o capturan un código del dueño) y obtienen acceso al expediente por **7 días**. Todo lo que registran queda firmado con su nombre y cédula, y el dueño recibe un aviso.
- **Administración**: revisa cédulas y genera lotes de placas para grabado.

Stack: **Next.js 16** (App Router, Server Actions) en **Vercel** + **Supabase** (Postgres con RLS, Auth y Storage) + **Resend** para correos. Todo funciona en los planes gratuitos.

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
  lib/               sesión, clientes Supabase, correo, validación, QR
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
- La clave secreta de Supabase solo se usa en el servidor: para registrar escaneos anónimos, obtener correos para los avisos, firmar la foto pública y eliminar cuentas.

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
npm run test:db    # 33 pruebas de RLS, sin Docker
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
4. **Authentication → Email Templates → Confirm signup**: cambia el enlace por
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/mascotas
   ```
   En **Reset password** usa `...&type=recovery`. Así el enlace funciona aunque se abra en otro dispositivo.
5. **Authentication → SMTP Settings**: configura el SMTP de Resend (`smtp.resend.com`, puerto 465, usuario `resend`, contraseña = tu API key). **Es obligatorio**: el correo integrado de Supabase solo envía a los miembros de tu equipo.
6. **Project Settings → API Keys**: copia la URL, la *publishable key* y la *secret key*.

### 2. Resend

1. Crea una cuenta en <https://resend.com> (gratis: 3 000 correos al mes, 100 al día).
2. Verifica un dominio propio. Sin dominio solo puedes enviarte correos a ti mismo.
3. Crea una API key.

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
   | `RESEND_API_KEY` | API key de Resend |
   | `EMAIL_FROM` | `Scan-Paw <avisos@tu-dominio.com>` |
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
| Resend | 100 correos al día | Avisos de escaneo limitados a 1 cada 10 min por placa |

---

## Estado del Hito 1

- [x] Registro de propietario y de MVZ (cédula en revisión), confirmación por correo, recuperación de contraseña
- [x] Mascotas: alta, edición, foto, fallecimiento
- [x] Expediente: identificación, vacunas, alergias y padecimientos crónicos, anexos; entradas firmadas e inmutables con enmiendas
- [x] Placas: lotes, CSV, QR en SVG, activación, revocación
- [x] Página pública, privacidad configurable, modo extraviado, aviso por correo, ubicación opcional de quien encuentra la mascota
- [x] Acceso MVZ por escaneo o por código del dueño (7 días), bitácora de accesos y escaneos
- [x] Administración: revisión de cédulas con alerta de cédula repetida
- [x] Exportar datos (JSON) y eliminar cuenta (derechos ARCO)
- [x] Pruebas de RLS, CI y respaldo
- [ ] Prueba técnica: consulta automática de la cédula en la SEP (hoy la revisión es manual)
- [ ] Copropietarios y transferencia de mascota
- [ ] Exportar expediente a PDF
- [ ] Aviso de privacidad definitivo (revisión legal)
