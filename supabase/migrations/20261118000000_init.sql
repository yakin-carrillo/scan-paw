-- =====================================================================
-- Scan-Paw · Hito 1 · Esquema inicial
-- Seguridad: toda la autorización vive en RLS y en funciones SECURITY
-- DEFINER. El rol anónimo NUNCA lee tablas directamente.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.user_role as enum ('owner', 'vet', 'student', 'admin');
create type public.verification_status as enum ('pending', 'approved', 'rejected');
create type public.species as enum ('perro', 'gato');
create type public.pet_sex as enum ('macho', 'hembra');
create type public.pet_status as enum ('activo', 'fallecido');
create type public.owner_role as enum ('principal', 'copropietario');
create type public.tag_status as enum ('sin_asignar', 'activa', 'revocada');
create type public.condition_kind as enum ('alergia', 'cronica');
create type public.attachment_kind as enum ('estudio', 'receta', 'otro');
create type public.record_source as enum ('vet', 'propietario');
create type public.access_source as enum ('escaneo', 'codigo');
create type public.scan_kind as enum ('publico', 'vet');

-- ---------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------
-- Código aleatorio sin caracteres ambiguos (sin 0/O, 1/I/L).
create or replace function private.random_code(len int)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  bytes bytea := extensions.gen_random_bytes(len);
  result text := '';
begin
  for i in 0..len - 1 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function private.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'owner',
  full_name text not null default '',
  phone text,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.vet_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  cedula text not null check (cedula ~ '^[0-9]{7,8}$'),
  clinic_name text,
  status public.verification_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
-- No es único a propósito: si dos cuentas declaran la misma cédula,
-- el panel de administración lo marca como sospechoso.
create index vet_profiles_cedula_idx on public.vet_profiles (cedula);

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  species public.species not null,
  breed text,
  sex public.pet_sex,
  birth_date date,
  color text,
  sterilized boolean,
  microchip text,
  photo_path text,
  status public.pet_status not null default 'activo',
  deceased_at date,
  lost_mode boolean not null default false,
  lost_message text check (char_length(lost_message) <= 280),
  show_phone boolean not null default true,
  show_photo boolean not null default false,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger pets_touch before update on public.pets
  for each row execute function private.touch_updated_at();

create table public.pet_owners (
  pet_id uuid not null references public.pets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.owner_role not null default 'principal',
  created_at timestamptz not null default now(),
  primary key (pet_id, user_id)
);
create index pet_owners_user_idx on public.pet_owners (user_id);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique,
  activation_code text not null,
  pet_id uuid references public.pets (id) on delete set null,
  status public.tag_status not null default 'sin_asignar',
  batch text,
  activated_at timestamptz,
  created_at timestamptz not null default now()
);
create index tags_pet_idx on public.tags (pet_id);

create table public.vet_access (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  vet_id uuid not null references public.profiles (id) on delete cascade,
  source public.access_source not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index vet_access_lookup_idx on public.vet_access (pet_id, vet_id, expires_at);
create index vet_access_vet_idx on public.vet_access (vet_id, expires_at);

create table public.share_codes (
  code text primary key,
  pet_id uuid not null references public.pets (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index share_codes_pet_idx on public.share_codes (pet_id);

create table public.scan_events (
  id bigint generated always as identity primary key,
  tag_id uuid not null references public.tags (id) on delete cascade,
  pet_id uuid references public.pets (id) on delete cascade,
  kind public.scan_kind not null,
  viewer_id uuid references public.profiles (id) on delete set null,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
create index scan_events_pet_idx on public.scan_events (pet_id, created_at desc);
create index scan_events_tag_idx on public.scan_events (tag_id, created_at desc);

-- Expediente clínico: entradas inmutables (solo inserción).
-- Una corrección es una nueva fila con amends_id apuntando a la original.
create table public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  vaccine text not null check (char_length(vaccine) between 1 and 120),
  batch_number text,
  applied_on date not null,
  next_due date,
  notes text,
  amends_id uuid references public.vaccinations (id),
  source public.record_source not null,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text,
  author_cedula text,
  created_at timestamptz not null default now()
);
create index vaccinations_pet_idx on public.vaccinations (pet_id, applied_on desc);

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  kind public.condition_kind not null,
  description text not null check (char_length(description) between 1 and 500),
  severity text check (severity in ('leve', 'moderada', 'grave')),
  active boolean not null default true,
  notes text,
  amends_id uuid references public.conditions (id),
  source public.record_source not null,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text,
  author_cedula text,
  created_at timestamptz not null default now()
);
create index conditions_pet_idx on public.conditions (pet_id, created_at desc);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  kind public.attachment_kind not null,
  title text not null check (char_length(title) between 1 and 120),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  notes text,
  amends_id uuid references public.attachments (id),
  source public.record_source not null,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text,
  author_cedula text,
  created_at timestamptz not null default now()
);
create index attachments_pet_idx on public.attachments (pet_id, created_at desc);

-- ---------------------------------------------------------------------
-- Funciones de autorización (esquema privado, no expuesto por la API)
-- ---------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function private.is_verified_vet()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.vet_profiles v
    join public.profiles p on p.id = v.user_id
    where v.user_id = auth.uid() and p.role = 'vet' and v.status = 'approved'
  );
$$;

create or replace function private.is_pet_owner(p_pet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pet_owners where pet_id = p_pet and user_id = auth.uid());
$$;

create or replace function private.has_vet_access(p_pet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_verified_vet() and exists (
    select 1 from public.vet_access
    where pet_id = p_pet and vet_id = auth.uid() and expires_at > now()
  );
$$;

-- El administrador NO lee expedientes: solo gestiona cuentas y placas.
create or replace function private.can_read_pet(p_pet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_pet_owner(p_pet) or private.has_vet_access(p_pet);
$$;

create or replace function private.can_see_profile(p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    p_target = auth.uid()
    or private.is_admin()
    -- copropietarios entre sí
    or exists (
      select 1 from public.pet_owners a
      join public.pet_owners b on a.pet_id = b.pet_id
      where a.user_id = auth.uid() and b.user_id = p_target
    )
    -- MVZ con acceso vigente ve a los dueños de esa mascota
    or exists (
      select 1 from public.pet_owners po
      where po.user_id = p_target and private.has_vet_access(po.pet_id)
    )
    -- el dueño ve a los MVZ que han accedido a sus mascotas
    or exists (
      select 1 from public.vet_access va
      join public.pet_owners po on po.pet_id = va.pet_id
      where va.vet_id = p_target and po.user_id = auth.uid()
    );
$$;

grant execute on all functions in schema private to anon, authenticated;

-- ---------------------------------------------------------------------
-- Alta automática de perfil al registrarse
-- ---------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role public.user_role;
begin
  -- Nunca se acepta 'admin' desde los metadatos del registro.
  v_role := case when meta ->> 'role' = 'vet' then 'vet'::public.user_role
                 else 'owner'::public.user_role end;

  insert into public.profiles (id, role, full_name, phone, privacy_accepted_at)
  values (
    new.id,
    v_role,
    left(coalesce(meta ->> 'full_name', ''), 120),
    left(meta ->> 'phone', 20),
    case when meta ->> 'privacy_accepted' = 'true' then now() end
  );

  if v_role = 'vet' then
    insert into public.vet_profiles (user_id, cedula, clinic_name)
    values (new.id, coalesce(meta ->> 'cedula', ''), left(meta ->> 'clinic_name', 120));
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- El creador de una mascota queda como propietario principal.
create or replace function private.add_principal_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pet_owners (pet_id, user_id, role) values (new.id, new.created_by, 'principal');
  return new;
end;
$$;

create trigger pets_add_owner
  after insert on public.pets
  for each row execute function private.add_principal_owner();

-- Autoría de entradas clínicas: la decide la base de datos, no el cliente.
create or replace function private.set_clinical_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_cedula text;
  v_ok boolean;
begin
  if private.has_vet_access(new.pet_id) then
    new.source := 'vet';
    select p.full_name, v.cedula into v_name, v_cedula
    from public.profiles p join public.vet_profiles v on v.user_id = p.id
    where p.id = auth.uid();
  elsif private.is_pet_owner(new.pet_id) then
    new.source := 'propietario';
    select p.full_name into v_name from public.profiles p where p.id = auth.uid();
    v_cedula := null;
  else
    raise exception 'Sin permiso para registrar en este expediente' using errcode = '42501';
  end if;

  if new.amends_id is not null then
    execute format('select exists (select 1 from %I.%I where id = $1 and pet_id = $2)',
                   tg_table_schema, tg_table_name)
      into v_ok using new.amends_id, new.pet_id;
    if not v_ok then
      raise exception 'La entrada a corregir no pertenece a esta mascota';
    end if;
  end if;

  new.author_id := auth.uid();
  new.author_name := v_name;
  new.author_cedula := v_cedula;
  new.created_at := now();
  return new;
end;
$$;

create trigger vaccinations_author before insert on public.vaccinations
  for each row execute function private.set_clinical_author();
create trigger conditions_author before insert on public.conditions
  for each row execute function private.set_clinical_author();
create trigger attachments_author before insert on public.attachments
  for each row execute function private.set_clinical_author();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vet_profiles enable row level security;
alter table public.pets enable row level security;
alter table public.pet_owners enable row level security;
alter table public.tags enable row level security;
alter table public.vet_access enable row level security;
alter table public.share_codes enable row level security;
alter table public.scan_events enable row level security;
alter table public.vaccinations enable row level security;
alter table public.conditions enable row level security;
alter table public.attachments enable row level security;

-- El rol anónimo no toca ninguna tabla.
revoke all on all tables in schema public from anon;

-- profiles: solo se pueden editar nombre y teléfono (nunca el rol).
create policy profiles_select on public.profiles for select to authenticated
  using (private.can_see_profile(id));
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- vet_profiles: lectura propia/relacionada; la revisión la hace el admin vía RPC.
create policy vet_profiles_select on public.vet_profiles for select to authenticated
  using (private.can_see_profile(user_id));
revoke insert, update, delete on public.vet_profiles from authenticated;

-- pets
create policy pets_select on public.pets for select to authenticated
  using (created_by = auth.uid() or private.can_read_pet(id));
create policy pets_insert on public.pets for insert to authenticated
  with check (created_by = auth.uid());
create policy pets_update on public.pets for update to authenticated
  using (private.is_pet_owner(id)) with check (private.is_pet_owner(id));
revoke update, delete on public.pets from authenticated;
grant update (name, species, breed, sex, birth_date, color, sterilized, microchip,
              photo_path, status, deceased_at, lost_mode, lost_message,
              show_phone, show_photo)
  on public.pets to authenticated;

-- pet_owners: solo lectura; los cambios pasan por funciones.
create policy pet_owners_select on public.pet_owners for select to authenticated
  using (private.can_read_pet(pet_id));
revoke insert, update, delete on public.pet_owners from authenticated;

-- tags: el dueño ve las placas de sus mascotas; el admin ve todas.
create policy tags_select on public.tags for select to authenticated
  using (private.is_admin() or (pet_id is not null and private.is_pet_owner(pet_id)));
revoke insert, update, delete on public.tags from authenticated;

-- vet_access: el MVZ ve sus accesos; el dueño ve quién accedió.
create policy vet_access_select on public.vet_access for select to authenticated
  using (vet_id = auth.uid() or private.is_pet_owner(pet_id));
revoke insert, update, delete on public.vet_access from authenticated;

create policy share_codes_select on public.share_codes for select to authenticated
  using (private.is_pet_owner(pet_id));
revoke insert, update, delete on public.share_codes from authenticated;

create policy scan_events_select on public.scan_events for select to authenticated
  using (pet_id is not null and private.is_pet_owner(pet_id));
revoke insert, update, delete on public.scan_events from authenticated;

-- Expediente: lectura para quien puede ver la mascota; solo inserción.
create policy vaccinations_select on public.vaccinations for select to authenticated
  using (private.can_read_pet(pet_id));
create policy vaccinations_insert on public.vaccinations for insert to authenticated
  with check (private.is_pet_owner(pet_id) or private.has_vet_access(pet_id));
revoke update, delete on public.vaccinations from authenticated;

create policy conditions_select on public.conditions for select to authenticated
  using (private.can_read_pet(pet_id));
create policy conditions_insert on public.conditions for insert to authenticated
  with check (private.is_pet_owner(pet_id) or private.has_vet_access(pet_id));
revoke update, delete on public.conditions from authenticated;

create policy attachments_select on public.attachments for select to authenticated
  using (private.can_read_pet(pet_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (private.is_pet_owner(pet_id) or private.has_vet_access(pet_id));
revoke update, delete on public.attachments from authenticated;

-- ---------------------------------------------------------------------
-- RPC públicas
-- ---------------------------------------------------------------------

-- Vista pública de una placa: solo lo que el dueño decidió mostrar.
create or replace function public.get_public_pet(p_token text)
returns table (
  tag_status public.tag_status,
  pet_name text,
  species public.species,
  pet_status public.pet_status,
  owner_first_name text,
  contact_phone text,
  lost_mode boolean,
  lost_message text,
  photo_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.status,
    p.name,
    p.species,
    p.status,
    split_part(pr.full_name, ' ', 1),
    case when p.show_phone then pr.phone end,
    coalesce(p.lost_mode, false),
    case when p.lost_mode then p.lost_message end,
    case when p.show_photo then p.photo_path end
  from public.tags t
  left join public.pets p on p.id = t.pet_id and t.status = 'activa'
  left join public.pet_owners po on po.pet_id = p.id and po.role = 'principal'
  left join public.profiles pr on pr.id = po.user_id
  where t.public_token = upper(trim(p_token))
  limit 1;
$$;

-- Activar una placa nueva y ligarla a una mascota propia.
create or replace function public.activate_tag(p_token text, p_code text, p_pet uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag public.tags;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para activar la placa' using errcode = '42501';
  end if;
  if not private.is_pet_owner(p_pet) then
    raise exception 'Esta mascota no es tuya' using errcode = '42501';
  end if;

  select * into v_tag from public.tags
  where public_token = upper(trim(p_token)) for update;

  if v_tag.id is null or v_tag.status <> 'sin_asignar'
     or v_tag.activation_code <> upper(trim(p_code)) then
    raise exception 'Placa o código de activación no válidos';
  end if;

  -- Una sola placa activa por mascota: la anterior queda revocada.
  update public.tags set status = 'revocada'
  where pet_id = p_pet and status = 'activa';

  update public.tags
  set pet_id = p_pet, status = 'activa', activated_at = now()
  where id = v_tag.id;
end;
$$;

create or replace function public.revoke_tag(p_tag uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.tags set status = 'revocada'
  where id = p_tag and status = 'activa' and private.is_pet_owner(pet_id);
  if not found then
    raise exception 'No se pudo revocar la placa';
  end if;
end;
$$;

-- MVZ verificado escanea la placa → acceso al expediente por 7 días.
create or replace function public.vet_open_pet(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tag uuid;
  v_pet uuid;
begin
  if not private.is_verified_vet() then
    raise exception 'Solo médicos veterinarios verificados' using errcode = '42501';
  end if;

  select t.id, t.pet_id into v_tag, v_pet
  from public.tags t
  where t.public_token = upper(trim(p_token)) and t.status = 'activa';

  if v_pet is null then
    raise exception 'Placa no válida';
  end if;

  insert into public.vet_access (pet_id, vet_id, source, expires_at)
  values (v_pet, auth.uid(), 'escaneo', now() + interval '7 days');

  insert into public.scan_events (tag_id, pet_id, kind, viewer_id)
  values (v_tag, v_pet, 'vet', auth.uid());

  return v_pet;
end;
$$;

-- El dueño genera un código temporal (24 h, un solo uso) para un MVZ.
create or replace function public.create_share_code(p_pet uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not private.is_pet_owner(p_pet) then
    raise exception 'Esta mascota no es tuya' using errcode = '42501';
  end if;
  loop
    v_code := private.random_code(6);
    begin
      insert into public.share_codes (code, pet_id, created_by, expires_at)
      values (v_code, p_pet, auth.uid(), now() + interval '24 hours');
      exit;
    exception when unique_violation then
      -- colisión improbable: se genera otro
    end;
  end loop;
  return v_code;
end;
$$;

create or replace function public.redeem_share_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.share_codes;
begin
  if not private.is_verified_vet() then
    raise exception 'Solo médicos veterinarios verificados' using errcode = '42501';
  end if;

  update public.share_codes
  set used_by = auth.uid(), used_at = now()
  where code = upper(trim(p_code)) and used_at is null and expires_at > now()
  returning * into v_row;

  if v_row.code is null then
    raise exception 'Código no válido o vencido';
  end if;

  insert into public.vet_access (pet_id, vet_id, source, expires_at)
  values (v_row.pet_id, auth.uid(), 'codigo', now() + interval '7 days');

  return v_row.pet_id;
end;
$$;

-- Administración: generar lotes de placas sin asignar.
create or replace function public.admin_generate_tags(p_count int, p_batch text)
returns setof public.tags
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_made int := 0;
  v_row public.tags;
begin
  if not private.is_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  if p_count < 1 or p_count > 500 then
    raise exception 'Se pueden generar entre 1 y 500 placas por lote';
  end if;

  while v_made < p_count loop
    insert into public.tags (public_token, activation_code, batch)
    values (private.random_code(10), private.random_code(8), nullif(trim(p_batch), ''))
    on conflict (public_token) do nothing
    returning * into v_row;
    if found then
      v_made := v_made + 1;
      return next v_row;
    end if;
  end loop;
end;
$$;

-- Administración: aprobar o rechazar a un MVZ.
create or replace function public.admin_review_vet(
  p_user uuid,
  p_status public.verification_status,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  update public.vet_profiles
  set status = p_status,
      review_note = nullif(trim(p_note), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where user_id = p_user;
end;
$$;

-- Permisos de ejecución: por defecto Postgres concede EXECUTE a PUBLIC.
revoke execute on function public.get_public_pet(text) from public;
revoke execute on function public.activate_tag(text, text, uuid) from public, anon;
revoke execute on function public.revoke_tag(uuid) from public, anon;
revoke execute on function public.vet_open_pet(text) from public, anon;
revoke execute on function public.create_share_code(uuid) from public, anon;
revoke execute on function public.redeem_share_code(text) from public, anon;
revoke execute on function public.admin_generate_tags(int, text) from public, anon;
revoke execute on function public.admin_review_vet(uuid, public.verification_status, text) from public, anon;

grant execute on function public.get_public_pet(text) to anon, authenticated;
grant execute on function public.activate_tag(text, text, uuid) to authenticated;
grant execute on function public.revoke_tag(uuid) to authenticated;
grant execute on function public.vet_open_pet(text) to authenticated;
grant execute on function public.create_share_code(uuid) to authenticated;
grant execute on function public.redeem_share_code(text) to authenticated;
grant execute on function public.admin_generate_tags(int, text) to authenticated;
grant execute on function public.admin_review_vet(uuid, public.verification_status, text) to authenticated;

-- ---------------------------------------------------------------------
-- Storage: buckets privados. Ruta = "<pet_id>/<archivo>"
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pet-photos', 'pet-photos', false, 2097152,
   array['image/jpeg', 'image/png', 'image/webp']),
  ('attachments', 'attachments', false, 5242880,
   array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy pet_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'pet-photos'
         and private.can_read_pet(private.try_uuid((storage.foldername(name))[1])));
create policy pet_photos_write on storage.objects for insert to authenticated
  with check (bucket_id = 'pet-photos'
              and private.is_pet_owner(private.try_uuid((storage.foldername(name))[1])));
create policy pet_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'pet-photos'
         and private.is_pet_owner(private.try_uuid((storage.foldername(name))[1])));

create policy attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments'
         and private.can_read_pet(private.try_uuid((storage.foldername(name))[1])));
create policy attachments_write on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments'
              and (private.is_pet_owner(private.try_uuid((storage.foldername(name))[1]))
                   or private.has_vet_access(private.try_uuid((storage.foldername(name))[1]))));
