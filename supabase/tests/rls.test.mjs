// Pruebas de la migración y de las políticas RLS sin Docker.
// Ejecuta un Postgres embebido (PGlite) con imitaciones mínimas de los
// esquemas auth y storage de Supabase, aplica las migraciones y verifica
// quién puede ver y escribir qué.
//
//   npm run test:db
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const db = new PGlite({ extensions: { pgcrypto } });
let passed = 0;
let failed = 0;

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text not null
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage to anon, authenticated;
  grant all on storage.objects to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

async function as(userId, fn) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`);
  await db.exec(userId ? "set role authenticated" : "set role anon");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

async function expectError(promise, fragment) {
  try {
    await promise;
  } catch (err) {
    if (fragment && !String(err.message).includes(fragment)) {
      throw new Error(`Error inesperado: ${err.message}`);
    }
    return;
  }
  throw new Error("Se esperaba un error y no ocurrió");
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function signUp(meta) {
  const { rows } = await db.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [`${crypto.randomUUID()}@test.mx`, meta],
  );
  return rows[0].id;
}

// ------------------------------------------------------------------
await db.exec(SUPABASE_STUBS);
const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(join(dir, file), "utf8"));
  console.log(`Migración aplicada: ${file}`);
}

// Alta como lo hace Google OAuth (solo nombre) y luego el registro guiado.
async function onboard(meta, role, phone, cedula = null) {
  const id = await signUp(meta);
  await as(id, () =>
    db.query("select public.complete_onboarding($1, $2, $3, $4, null)", [role, meta.full_name ?? meta.name, phone, cedula]));
  return id;
}

const owner = await onboard({ full_name: "Ana López" }, "owner", "5512345678");
const other = await onboard({ name: "Beto Ruiz" }, "owner", "5587654321");
const vet = await onboard({ full_name: "Dra. Carla Díaz" }, "vet", "5511112222", "1234567");
const vet2 = await onboard({ full_name: "Dr. Diego Mora" }, "vet", "5533334444", "7654321");
const sneaky = await signUp({ role: "admin", full_name: "Intruso" });
const admin = await onboard({ full_name: "Admin" }, "owner", "5599999999");
await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);
const petId = crypto.randomUUID();

console.log("\nRegistro y perfiles");
await test("Google: el nombre llega en full_name o name", async () => {
  const { rows } = await db.query("select full_name from public.profiles where id = $1", [other]);
  assert(rows[0].full_name === "Beto Ruiz", rows[0].full_name);
});
await test("el registro guiado crea vet_profile pendiente", async () => {
  const { rows } = await db.query("select role from public.profiles where id = $1", [vet]);
  assert(rows[0].role === "vet", "rol incorrecto");
  const v = await db.query("select status from public.vet_profiles where user_id = $1", [vet]);
  assert(v.rows[0].status === "pending", "debería estar pendiente");
});
await test("no se puede obtener el rol admin desde los metadatos", async () => {
  const { rows } = await db.query("select role, privacy_accepted_at from public.profiles where id = $1", [sneaky]);
  assert(rows[0].role === "owner" && rows[0].privacy_accepted_at === null, JSON.stringify(rows[0]));
});
await test("el registro guiado no acepta admin ni se repite", async () => {
  await as(sneaky, () => expectError(db.query("select public.complete_onboarding('admin', 'Intruso', '5500000000')"), "no válido"));
  await as(owner, () => expectError(db.query("select public.complete_onboarding('vet', 'Ana', '5512345678', '1234567')"), "ya está completo"));
});
await test("el registro guiado valida la cédula", () =>
  as(sneaky, () => expectError(db.query("select public.complete_onboarding('vet', 'Intruso Pérez', '5500000000', '12')"), "cédula")));
await test("anónimo no puede completar un registro", () =>
  as(null, () => expectError(db.query("select public.complete_onboarding('owner', 'X Y Z', '5500000000')"), "permission denied")));
await test("el usuario no puede cambiar su propio rol", () =>
  as(owner, () => expectError(db.query("update public.profiles set role = 'admin' where id = $1", [owner]), "permission denied")));
await test("el usuario sí puede cambiar su teléfono", () =>
  as(owner, async () => {
    await db.query("update public.profiles set phone = '5512345678' where id = $1", [owner]);
  }));
await test("un usuario no ve el perfil de otro sin relación", () =>
  as(other, async () => {
    const { rows } = await db.query("select id from public.profiles where id = $1", [owner]);
    assert(rows.length === 0, "vio un perfil ajeno");
  }));

console.log("\nMascotas");
await test("el dueño registra una mascota y queda como principal", () =>
  as(owner, async () => {
    await db.query("insert into public.pets (id, name, species, created_by) values ($1, 'Firulais', 'perro', $2)", [petId, owner]);
    const { rows } = await db.query("select role from public.pet_owners where pet_id = $1", [petId]);
    assert(rows[0]?.role === "principal", "sin propietario principal");
  }));
await test("no se puede crear una mascota a nombre de otro", () =>
  as(other, () =>
    expectError(db.query("insert into public.pets (name, species, created_by) values ('X', 'gato', $1)", [owner]), "row-level security")));
await test("otro usuario no ve la mascota", () =>
  as(other, async () => {
    const { rows } = await db.query("select id from public.pets where id = $1", [petId]);
    assert(rows.length === 0, "vio una mascota ajena");
  }));
await test("anónimo no puede leer tablas", () =>
  as(null, () => expectError(db.query("select * from public.pets"), "permission denied")));
await test("el dueño no puede borrar la mascota (se usa estado)", () =>
  as(owner, () => expectError(db.query("delete from public.pets where id = $1", [petId]), "permission denied")));

console.log("\nPlacas");
let tag;
await test("solo el admin genera placas", async () => {
  await as(owner, () => expectError(db.query("select * from public.admin_generate_tags(3, 'x')"), "Solo administradores"));
  const { rows } = await as(admin, () => db.query("select * from public.admin_generate_tags(3, 'lote-prueba')"));
  assert(rows.length === 3, `generó ${rows.length}`);
  assert(/^[2-9A-HJ-NP-Z]{10}$/.test(rows[0].public_token), `token raro ${rows[0].public_token}`);
  tag = rows[0];
});
await test("la placa sin activar se reporta como sin_asignar", () =>
  as(null, async () => {
    const { rows } = await db.query("select * from public.get_public_pet($1)", [tag.public_token]);
    assert(rows[0].tag_status === "sin_asignar" && rows[0].pet_name === null, JSON.stringify(rows[0]));
  }));
await test("código de activación incorrecto devuelve false", () =>
  as(owner, async () => {
    const { rows } = await db.query("select public.activate_tag($1, 'MALO', $2) as ok", [tag.public_token, petId]);
    assert(rows[0].ok === false, "debió fallar");
  }));
await test("otro usuario no puede ligar la placa a una mascota ajena", () =>
  as(other, () =>
    expectError(db.query("select public.activate_tag($1, $2, $3)", [tag.public_token, tag.activation_code, petId]), "no es tuya")));
await test("el dueño activa la placa", () =>
  as(owner, () => db.query("select public.activate_tag($1, $2, $3)", [tag.public_token.toLowerCase(), tag.activation_code, petId])));
await test("vista pública: nombre y teléfono, sin foto ni historial", () =>
  as(null, async () => {
    const { rows } = await db.query("select * from public.get_public_pet($1)", [tag.public_token]);
    const r = rows[0];
    assert(r.pet_name === "Firulais" && r.owner_first_name === "Ana" && r.contact_phone === "5512345678", JSON.stringify(r));
    assert(r.photo_path === null, "expuso la foto");
  }));
await test("el dueño puede ocultar su teléfono", async () => {
  await as(owner, () => db.query("update public.pets set show_phone = false where id = $1", [petId]));
  const { rows } = await as(null, () => db.query("select contact_phone from public.get_public_pet($1)", [tag.public_token]));
  assert(rows[0].contact_phone === null, "siguió mostrando el teléfono");
  await as(owner, () => db.query("update public.pets set show_phone = true where id = $1", [petId]));
});

console.log("\nAcceso de médicos veterinarios");
await test("MVZ pendiente no puede abrir el expediente", () =>
  as(vet, () => expectError(db.query("select public.vet_open_pet($1)", [tag.public_token]), "verificados")));
await test("solo el admin aprueba cédulas", async () => {
  await as(vet, () => expectError(db.query("select public.admin_review_vet($1, 'approved', '')", [vet]), "Solo administradores"));
  await as(admin, () => db.query("select public.admin_review_vet($1, 'approved', '')", [vet]));
  await as(admin, () => db.query("select public.admin_review_vet($1, 'approved', '')", [vet2]));
});
await test("MVZ sin acceso aún no ve la mascota", () =>
  as(vet, async () => {
    const { rows } = await db.query("select id from public.pets where id = $1", [petId]);
    assert(rows.length === 0, "vio la mascota sin escanear");
  }));
await test("MVZ verificado escanea y obtiene acceso por 7 días", () =>
  as(vet, async () => {
    const { rows } = await db.query("select public.vet_open_pet($1) as pet", [tag.public_token]);
    assert(rows[0].pet === petId, "pet incorrecto");
    const p = await db.query("select name from public.pets where id = $1", [petId]);
    assert(p.rows.length === 1, "no ve la mascota");
    const owners = await db.query("select phone from public.profiles where id = $1", [owner]);
    assert(owners.rows.length === 1, "no ve los datos del dueño");
  }));
await test("el MVZ no puede editar la identificación de la mascota", () =>
  as(vet, async () => {
    const r = await db.query("update public.pets set name = 'Otro' where id = $1", [petId]);
    assert(r.affectedRows === 0, "pudo editar");
  }));

console.log("\nExpediente clínico");
await test("vacuna registrada por MVZ queda firmada con su cédula", () =>
  as(vet, async () => {
    await db.query(
      "insert into public.vaccinations (pet_id, vaccine, applied_on, source) values ($1, 'Antirrábica', '2026-11-01', 'propietario')",
      [petId],
    );
    const { rows } = await db.query("select source, author_cedula, author_name from public.vaccinations where pet_id = $1", [petId]);
    assert(rows[0].source === "vet" && rows[0].author_cedula === "1234567", JSON.stringify(rows[0]));
  }));
await test("el dueño no puede hacerse pasar por MVZ", () =>
  as(owner, async () => {
    await db.query(
      "insert into public.vaccinations (pet_id, vaccine, applied_on, source, author_cedula) values ($1, 'Séxtuple', '2026-10-01', 'vet', '9999999')",
      [petId],
    );
    const { rows } = await db.query("select source, author_cedula from public.vaccinations where vaccine = 'Séxtuple'");
    assert(rows[0].source === "propietario" && rows[0].author_cedula === null, JSON.stringify(rows[0]));
  }));
await test("las entradas son inmutables (no update ni delete)", () =>
  as(vet, async () => {
    await expectError(db.query("update public.vaccinations set vaccine = 'x'"), "permission denied");
    await expectError(db.query("delete from public.vaccinations"), "permission denied");
  }));
await test("se puede corregir con una enmienda", () =>
  as(vet, async () => {
    const { rows } = await db.query("select id from public.vaccinations where vaccine = 'Antirrábica'");
    await db.query(
      "insert into public.vaccinations (pet_id, vaccine, applied_on, amends_id, source) values ($1, 'Antirrábica', '2026-11-02', $2, 'vet')",
      [petId, rows[0].id],
    );
  }));
await test("un tercero no puede escribir en el expediente", () =>
  as(other, () =>
    expectError(
      db.query("insert into public.conditions (pet_id, kind, description, source) values ($1, 'alergia', 'x', 'vet')", [petId]),
    )));
await test("el MVZ sin acceso no ve el expediente", () =>
  as(vet2, async () => {
    const { rows } = await db.query("select id from public.vaccinations where pet_id = $1", [petId]);
    assert(rows.length === 0, "vio vacunas sin acceso");
  }));
await test("el administrador no ve expedientes", () =>
  as(admin, async () => {
    const { rows } = await db.query("select id from public.vaccinations where pet_id = $1", [petId]);
    assert(rows.length === 0, "el admin vio vacunas");
  }));

console.log("\nCódigos para compartir");
await test("el dueño comparte un código y otro MVZ lo canjea una sola vez", async () => {
  await as(other, () => expectError(db.query("select public.create_share_code($1)", [petId]), "no es tuya"));
  const { rows } = await as(owner, () => db.query("select public.create_share_code($1) as code", [petId]));
  const code = rows[0].code;
  assert(/^[2-9A-HJ-NP-Z]{6}$/.test(code), `código raro ${code}`);
  await as(other, () => expectError(db.query("select public.redeem_share_code($1)", [code]), "verificados"));
  const r = await as(vet2, () => db.query("select public.redeem_share_code($1) as pet", [code.toLowerCase()]));
  assert(r.rows[0].pet === petId, "pet incorrecto");
  const again = await as(vet2, () => db.query("select public.redeem_share_code($1) as pet", [code]));
  assert(again.rows[0].pet === null, "el código se canjeó dos veces");
});

console.log("\nStorage");
await test("el dueño sube anexos en la carpeta de su mascota; otro no", async () => {
  await as(owner, () =>
    db.query("insert into storage.objects (bucket_id, name) values ('attachments', $1)", [`${petId}/a.pdf`]));
  await as(other, () =>
    expectError(db.query("insert into storage.objects (bucket_id, name) values ('attachments', $1)", [`${petId}/b.pdf`]), "row-level security"));
  const seen = await as(other, () => db.query("select name from storage.objects where bucket_id = 'attachments'"));
  assert(seen.rows.length === 0, "otro usuario vio archivos");
});
await test("ruta con carpeta inválida no rompe la política", () =>
  as(owner, () =>
    expectError(db.query("insert into storage.objects (bucket_id, name) values ('attachments', 'no-es-uuid/x.pdf')"), "row-level security")));

console.log("\nLímite de intentos");
await test("tras 10 códigos de activación fallidos se bloquea una hora", async () => {
  const otherPet = crypto.randomUUID();
  await as(other, () =>
    db.query("insert into public.pets (id, name, species, created_by) values ($1, 'Kira', 'gato', $2)", [otherPet, other]));
  for (let i = 0; i < 10; i++) {
    await as(other, () => db.query("select public.activate_tag('NOEXISTE00', 'MALO', $1)", [otherPet]));
  }
  await as(other, () =>
    expectError(db.query("select public.activate_tag('NOEXISTE00', 'MALO', $1)", [otherPet]), "Demasiados intentos"));
});

console.log("\nEstudiantes (No profesionista)");
const student = await signUp({ full_name: "Eva Soto" });
await test("el estudiante se registra con universidad y matrícula", async () => {
  await as(student, () =>
    expectError(db.query("select public.complete_onboarding('student', 'Eva Soto', '5522223333', null, null, 'UNAM', '!')"), "matrícula"));
  await as(student, () =>
    db.query("select public.complete_onboarding('student', 'Eva Soto', '5522223333', null, null, 'UNAM FMVZ', '318004512')"));
  const { rows } = await db.query("select status from public.student_profiles where user_id = $1", [student]);
  assert(rows[0]?.status === "pending", JSON.stringify(rows));
});
await test("estudiante pendiente no abre expedientes", () =>
  as(student, () => expectError(db.query("select public.vet_open_pet($1)", [tag.public_token]), "verificados")));
await test("solo el admin aprueba estudiantes", async () => {
  await as(student, () =>
    expectError(db.query("select public.admin_review_student($1, 'approved', '')", [student]), "Solo administradores"));
  await as(admin, () => db.query("select public.admin_review_student($1, 'approved', '')", [student]));
});
await test("lo que registra un estudiante queda marcado como 'estudiante'", async () => {
  await as(student, () => db.query("select public.vet_open_pet($1)", [tag.public_token]));
  await as(student, () =>
    db.query("insert into public.vaccinations (pet_id, vaccine, applied_on, source) values ($1, 'Parvovirus', '2026-11-01', 'vet')", [petId]));
  const { rows } = await as(owner, () =>
    db.query("select source, author_name, author_cedula from public.vaccinations where vaccine = 'Parvovirus'"));
  assert(rows[0].source === "estudiante" && rows[0].author_cedula === null && rows[0].author_name === "Eva Soto", JSON.stringify(rows[0]));
});
await test("el dueño ve la universidad del estudiante que accedió", async () => {
  const { rows } = await as(owner, () =>
    db.query("select university from public.student_profiles where user_id = $1", [student]));
  assert(rows[0]?.university === "UNAM FMVZ", JSON.stringify(rows));
});

console.log("\nCitas");
let appointmentId;
await test("el MVZ con acceso agenda una cita y su acceso se extiende hasta la cita", async () => {
  const at = new Date(Date.now() + 20 * 24 * 3600 * 1000).toISOString();
  const { rows } = await as(vet, () =>
    db.query("select public.schedule_appointment($1, $2, 'Revisión de dermatitis') as id", [petId, at]));
  appointmentId = rows[0].id;
  const acc = await as(vet, () =>
    db.query("select max(expires_at) as until from public.vet_access where pet_id = $1 and vet_id = $2", [petId, vet]));
  assert(new Date(acc.rows[0].until) > new Date(at), "no se extendió el acceso");
});
await test("un tercero no puede agendar ni ver la cita", async () => {
  await as(other, () =>
    expectError(db.query("select public.schedule_appointment($1, now() + interval '1 day', 'x')", [petId]), "acceso vigente"));
  const { rows } = await as(other, () => db.query("select id from public.appointments"));
  assert(rows.length === 0, "vio citas ajenas");
});
await test("el dueño ve la cita y solo puede cancelarla", async () => {
  const { rows } = await as(owner, () => db.query("select pet_name, reason from public.appointments where id = $1", [appointmentId]));
  assert(rows[0]?.pet_name === "Firulais", JSON.stringify(rows));
  await as(owner, () =>
    expectError(db.query("select public.set_appointment_status($1, 'completada')", [appointmentId]), "No puedes"));
  await as(owner, () => db.query("select public.set_appointment_status($1, 'cancelada')", [appointmentId]));
});
await test("no se puede escribir directo en la tabla de citas", () =>
  as(vet, () => expectError(db.query("update public.appointments set reason = 'x'"), "permission denied")));

console.log("\nMembresía (demostración)");
await test("el dueño activa la membresía; otro no la ve ni la activa", async () => {
  await as(other, () => expectError(db.query("select public.demo_activate_membership($1, 'anual')", [petId]), "no es tuya"));
  await as(owner, () => db.query("select public.demo_activate_membership($1, 'mensual')", [petId]));
  const mine = await as(owner, () => db.query("select status, plan from public.memberships where pet_id = $1", [petId]));
  assert(mine.rows[0]?.status === "activa" && mine.rows[0].plan === "mensual", JSON.stringify(mine.rows));
  const theirs = await as(other, () => db.query("select * from public.memberships"));
  assert(theirs.rows.length === 0, "otro vio la membresía");
});

console.log("\nDatos de demostración");
await test("un usuario normal no puede firmar como MVZ ni con la bandera de demo", async () => {
  await as(owner, async () => {
    await db.query("select set_config('scanpaw.demo_seed', 'on', false)");
    await db.query(
      "insert into public.conditions (pet_id, kind, description, source, author_name, author_cedula) values ($1, 'alergia', 'Polen', 'vet', 'Falso', '9999999')",
      [petId]);
    await db.query("select set_config('scanpaw.demo_seed', 'off', false)");
  });
  const { rows } = await as(owner, () => db.query("select source, author_cedula from public.conditions where description = 'Polen'"));
  assert(rows[0].source === "propietario" && rows[0].author_cedula === null, JSON.stringify(rows[0]));
});
await test("solo el admin carga los datos de demo y se pueden volver a cargar", async () => {
  await as(owner, () => expectError(db.query("select public.admin_seed_demo()"), "Solo administradores"));
  await as(admin, () => db.query("select public.admin_seed_demo()"));
  const { rows } = await as(admin, () => db.query("select public.admin_seed_demo() as r"));
  const pets = await as(admin, () => db.query("select name from public.pets where microchip like 'DEMO-%' order by name"));
  assert(pets.rows.map((p) => p.name).join(",") === "Luna,Michi", JSON.stringify(pets.rows));
  const vac = await as(admin, () =>
    db.query("select count(*)::int as n from public.vaccinations where pet_id = $1 and source = 'vet'", [rows[0].r.luna]));
  assert(vac.rows[0].n === 2, `vacunas firmadas por MVZ: ${vac.rows[0].n}`);
  const pub = await as(null, () => db.query("select pet_name from public.get_public_pet($1)", [rows[0].r.luna_tag]));
  assert(pub.rows[0].pet_name === "Luna", "la placa demo no funciona");
  await as(admin, () => db.query("select public.admin_reset_demo()"));
  const after = await as(admin, () => db.query("select count(*)::int as n from public.pets where microchip like 'DEMO-%'"));
  assert(after.rows[0].n === 0, "no se borraron las mascotas demo");
});

console.log("\nEndurecimiento");
await test("la foto debe estar en la carpeta de la propia mascota", () =>
  as(owner, () =>
    expectError(
      db.query("update public.pets set photo_path = $2 where id = $1", [petId, `${crypto.randomUUID()}/robada.jpg`]),
      "pets_photo_path_own_folder",
    )));
await test("un anexo no puede apuntar a archivos de otra mascota", () =>
  as(owner, () =>
    expectError(
      db.query(
        "insert into public.attachments (pet_id, kind, title, storage_path, mime_type, size_bytes, source) values ($1, 'otro', 'x', $2, 'application/pdf', 10, 'propietario')",
        [petId, `${crypto.randomUUID()}/ajeno.pdf`],
      ),
      "attachments_path_own_folder",
    )));
await test("el teléfono solo admite dígitos", () =>
  as(owner, () =>
    expectError(db.query("update public.profiles set phone = 'javascript:alert(1)' where id = $1", [owner]), "profiles_phone_format")));
await test("una cita cerrada no se puede reabrir ni volver a cerrar", async () => {
  await as(vet, () => expectError(db.query("select public.set_appointment_status($1, 'completada')", [appointmentId]), "ya fue"));
  await as(vet, () => expectError(db.query("select public.set_appointment_status($1, 'programada')", [appointmentId]), "ya fue"));
});
await test("cancelar una cita recorta el acceso que se extendió por ella", async () => {
  const at = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString();
  const { rows } = await as(vet2, () =>
    db.query("select public.schedule_appointment($1, $2, 'Control') as id", [petId, at]));
  await as(owner, () => db.query("select public.set_appointment_status($1, 'cancelada')", [rows[0].id]));
  const acc = await db.query(
    "select max(expires_at) as until from public.vet_access where pet_id = $1 and vet_id = $2", [petId, vet2]);
  assert(new Date(acc.rows[0].until) < new Date(Date.now() + 8 * 24 * 3600 * 1000), "el acceso siguió extendido");
});
await test("el dueño retira el acceso de un MVZ y se cancelan sus citas", async () => {
  const at = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  const { rows } = await as(vet, () => db.query("select public.schedule_appointment($1, $2, 'Vacuna') as id", [petId, at]));
  await as(other, () => expectError(db.query("select public.owner_revoke_access($1, $2)", [petId, vet]), "no es tuya"));
  await as(owner, () => db.query("select public.owner_revoke_access($1, $2)", [petId, vet]));
  const seen = await as(vet, () => db.query("select id from public.pets where id = $1", [petId]));
  assert(seen.rows.length === 0, "el MVZ siguió viendo el expediente");
  const appt = await db.query("select status from public.appointments where id = $1", [rows[0].id]);
  assert(appt.rows[0].status === "cancelada", appt.rows[0].status);
  await as(owner, () => expectError(db.query("select public.owner_revoke_access($1, $2)", [petId, vet]), "ya no está vigente"));
});
await test("una mascota fallecida no puede quedar en modo extraviado", () =>
  as(owner, () =>
    expectError(
      db.query("update public.pets set status = 'fallecido', lost_mode = true where id = $1", [petId]),
      "pets_lost_only_if_alive",
    )));

console.log("\nNotificaciones push");
await test("cada usuario registra y ve solo sus dispositivos", async () => {
  await as(owner, () =>
    db.query("insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/a', 'k', 'x')"));
  const mine = await as(owner, () => db.query("select user_id from public.push_subscriptions"));
  assert(mine.rows.length === 1 && mine.rows[0].user_id === owner, JSON.stringify(mine.rows));
  const theirs = await as(other, () => db.query("select id from public.push_subscriptions"));
  assert(theirs.rows.length === 0, "otro usuario vio dispositivos ajenos");
});
await test("no se puede registrar un dispositivo a nombre de otro", () =>
  as(other, () =>
    expectError(
      db.query("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/b', 'k', 'x')", [owner]),
      "row-level security",
    )));
await test("solo se aceptan endpoints https y anónimo no tiene acceso", async () => {
  await as(owner, () =>
    expectError(db.query("insert into public.push_subscriptions (endpoint, p256dh, auth) values ('http://inseguro', 'k', 'x')"), "check constraint"));
  await as(null, () => expectError(db.query("select * from public.push_subscriptions"), "permission denied"));
});

console.log("\nRevocación de placa");
await test("al revocar la placa, la vista pública ya no muestra datos", async () => {
  await as(owner, () => db.query("select public.revoke_tag($1)", [tag.id]));
  const { rows } = await as(null, () => db.query("select * from public.get_public_pet($1)", [tag.public_token]));
  assert(rows[0].tag_status === "revocada" && rows[0].pet_name === null, JSON.stringify(rows[0]));
});

console.log(`\n${passed} pruebas correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
