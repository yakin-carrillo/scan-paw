-- =====================================================================
-- Scan-Paw · Espacios por rol
--   1. Clínicas: registro, verificación, equipo e invitaciones.
--   2. Plan de negocio para clínicas (modo demostración, sin cobro).
--   3. Citas gestionadas por la clínica y agenda centralizada.
--   4. Consultas y registro de peso en el expediente.
--   5. Perfil profesional agregado después del registro.
-- El administrador de una clínica gestiona citas y equipo, pero NO lee
-- expedientes: para eso necesita, como cualquiera, acceso clínico vigente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Clínicas
-- ---------------------------------------------------------------------
create type public.clinic_status as enum ('pendiente', 'verificada', 'rechazada');
create type public.clinic_role as enum ('admin', 'clinico');
create type public.member_status as enum ('pendiente', 'activo', 'baja');

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  address text check (char_length(address) <= 200),
  phone text check (phone ~ '^\+?[0-9]{10,15}$'),
  rfc text check (rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  status public.clinic_status not null default 'pendiente',
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  plan_status text not null default 'sin_plan' check (plan_status in ('sin_plan', 'activa', 'cancelada')),
  plan_until timestamptz,
  calendar_token text not null unique default private.random_code(32),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clinics_touch before update on public.clinics
  for each row execute function private.touch_updated_at();

create table public.clinic_members (
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.clinic_role not null default 'clinico',
  status public.member_status not null default 'pendiente',
  calendar_token text not null unique default private.random_code(32),
  joined_at timestamptz not null default now(),
  validated_by uuid references public.profiles (id) on delete set null,
  validated_at timestamptz,
  primary key (clinic_id, user_id)
);
-- Una persona pertenece a lo más a una clínica a la vez.
create unique index clinic_members_one_clinic on public.clinic_members (user_id) where status <> 'baja';
create index clinic_members_validated_idx on public.clinic_members (validated_by);

create table public.clinic_invites (
  code text primary key,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null,
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index clinic_invites_clinic_idx on public.clinic_invites (clinic_id, created_at desc);

-- Qué clínica validó a un MVZ o estudiante (en lugar del administrador de la plataforma).
alter table public.vet_profiles add column validated_by_clinic uuid references public.clinics (id) on delete set null;
alter table public.student_profiles add column validated_by_clinic uuid references public.clinics (id) on delete set null;

create or replace function private.is_clinic_member(p_clinic uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clinic_members
    where clinic_id = p_clinic and user_id = auth.uid() and status = 'activo'
  );
$$;

create or replace function private.is_clinic_admin(p_clinic uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clinic_members
    where clinic_id = p_clinic and user_id = auth.uid() and status = 'activo' and role = 'admin'
  );
$$;

-- Verificada y con plan vigente: sin esto, las funciones de clínica se rechazan.
create or replace function private.clinic_operational(p_clinic uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.clinics
    where id = p_clinic and status = 'verificada'
      and plan_status in ('activa', 'cancelada') and plan_until > now()
  );
$$;

create or replace function private.require_clinic_admin(p_clinic uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_clinic_admin(p_clinic) then
    raise exception 'Solo el administrador de la clínica' using errcode = '42501';
  end if;
  if not private.clinic_operational(p_clinic) then
    raise exception 'La clínica necesita estar verificada y con el plan activo' using errcode = '42501';
  end if;
end;
$$;

-- Clínico verificado (MVZ o estudiante) dado un id, no solo el usuario actual.
create or replace function private.user_is_verified_clinician(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    left join public.vet_profiles v on v.user_id = p.id
    left join public.student_profiles s on s.user_id = p.id
    where p.id = p_user
      and ((p.role = 'vet' and v.status = 'approved') or (p.role = 'student' and s.status = 'approved'))
  );
$$;

create or replace function private.active_clinic_of(p_user uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select clinic_id from public.clinic_members where user_id = p_user and status = 'activo' limit 1;
$$;

-- Los miembros de una clínica pueden ver el perfil (nombre, teléfono, cédula) de sus compañeros.
create or replace function private.can_see_profile(p_target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select
    p_target = auth.uid()
    or private.is_admin()
    or exists (
      select 1 from public.pet_owners a
      join public.pet_owners b on a.pet_id = b.pet_id
      where a.user_id = auth.uid() and b.user_id = p_target
    )
    or exists (
      select 1 from public.pet_owners po
      where po.user_id = p_target and private.has_vet_access(po.pet_id)
    )
    or exists (
      select 1 from public.vet_access va
      join public.pet_owners po on po.pet_id = va.pet_id
      where va.vet_id = p_target and po.user_id = auth.uid()
    )
    or exists (
      select 1 from public.clinic_members me
      join public.clinic_members them on them.clinic_id = me.clinic_id
      where me.user_id = auth.uid() and me.status = 'activo'
        and them.user_id = p_target and them.status <> 'baja'
    );
$$;

alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.clinic_invites enable row level security;

create policy clinics_select on public.clinics for select to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.clinic_members m
      where m.clinic_id = clinics.id and m.user_id = (select auth.uid()) and m.status <> 'baja'
    )
  );
create policy clinic_members_select on public.clinic_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_clinic_member(clinic_id) or private.is_admin());
create policy clinic_invites_select on public.clinic_invites for select to authenticated
  using (private.is_clinic_admin(clinic_id));

revoke all on public.clinics, public.clinic_members, public.clinic_invites from anon;
revoke insert, update, delete on public.clinics, public.clinic_members, public.clinic_invites from authenticated;
-- El enlace secreto del calendario solo lo lee el administrador, con su propia función.
revoke select on public.clinics, public.clinic_members from authenticated;
grant select (id, name, address, phone, rfc, status, review_note, reviewed_by, reviewed_at, plan_status,
  plan_until, created_by, created_at, updated_at) on public.clinics to authenticated;
grant select (clinic_id, user_id, role, status, joined_at, validated_by, validated_at)
  on public.clinic_members to authenticated;

create or replace function public.create_clinic(p_name text, p_address text, p_phone text, p_rfc text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and privacy_accepted_at is not null
  ) then
    raise exception 'Completa tu registro primero' using errcode = '42501';
  end if;
  if exists (select 1 from public.clinic_members where user_id = auth.uid() and status <> 'baja') then
    raise exception 'Ya perteneces a una clínica';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'Escribe el nombre de la clínica';
  end if;

  insert into public.clinics (name, address, phone, rfc, created_by)
  values (
    left(trim(p_name), 120),
    nullif(left(trim(coalesce(p_address, '')), 200), ''),
    nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g'), ''),
    nullif(upper(trim(coalesce(p_rfc, ''))), ''),
    auth.uid()
  )
  returning id into v_id;

  insert into public.clinic_members (clinic_id, user_id, role, status, validated_by, validated_at)
  values (v_id, auth.uid(), 'admin', 'activo', auth.uid(), now());
  return v_id;
end;
$$;

create or replace function public.admin_review_clinic(p_clinic uuid, p_status public.clinic_status, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  update public.clinics
  set status = p_status, review_note = nullif(trim(p_note), ''), reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_clinic;
end;
$$;

-- Código de invitación de 8 caracteres, válido 7 días y de un solo uso.
create or replace function public.clinic_create_invite(p_clinic uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  perform private.require_clinic_admin(p_clinic);
  v_code := private.random_code(8);
  insert into public.clinic_invites (code, clinic_id, created_by, expires_at)
  values (v_code, p_clinic, auth.uid(), now() + interval '7 days');
  return v_code;
end;
$$;

-- El MVZ o estudiante canjea el código; queda pendiente hasta que la clínica lo valide.
create or replace function public.clinic_join(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.clinic_invites;
  v_role public.user_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('vet', 'student') then
    raise exception 'Solo médicos veterinarios y estudiantes pueden unirse a una clínica' using errcode = '42501';
  end if;
  if exists (select 1 from public.clinic_members where user_id = auth.uid() and status <> 'baja') then
    raise exception 'Ya perteneces a una clínica';
  end if;
  perform private.check_attempts('unirse_clinica');

  select * into v_inv from public.clinic_invites
  where code = upper(trim(p_code)) for update;
  if v_inv.code is null or v_inv.used_at is not null or v_inv.expires_at < now()
     or not private.clinic_operational(v_inv.clinic_id) then
    perform private.record_failure('unirse_clinica');
    return null;
  end if;

  update public.clinic_invites set used_by = auth.uid(), used_at = now() where code = v_inv.code;
  delete from public.clinic_members where clinic_id = v_inv.clinic_id and user_id = auth.uid();
  insert into public.clinic_members (clinic_id, user_id, role, status)
  values (v_inv.clinic_id, auth.uid(), 'clinico', 'pendiente');
  return v_inv.clinic_id;
end;
$$;

-- La clínica valida (o rechaza) a quien se unió. Validar también verifica su
-- cédula o matrícula para toda la red, con la clínica como responsable.
create or replace function public.clinic_review_member(p_clinic uuid, p_user uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.clinic_members;
  v_clinic_name text;
begin
  perform private.require_clinic_admin(p_clinic);
  if p_user = auth.uid() then
    raise exception 'No puedes validarte a ti mismo';
  end if;
  select * into v_member from public.clinic_members
  where clinic_id = p_clinic and user_id = p_user for update;
  if v_member.user_id is null or v_member.status <> 'pendiente' then
    raise exception 'No hay una solicitud pendiente de esta persona';
  end if;
  if p_approve and (select count(*) from public.clinic_members
                    where clinic_id = p_clinic and status = 'activo') >= 10 then
    raise exception 'El plan incluye hasta 10 miembros activos';
  end if;

  if not p_approve then
    update public.clinic_members set status = 'baja' where clinic_id = p_clinic and user_id = p_user;
    return;
  end if;

  select name into v_clinic_name from public.clinics where id = p_clinic;
  update public.clinic_members
  set status = 'activo', validated_by = auth.uid(), validated_at = now()
  where clinic_id = p_clinic and user_id = p_user;

  update public.vet_profiles
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      validated_by_clinic = p_clinic, review_note = 'Validado por ' || v_clinic_name
  where user_id = p_user and status <> 'approved';
  update public.student_profiles
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      validated_by_clinic = p_clinic, review_note = 'Validado por ' || v_clinic_name
  where user_id = p_user and status <> 'approved';
end;
$$;

create or replace function public.clinic_remove_member(p_clinic uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_clinic_admin(p_clinic) then
    raise exception 'Solo el administrador de la clínica' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'No puedes darte de baja a ti mismo';
  end if;
  update public.clinic_members set status = 'baja' where clinic_id = p_clinic and user_id = p_user;
  -- Sus citas futuras quedan en la agenda de la clínica, sin asignar.
  update public.appointments set clinician_id = null, clinician_name = null
  where clinic_id = p_clinic and clinician_id = p_user and status = 'programada' and scheduled_at > now();
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Plan de negocio (demostración: no hay cobro real)
-- ---------------------------------------------------------------------
create or replace function public.demo_activate_clinic_plan(p_clinic uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_clinic_admin(p_clinic) then
    raise exception 'Solo el administrador de la clínica' using errcode = '42501';
  end if;
  update public.clinics
  set plan_status = 'activa', plan_until = greatest(coalesce(plan_until, now()), now()) + interval '30 days'
  where id = p_clinic;
end;
$$;

-- Al cancelar, el plan sigue vigente hasta el fin del periodo pagado.
create or replace function public.cancel_clinic_plan(p_clinic uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_clinic_admin(p_clinic) then
    raise exception 'Solo el administrador de la clínica' using errcode = '42501';
  end if;
  update public.clinics set plan_status = 'cancelada' where id = p_clinic and plan_status = 'activa';
end;
$$;

-- Enlaces secretos para suscribirse al calendario (Google, Apple).
create or replace function public.my_calendar_links()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'member', (select m.calendar_token from public.clinic_members m
               where m.user_id = auth.uid() and m.status = 'activo' limit 1),
    'clinic', (select c.calendar_token from public.clinics c
               join public.clinic_members m on m.clinic_id = c.id
               where m.user_id = auth.uid() and m.status = 'activo' and m.role = 'admin' limit 1)
  );
$$;

create or replace function public.rotate_calendar_links()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clinic_members set calendar_token = private.random_code(32)
  where user_id = auth.uid() and status = 'activo';
  update public.clinics c set calendar_token = private.random_code(32)
  where private.is_clinic_admin(c.id);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Citas de la clínica
-- ---------------------------------------------------------------------
alter table public.appointments add column clinic_id uuid references public.clinics (id) on delete set null;
alter table public.appointments add column created_by uuid references public.profiles (id) on delete set null;
create index appointments_clinic_idx on public.appointments (clinic_id, scheduled_at);
create index appointments_created_by_idx on public.appointments (created_by);

drop policy appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to authenticated
  using (
    clinician_id = (select auth.uid())
    or private.is_pet_owner(pet_id)
    or (clinic_id is not null and private.is_clinic_admin(clinic_id))
  );

-- Extiende el acceso del clínico asignado hasta el día siguiente a la cita.
create or replace function private.extend_access_for_appointment(p_pet uuid, p_clinician uuid, p_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_until timestamptz;
begin
  select max(expires_at) into v_until from public.vet_access where pet_id = p_pet and vet_id = p_clinician;
  if v_until is null or v_until < p_at + interval '1 day' then
    insert into public.vet_access (pet_id, vet_id, source, expires_at)
    values (p_pet, p_clinician, 'cita', p_at + interval '1 day');
  end if;
end;
$$;

-- Recorta el acceso que dio una cita cuando ya no queda ninguna programada.
create or replace function private.trim_appointment_access(p_pet uuid, p_clinician uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_until timestamptz;
begin
  select max(scheduled_at) + interval '1 day' into v_until
  from public.appointments
  where pet_id = p_pet and clinician_id = p_clinician and status = 'programada';
  update public.vet_access
  set expires_at = least(expires_at, coalesce(v_until, now()))
  where pet_id = p_pet and vet_id = p_clinician and source = 'cita' and expires_at > now();
end;
$$;

create or replace function private.validate_appointment(p_at timestamptz, p_reason text)
returns void language plpgsql stable set search_path = '' as $$
begin
  if p_at < now() - interval '1 hour' or p_at > now() + interval '180 days' then
    raise exception 'La cita debe ser en los próximos 6 meses';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Escribe el motivo de la cita';
  end if;
end;
$$;

-- El clínico agenda: la cita queda ligada a su clínica, si pertenece a una.
create or replace function public.schedule_appointment(p_pet uuid, p_at timestamptz, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_pet_name text;
  v_name text;
  v_clinic uuid;
  v_clinic_name text;
begin
  if not private.has_vet_access(p_pet) then
    raise exception 'Necesitas acceso vigente al expediente para agendar' using errcode = '42501';
  end if;
  perform private.validate_appointment(p_at, p_reason);

  select name into v_pet_name from public.pets where id = p_pet;
  v_clinic := private.active_clinic_of(auth.uid());
  select p.full_name, coalesce(c.name, v.clinic_name) into v_name, v_clinic_name
  from public.profiles p
  left join public.vet_profiles v on v.user_id = p.id
  left join public.clinics c on c.id = v_clinic
  where p.id = auth.uid();

  insert into public.appointments
    (pet_id, clinician_id, pet_name, clinician_name, clinic_name, clinic_id, created_by, scheduled_at, reason)
  values (p_pet, auth.uid(), v_pet_name, v_name, v_clinic_name, v_clinic, auth.uid(), p_at, left(trim(p_reason), 200))
  returning id into v_id;

  perform private.extend_access_for_appointment(p_pet, auth.uid(), p_at);
  return v_id;
end;
$$;

-- La clínica agenda para uno de sus clínicos. Solo pacientes a los que algún
-- miembro del equipo tiene acceso vigente; el clínico asignado obtiene acceso
-- hasta el día siguiente a la cita (el propietario recibe un aviso).
create or replace function public.clinic_schedule_appointment(
  p_clinic uuid, p_clinician uuid, p_pet uuid, p_at timestamptz, p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_clinic_admin(p_clinic);
  perform private.validate_appointment(p_at, p_reason);
  if not exists (
    select 1 from public.clinic_members
    where clinic_id = p_clinic and user_id = p_clinician and status = 'activo'
  ) or not private.user_is_verified_clinician(p_clinician) then
    raise exception 'El clínico debe ser un miembro verificado de la clínica';
  end if;
  if not exists (
    select 1 from public.vet_access a
    join public.clinic_members m on m.user_id = a.vet_id and m.clinic_id = p_clinic and m.status = 'activo'
    where a.pet_id = p_pet and a.expires_at > now()
  ) then
    raise exception 'Ningún miembro de la clínica tiene acceso vigente a este paciente' using errcode = '42501';
  end if;

  insert into public.appointments
    (pet_id, clinician_id, pet_name, clinician_name, clinic_name, clinic_id, created_by, scheduled_at, reason)
  select p_pet, p_clinician, pt.name, pr.full_name, c.name, p_clinic, auth.uid(), p_at, left(trim(p_reason), 200)
  from public.pets pt, public.profiles pr, public.clinics c
  where pt.id = p_pet and pr.id = p_clinician and c.id = p_clinic
  returning id into v_id;

  perform private.extend_access_for_appointment(p_pet, p_clinician, p_at);
  return v_id;
end;
$$;

-- Reagendar o reasignar una cita de la clínica.
create or replace function public.clinic_update_appointment(p_id uuid, p_clinician uuid, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
begin
  select * into v_row from public.appointments where id = p_id for update;
  if v_row.id is null or v_row.clinic_id is null then
    raise exception 'Cita no encontrada';
  end if;
  perform private.require_clinic_admin(v_row.clinic_id);
  if v_row.status <> 'programada' then
    raise exception 'Esta cita ya fue %', v_row.status;
  end if;
  perform private.validate_appointment(p_at, v_row.reason);
  if not exists (
    select 1 from public.clinic_members
    where clinic_id = v_row.clinic_id and user_id = p_clinician and status = 'activo'
  ) or not private.user_is_verified_clinician(p_clinician) then
    raise exception 'El clínico debe ser un miembro verificado de la clínica';
  end if;

  update public.appointments
  set clinician_id = p_clinician,
      clinician_name = (select full_name from public.profiles where id = p_clinician),
      scheduled_at = p_at
  where id = p_id;

  perform private.extend_access_for_appointment(v_row.pet_id, p_clinician, p_at);
  if v_row.clinician_id is not null then
    perform private.trim_appointment_access(v_row.pet_id, v_row.clinician_id);
  end if;
end;
$$;

-- Completar o cancelar: el clínico asignado, la clínica, o el dueño (solo cancelar).
create or replace function public.set_appointment_status(p_id uuid, p_status public.appointment_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
begin
  select * into v_row from public.appointments where id = p_id for update;
  if v_row.id is null then
    raise exception 'Cita no encontrada';
  end if;
  if v_row.clinician_id = auth.uid() then
    null;
  elsif v_row.clinic_id is not null and private.is_clinic_admin(v_row.clinic_id) then
    null;
  elsif private.is_pet_owner(v_row.pet_id) and p_status = 'cancelada' then
    null;
  else
    raise exception 'No puedes modificar esta cita' using errcode = '42501';
  end if;
  if v_row.status <> 'programada' then
    raise exception 'Esta cita ya fue %', v_row.status;
  end if;
  if p_status = 'programada' then
    raise exception 'Estado no válido';
  end if;

  update public.appointments set status = p_status where id = p_id;
  if p_status = 'cancelada' and v_row.clinician_id is not null then
    perform private.trim_appointment_access(v_row.pet_id, v_row.clinician_id);
  end if;
end;
$$;

-- Agenda centralizada: citas de la clínica con el contacto del propietario.
-- No incluye ningún dato del expediente clínico.
create or replace function public.clinic_agenda(p_clinic uuid, p_from timestamptz, p_to timestamptz)
returns table (
  id uuid,
  pet_id uuid,
  pet_name text,
  species public.species,
  clinician_id uuid,
  clinician_name text,
  scheduled_at timestamptz,
  reason text,
  status public.appointment_status,
  owner_name text,
  owner_phone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_clinic_admin(p_clinic);
  if p_to - p_from > interval '62 days' then
    raise exception 'Consulta como máximo dos meses a la vez';
  end if;
  return query
  select a.id, a.pet_id, a.pet_name, pt.species, a.clinician_id, a.clinician_name, a.scheduled_at, a.reason,
         a.status, pr.full_name, pr.phone
  from public.appointments a
  join public.pets pt on pt.id = a.pet_id
  left join lateral (
    select o.user_id from public.pet_owners o where o.pet_id = a.pet_id order by o.role = 'principal' desc limit 1
  ) ow on true
  left join public.profiles pr on pr.id = ow.user_id
  where a.clinic_id = p_clinic and a.scheduled_at >= p_from and a.scheduled_at < p_to
  order by a.scheduled_at;
end;
$$;

-- Pacientes que la clínica puede agendar: con acceso vigente de algún miembro.
create or replace function public.clinic_patients(p_clinic uuid)
returns table (pet_id uuid, pet_name text, species public.species, until timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_clinic_admin(p_clinic);
  return query
  select pt.id, pt.name, pt.species, max(a.expires_at)
  from public.vet_access a
  join public.clinic_members m on m.user_id = a.vet_id and m.clinic_id = p_clinic and m.status = 'activo'
  join public.pets pt on pt.id = a.pet_id
  where a.expires_at > now()
  group by pt.id, pt.name, pt.species
  order by pt.name;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Consultas y peso
-- La consulta solo la registra un clínico con acceso vigente. El propietario
-- la ve completa (es titular de los datos); las indicaciones van aparte, en
-- lenguaje claro.
-- ---------------------------------------------------------------------
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  visit_date date not null default current_date,
  reason text not null check (char_length(reason) between 1 and 200),
  weight_kg numeric(5, 2) check (weight_kg > 0 and weight_kg < 200),
  temperature_c numeric(4, 1) check (temperature_c between 30 and 45),
  findings text check (char_length(findings) <= 2000),
  diagnosis text check (char_length(diagnosis) <= 500),
  treatment text check (char_length(treatment) <= 1000),
  owner_instructions text check (char_length(owner_instructions) <= 1000),
  clinic_name text,
  amends_id uuid references public.consultations (id),
  source public.record_source not null,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text,
  author_cedula text,
  created_at timestamptz not null default now()
);
create index consultations_pet_idx on public.consultations (pet_id, visit_date desc);
create index consultations_amends_idx on public.consultations (amends_id);
create index consultations_author_idx on public.consultations (author_id);

create table public.weights (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 200),
  consultation_id uuid references public.consultations (id) on delete set null,
  amends_id uuid references public.weights (id),
  source public.record_source not null,
  author_id uuid references public.profiles (id) on delete set null,
  author_name text,
  author_cedula text,
  created_at timestamptz not null default now()
);
create index weights_pet_idx on public.weights (pet_id, measured_on desc);
create index weights_amends_idx on public.weights (amends_id);
create index weights_author_idx on public.weights (author_id);
create index weights_consultation_idx on public.weights (consultation_id);

create trigger consultations_author before insert on public.consultations
  for each row execute function private.set_clinical_author();
create trigger weights_author before insert on public.weights
  for each row execute function private.set_clinical_author();

-- La consulta la firma un clínico, nunca el propietario. El nombre de la
-- clínica se toma de la base, no de lo que envíe el formulario.
create or replace function private.consultation_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.source = 'propietario' and current_setting('scanpaw.demo_seed', true) is distinct from 'on' then
    raise exception 'Solo un clínico con acceso vigente registra consultas' using errcode = '42501';
  end if;
  if current_setting('scanpaw.demo_seed', true) is distinct from 'on' then
    select coalesce(c.name, v.clinic_name) into new.clinic_name
    from public.profiles p
    left join public.vet_profiles v on v.user_id = p.id
    left join public.clinics c on c.id = private.active_clinic_of(p.id)
    where p.id = auth.uid();
  end if;
  return new;
end;
$$;
create trigger consultations_guard before insert on public.consultations
  for each row execute function private.consultation_guard();

-- El peso de la consulta también queda en el registro de peso.
create or replace function private.consultation_weight()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.weight_kg is not null then
    insert into public.weights (pet_id, measured_on, weight_kg, consultation_id, source, author_id, author_name, author_cedula)
    values (new.pet_id, new.visit_date, new.weight_kg, new.id, new.source, new.author_id, new.author_name, new.author_cedula);
  end if;
  return null;
end;
$$;
create trigger consultations_weight after insert on public.consultations
  for each row execute function private.consultation_weight();

alter table public.consultations enable row level security;
alter table public.weights enable row level security;
create policy consultations_select on public.consultations for select to authenticated
  using (private.can_read_pet(pet_id));
create policy consultations_insert on public.consultations for insert to authenticated
  with check (private.has_vet_access(pet_id));
create policy weights_select on public.weights for select to authenticated
  using (private.can_read_pet(pet_id));
create policy weights_insert on public.weights for insert to authenticated
  with check (private.is_pet_owner(pet_id) or private.has_vet_access(pet_id));
revoke all on public.consultations, public.weights from anon;
revoke update, delete on public.consultations, public.weights from authenticated;

-- ---------------------------------------------------------------------
-- 5. Perfil profesional después del registro
-- Un propietario puede registrarse después como MVZ o estudiante; queda
-- pendiente de verificación y conserva sus mascotas.
-- ---------------------------------------------------------------------
create or replace function public.add_professional_profile(
  p_role text, p_cedula text, p_clinic text, p_university text, p_enrollment text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.user_role;
begin
  select role into v_current from public.profiles where id = auth.uid();
  if v_current is distinct from 'owner' then
    raise exception 'Tu cuenta ya tiene un perfil profesional o administrativo';
  end if;
  if p_role = 'vet' then
    if coalesce(p_cedula, '') !~ '^[0-9]{7,8}$' then
      raise exception 'La cédula profesional tiene 7 u 8 dígitos';
    end if;
    insert into public.vet_profiles (user_id, cedula, clinic_name)
    values (auth.uid(), p_cedula, nullif(left(trim(coalesce(p_clinic, '')), 120), ''))
    on conflict (user_id) do update set cedula = excluded.cedula, clinic_name = excluded.clinic_name,
      status = 'pending', review_note = null;
  elsif p_role = 'student' then
    if char_length(trim(coalesce(p_university, ''))) < 3 then
      raise exception 'Escribe el nombre de tu universidad';
    end if;
    if coalesce(p_enrollment, '') !~ '^[0-9A-Za-z-]{4,20}$' then
      raise exception 'La matrícula tiene de 4 a 20 letras o números';
    end if;
    insert into public.student_profiles (user_id, university, enrollment_id)
    values (auth.uid(), left(trim(p_university), 120), upper(p_enrollment))
    on conflict (user_id) do update set university = excluded.university, enrollment_id = excluded.enrollment_id,
      status = 'pending', review_note = null;
  else
    raise exception 'Tipo de perfil no válido';
  end if;
  update public.profiles set role = p_role::public.user_role where id = auth.uid();
end;
$$;

-- Datos de demostración: consultas y peso de Luna y Michi (después de admin_seed_demo).
create or replace function public.admin_seed_demo_clinical(p_luna uuid, p_michi uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vet text := 'MVZ Laura Méndez (ejemplo)';
  v_ced text := '00000000';
  v_clinic text := 'Clínica Veterinaria Ejemplo';
begin
  if not private.is_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pets where id = p_luna and microchip like 'DEMO-%')
     or not exists (select 1 from public.pets where id = p_michi and microchip like 'DEMO-%') then
    raise exception 'Solo para las mascotas de demostración';
  end if;
  perform set_config('scanpaw.demo_seed', 'on', true);

  insert into public.weights (pet_id, measured_on, weight_kg, source, author_name, author_cedula, created_at)
  values
    (p_luna, current_date - 420, 29.4, 'vet', v_vet, v_ced, now() - interval '420 days'),
    (p_luna, current_date - 300, 30.1, 'vet', v_vet, v_ced, now() - interval '300 days'),
    (p_luna, current_date - 120, 31.0, 'propietario', 'Dueño (ejemplo)', null, now() - interval '120 days'),
    (p_michi, current_date - 240, 5.1, 'vet', v_vet, v_ced, now() - interval '240 days');

  insert into public.consultations
    (pet_id, visit_date, reason, weight_kg, temperature_c, findings, diagnosis, treatment, owner_instructions,
     clinic_name, source, author_name, author_cedula, created_at)
  values
    (p_luna, current_date - 30, 'Prurito y lamido de patas', 31.6, 38.7,
     'Eritema interdigital en miembros anteriores. Sin lesiones en oídos. Condición corporal 6/9.',
     'Brote de dermatitis atópica',
     'Oclacitinib 16 mg VO cada 12 h por 14 días, después cada 24 h. Baño con clorhexidina al 2 % cada 3 días.',
     'Dale media tableta en la mañana y media en la noche durante 2 semanas; después solo una vez al día. Báñala cada 3 días con el champú indicado. Si se rasca hasta sangrar, avísanos.',
     v_clinic, 'vet', v_vet, v_ced, now() - interval '30 days'),
    (p_michi, current_date - 14, 'Control renal trimestral', 4.8, 38.4,
     'Mucosas rosadas, hidratación adecuada. Pérdida de 300 g en 8 meses.',
     'Enfermedad renal crónica estable, estadio 2 (IRIS)',
     'Continuar dieta renal. Repetir creatinina y SDMA en 3 meses. Valorar presión arterial en la próxima visita.',
     'Sigue con su alimento renal y deja siempre agua fresca. Pésalo cada mes; si baja más de medio kilo o deja de comer un día, tráelo.',
     v_clinic, 'vet', v_vet, v_ced, now() - interval '14 days');

  perform set_config('scanpaw.demo_seed', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke execute on function
  public.create_clinic(text, text, text, text),
  public.admin_review_clinic(uuid, public.clinic_status, text),
  public.clinic_create_invite(uuid),
  public.clinic_join(text),
  public.clinic_review_member(uuid, uuid, boolean),
  public.clinic_remove_member(uuid, uuid),
  public.demo_activate_clinic_plan(uuid),
  public.cancel_clinic_plan(uuid),
  public.my_calendar_links(),
  public.rotate_calendar_links(),
  public.schedule_appointment(uuid, timestamptz, text),
  public.clinic_schedule_appointment(uuid, uuid, uuid, timestamptz, text),
  public.clinic_update_appointment(uuid, uuid, timestamptz),
  public.set_appointment_status(uuid, public.appointment_status),
  public.clinic_agenda(uuid, timestamptz, timestamptz),
  public.clinic_patients(uuid),
  public.add_professional_profile(text, text, text, text, text),
  public.admin_seed_demo_clinical(uuid, uuid)
from public, anon;

grant execute on function
  public.create_clinic(text, text, text, text),
  public.admin_review_clinic(uuid, public.clinic_status, text),
  public.clinic_create_invite(uuid),
  public.clinic_join(text),
  public.clinic_review_member(uuid, uuid, boolean),
  public.clinic_remove_member(uuid, uuid),
  public.demo_activate_clinic_plan(uuid),
  public.cancel_clinic_plan(uuid),
  public.my_calendar_links(),
  public.rotate_calendar_links(),
  public.schedule_appointment(uuid, timestamptz, text),
  public.clinic_schedule_appointment(uuid, uuid, uuid, timestamptz, text),
  public.clinic_update_appointment(uuid, uuid, timestamptz),
  public.set_appointment_status(uuid, public.appointment_status),
  public.clinic_agenda(uuid, timestamptz, timestamptz),
  public.clinic_patients(uuid),
  public.add_professional_profile(text, text, text, text, text),
  public.admin_seed_demo_clinical(uuid, uuid)
to authenticated;

grant execute on all functions in schema private to anon, authenticated;
