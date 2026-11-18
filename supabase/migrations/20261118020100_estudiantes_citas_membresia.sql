-- =====================================================================
-- Scan-Paw · Hito 2 (parcial) y preparación de la demo
--   1. Límite de intentos fallidos (activación de placas y códigos).
--   2. Cuenta de estudiante con verificación y marca "No profesionista".
--   3. Citas agendadas por el clínico (portal de clínica).
--   4. Membresía por mascota (modo demostración, sin cobro).
--   5. Bitácora de recordatorios enviados por el cron.
--   6. Datos de demostración para el administrador.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Límite de intentos fallidos
-- Las funciones que validan códigos ya no lanzan error ante un código
-- incorrecto (el error desharía el registro del intento): lo anotan y
-- devuelven false / null.
-- ---------------------------------------------------------------------
create table private.failed_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index failed_attempts_lookup_idx on private.failed_attempts (user_id, action, created_at desc);

create or replace function private.check_attempts(p_action text, p_max int default 10)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from private.failed_attempts
      where user_id = auth.uid() and action = p_action
        and created_at > now() - interval '1 hour') >= p_max then
    raise exception 'Demasiados intentos fallidos. Espera una hora e inténtalo de nuevo.';
  end if;
end;
$$;

create or replace function private.record_failure(p_action text)
returns void language sql security definer set search_path = '' as $$
  insert into private.failed_attempts (user_id, action) values (auth.uid(), p_action);
  delete from private.failed_attempts where created_at < now() - interval '1 day';
$$;

drop function public.activate_tag(text, text, uuid);
create function public.activate_tag(p_token text, p_code text, p_pet uuid)
returns boolean
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
  perform private.check_attempts('activar_placa');

  select * into v_tag from public.tags
  where public_token = upper(trim(p_token)) for update;

  if v_tag.id is null or v_tag.status <> 'sin_asignar'
     or v_tag.activation_code <> upper(trim(p_code)) then
    perform private.record_failure('activar_placa');
    return false;
  end if;

  update public.tags set status = 'revocada'
  where pet_id = p_pet and status = 'activa';

  update public.tags
  set pet_id = p_pet, status = 'activa', activated_at = now()
  where id = v_tag.id;
  return true;
end;
$$;
revoke execute on function public.activate_tag(text, text, uuid) from public, anon;
grant execute on function public.activate_tag(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Estudiantes
-- ---------------------------------------------------------------------
create table public.student_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  university text not null check (char_length(university) between 3 and 120),
  enrollment_id text not null check (enrollment_id ~ '^[0-9A-Za-z-]{4,20}$'),
  status public.verification_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.student_profiles enable row level security;
create policy student_profiles_select on public.student_profiles for select to authenticated
  using (private.can_see_profile(user_id));
revoke all on public.student_profiles from anon;
revoke insert, update, delete on public.student_profiles from authenticated;

create or replace function private.is_verified_student()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.student_profiles s
    join public.profiles p on p.id = s.user_id
    where s.user_id = auth.uid() and p.role = 'student' and s.status = 'approved'
  );
$$;

-- MVZ verificado o estudiante verificado.
create or replace function private.is_verified_clinician()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_verified_vet() or private.is_verified_student();
$$;

create or replace function private.has_vet_access(p_pet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_verified_clinician() and exists (
    select 1 from public.vet_access
    where pet_id = p_pet and vet_id = auth.uid() and expires_at > now()
  );
$$;

grant execute on all functions in schema private to anon, authenticated;

-- Firma de cada entrada: MVZ (con cédula), estudiante o propietario.
-- En la carga de datos de demostración (solo admin) se respetan los
-- valores de autor que trae la fila.
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
  if current_setting('scanpaw.demo_seed', true) = 'on' and private.is_admin() then
    return new;
  end if;

  if private.has_vet_access(new.pet_id) then
    if private.is_verified_student() then
      new.source := 'estudiante';
      select p.full_name into v_name from public.profiles p where p.id = auth.uid();
      v_cedula := null;
    else
      new.source := 'vet';
      select p.full_name, v.cedula into v_name, v_cedula
      from public.profiles p join public.vet_profiles v on v.user_id = p.id
      where p.id = auth.uid();
    end if;
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
  if not private.is_verified_clinician() then
    raise exception 'Solo médicos veterinarios o estudiantes verificados' using errcode = '42501';
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

create or replace function public.redeem_share_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.share_codes;
begin
  if not private.is_verified_clinician() then
    raise exception 'Solo médicos veterinarios o estudiantes verificados' using errcode = '42501';
  end if;
  perform private.check_attempts('canjear_codigo');

  update public.share_codes
  set used_by = auth.uid(), used_at = now()
  where code = upper(trim(p_code)) and used_at is null and expires_at > now()
  returning * into v_row;

  if v_row.code is null then
    perform private.record_failure('canjear_codigo');
    return null;
  end if;

  insert into public.vet_access (pet_id, vet_id, source, expires_at)
  values (v_row.pet_id, auth.uid(), 'codigo', now() + interval '7 days');

  return v_row.pet_id;
end;
$$;

-- Registro guiado: ahora también para estudiantes.
drop function public.complete_onboarding(text, text, text, text, text);
create function public.complete_onboarding(
  p_role text,
  p_full_name text,
  p_phone text,
  p_cedula text default null,
  p_clinic text default null,
  p_university text default null,
  p_enrollment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión primero' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = auth.uid() for update;
  if v_profile.id is null then
    raise exception 'Perfil no encontrado';
  end if;
  if v_profile.privacy_accepted_at is not null then
    raise exception 'Tu registro ya está completo';
  end if;

  if p_role not in ('owner', 'vet', 'student') then
    raise exception 'Tipo de cuenta no válido';
  end if;
  if char_length(trim(coalesce(p_full_name, ''))) < 3 then
    raise exception 'Escribe tu nombre completo';
  end if;
  if coalesce(p_phone, '') !~ '^\+?[0-9]{10,15}$' then
    raise exception 'Teléfono no válido';
  end if;
  if p_role = 'vet' and coalesce(p_cedula, '') !~ '^[0-9]{7,8}$' then
    raise exception 'La cédula profesional tiene 7 u 8 dígitos';
  end if;
  if p_role = 'student' then
    if char_length(trim(coalesce(p_university, ''))) < 3 then
      raise exception 'Escribe el nombre de tu universidad';
    end if;
    if coalesce(p_enrollment, '') !~ '^[0-9A-Za-z-]{4,20}$' then
      raise exception 'La matrícula tiene de 4 a 20 letras o números';
    end if;
  end if;

  update public.profiles
  set role = p_role::public.user_role,
      full_name = left(trim(p_full_name), 120),
      phone = p_phone,
      privacy_accepted_at = now()
  where id = auth.uid();

  if p_role = 'vet' then
    insert into public.vet_profiles (user_id, cedula, clinic_name)
    values (auth.uid(), p_cedula, nullif(left(trim(coalesce(p_clinic, '')), 120), ''))
    on conflict (user_id) do nothing;
  elsif p_role = 'student' then
    insert into public.student_profiles (user_id, university, enrollment_id)
    values (auth.uid(), left(trim(p_university), 120), upper(p_enrollment))
    on conflict (user_id) do nothing;
  end if;
end;
$$;
revoke execute on function public.complete_onboarding(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text, text, text, text, text) to authenticated;

create or replace function public.admin_review_student(
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
  update public.student_profiles
  set status = p_status,
      review_note = nullif(trim(p_note), ''),
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where user_id = p_user;
end;
$$;
revoke execute on function public.admin_review_student(uuid, public.verification_status, text) from public, anon;
grant execute on function public.admin_review_student(uuid, public.verification_status, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Citas
-- El nombre de la mascota y del clínico se copian en la cita para que la
-- agenda siga legible aunque el acceso al expediente ya haya vencido.
-- ---------------------------------------------------------------------
create type public.appointment_status as enum ('programada', 'completada', 'cancelada');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets (id) on delete cascade,
  clinician_id uuid references public.profiles (id) on delete set null,
  pet_name text not null,
  clinician_name text,
  clinic_name text,
  scheduled_at timestamptz not null,
  reason text not null check (char_length(reason) between 1 and 200),
  status public.appointment_status not null default 'programada',
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_pet_idx on public.appointments (pet_id, scheduled_at);
create index appointments_clinician_idx on public.appointments (clinician_id, scheduled_at);
create trigger appointments_touch before update on public.appointments
  for each row execute function private.touch_updated_at();

alter table public.appointments enable row level security;
create policy appointments_select on public.appointments for select to authenticated
  using (clinician_id = auth.uid() or private.is_pet_owner(pet_id));
revoke all on public.appointments from anon;
revoke insert, update, delete on public.appointments from authenticated;

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
  v_clinic text;
  v_until timestamptz;
begin
  if not private.has_vet_access(p_pet) then
    raise exception 'Necesitas acceso vigente al expediente para agendar' using errcode = '42501';
  end if;
  if p_at < now() - interval '1 hour' or p_at > now() + interval '180 days' then
    raise exception 'La cita debe ser en los próximos 6 meses';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Escribe el motivo de la cita';
  end if;

  select name into v_pet_name from public.pets where id = p_pet;
  select p.full_name, v.clinic_name into v_name, v_clinic
  from public.profiles p left join public.vet_profiles v on v.user_id = p.id
  where p.id = auth.uid();

  insert into public.appointments (pet_id, clinician_id, pet_name, clinician_name, clinic_name, scheduled_at, reason)
  values (p_pet, auth.uid(), v_pet_name, v_name, v_clinic, p_at, left(trim(p_reason), 200))
  returning id into v_id;

  -- Para preparar la consulta, el acceso se extiende hasta el día siguiente a la cita.
  select max(expires_at) into v_until from public.vet_access
  where pet_id = p_pet and vet_id = auth.uid();
  if v_until < p_at + interval '1 day' then
    insert into public.vet_access (pet_id, vet_id, source, expires_at)
    values (p_pet, auth.uid(), 'cita', p_at + interval '1 day');
  end if;

  return v_id;
end;
$$;

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
    null; -- el clínico puede completar o cancelar
  elsif private.is_pet_owner(v_row.pet_id) and p_status = 'cancelada' then
    null; -- el dueño solo puede cancelar
  else
    raise exception 'No puedes modificar esta cita' using errcode = '42501';
  end if;
  update public.appointments set status = p_status where id = p_id;
end;
$$;

revoke execute on function public.schedule_appointment(uuid, timestamptz, text) from public, anon;
revoke execute on function public.set_appointment_status(uuid, public.appointment_status) from public, anon;
grant execute on function public.schedule_appointment(uuid, timestamptz, text) to authenticated;
grant execute on function public.set_appointment_status(uuid, public.appointment_status) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Membresía por mascota (demostración: no hay cobro real)
-- ---------------------------------------------------------------------
create table public.memberships (
  pet_id uuid primary key references public.pets (id) on delete cascade,
  plan text not null check (plan in ('mensual', 'anual')),
  status text not null check (status in ('activa', 'cancelada')),
  current_period_end timestamptz not null,
  provider text not null default 'demo',
  updated_at timestamptz not null default now()
);
alter table public.memberships enable row level security;
create policy memberships_select on public.memberships for select to authenticated
  using (private.is_pet_owner(pet_id));
revoke all on public.memberships from anon;
revoke insert, update, delete on public.memberships from authenticated;

create or replace function public.demo_activate_membership(p_pet uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_pet_owner(p_pet) then
    raise exception 'Esta mascota no es tuya' using errcode = '42501';
  end if;
  if p_plan not in ('mensual', 'anual') then
    raise exception 'Plan no válido';
  end if;
  insert into public.memberships (pet_id, plan, status, current_period_end, provider)
  values (p_pet, p_plan, 'activa',
          now() + case when p_plan = 'anual' then interval '1 year' else interval '1 month' end, 'demo')
  on conflict (pet_id) do update
    set plan = excluded.plan, status = 'activa',
        current_period_end = excluded.current_period_end, provider = 'demo', updated_at = now();
end;
$$;

create or replace function public.cancel_membership(p_pet uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_pet_owner(p_pet) then
    raise exception 'Esta mascota no es tuya' using errcode = '42501';
  end if;
  update public.memberships set status = 'cancelada', updated_at = now() where pet_id = p_pet;
end;
$$;

revoke execute on function public.demo_activate_membership(uuid, text) from public, anon;
revoke execute on function public.cancel_membership(uuid) from public, anon;
grant execute on function public.demo_activate_membership(uuid, text) to authenticated;
grant execute on function public.cancel_membership(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Bitácora de recordatorios (solo la usa el cron con la clave secreta)
-- ---------------------------------------------------------------------
create table public.reminder_log (
  kind text not null,
  ref_id uuid not null,
  sent_at timestamptz not null default now(),
  primary key (kind, ref_id)
);
alter table public.reminder_log enable row level security;
revoke all on public.reminder_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Datos de demostración (solo admin, en sus propias mascotas)
-- Las mascotas de demo se reconocen por el microchip "DEMO-…".
-- ---------------------------------------------------------------------
create or replace function public.admin_reset_demo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  delete from public.tags where batch = 'demo';
  delete from public.pets p
  where p.microchip like 'DEMO-%'
    and exists (select 1 from public.pet_owners o where o.pet_id = p.id and o.user_id = auth.uid());
end;
$$;

create or replace function public.admin_seed_demo()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_luna uuid := gen_random_uuid();
  v_michi uuid := gen_random_uuid();
  v_vet text := 'MVZ Laura Méndez (ejemplo)';
  v_ced text := '00000000';
  v_tag text;
  v_new_tag text;
  v_new_code text;
begin
  if not private.is_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  perform public.admin_reset_demo();
  perform set_config('scanpaw.demo_seed', 'on', true);

  insert into public.pets (id, name, species, breed, sex, birth_date, color, sterilized, microchip, created_by, show_photo)
  values
    (v_luna, 'Luna', 'perro', 'Golden Retriever', 'hembra', current_date - interval '5 years 8 months',
     'Dorado, mancha clara en el pecho', true, 'DEMO-0001', auth.uid(), true),
    (v_michi, 'Michi', 'gato', 'Doméstico de pelo corto', 'macho', current_date - interval '7 years 4 months',
     'Atigrado gris', true, 'DEMO-0002', auth.uid(), true);

  -- Vacunas de Luna: una vigente, una por vencer y una vencida.
  insert into public.vaccinations (pet_id, vaccine, batch_number, applied_on, next_due, notes, source, author_name, author_cedula, created_at)
  values
    (v_luna, 'Antirrábica', 'RB-22841', current_date - 363, current_date + 2, null, 'vet', v_vet, v_ced, now() - interval '363 days'),
    (v_luna, 'Múltiple canina (séxtuple)', 'MX-11970', current_date - 410, current_date - 45, 'Refuerzo anual pendiente.', 'vet', v_vet, v_ced, now() - interval '410 days'),
    (v_luna, 'Bordetella (tos de las perreras)', null, current_date - 190, current_date + 175, 'Aplicada antes de la guardería.', 'propietario', 'Dueño (ejemplo)', null, now() - interval '190 days');

  insert into public.conditions (pet_id, kind, description, severity, active, notes, source, author_name, author_cedula, created_at)
  values
    (v_luna, 'alergia', 'Penicilina', 'grave', true, 'Reacción con urticaria y edema facial en 2023.', 'vet', v_vet, v_ced, now() - interval '700 days'),
    (v_luna, 'cronica', 'Dermatitis atópica', 'moderada', true, 'Baños con clorhexidina cada 15 días. Brotes en primavera.', 'vet', v_vet, v_ced, now() - interval '300 days'),
    (v_michi, 'cronica', 'Enfermedad renal crónica, estadio 2 (IRIS)', 'moderada', true, 'Dieta renal. Control de creatinina y SDMA cada 3 meses.', 'vet', v_vet, v_ced, now() - interval '120 days'),
    (v_michi, 'alergia', 'Pollo (alimentaria)', 'leve', true, 'Vómito ocasional. Evitar premios con pollo.', 'propietario', 'Dueño (ejemplo)', null, now() - interval '60 days');

  insert into public.vaccinations (pet_id, vaccine, batch_number, applied_on, next_due, source, author_name, author_cedula, created_at)
  values
    (v_michi, 'Triple felina', 'TF-5521', current_date - 150, current_date + 215, 'vet', v_vet, v_ced, now() - interval '150 days'),
    (v_michi, 'Antirrábica', 'RB-23310', current_date - 150, current_date + 215, 'vet', v_vet, v_ced, now() - interval '150 days');

  -- El PDF lo sube la aplicación a esta ruta justo después.
  insert into public.attachments (pet_id, kind, title, storage_path, mime_type, size_bytes, notes, source, author_name, author_cedula, created_at)
  values (v_luna, 'estudio', 'Hemograma y química sanguínea', v_luna || '/demo-hemograma.pdf', 'application/pdf', 2048,
          'Valores dentro de rango. Eosinófilos ligeramente elevados.', 'vet', v_vet, v_ced, now() - interval '30 days');

  -- Placa activa de Luna y una placa nueva para mostrar la activación en vivo.
  v_tag := private.random_code(10);
  insert into public.tags (public_token, activation_code, batch, status, pet_id, activated_at)
  values (v_tag, private.random_code(8), 'demo', 'activa', v_luna, now() - interval '200 days');
  v_new_tag := private.random_code(10);
  v_new_code := private.random_code(8);
  insert into public.tags (public_token, activation_code, batch) values (v_new_tag, v_new_code, 'demo');

  insert into public.memberships (pet_id, plan, status, current_period_end, provider)
  values (v_luna, 'anual', 'activa', now() + interval '200 days', 'demo');

  perform set_config('scanpaw.demo_seed', 'off', true);
  return jsonb_build_object(
    'luna', v_luna, 'michi', v_michi,
    'luna_tag', v_tag, 'new_tag', v_new_tag, 'new_code', v_new_code
  );
end;
$$;

revoke execute on function public.admin_reset_demo() from public, anon;
revoke execute on function public.admin_seed_demo() from public, anon;
grant execute on function public.admin_reset_demo() to authenticated;
grant execute on function public.admin_seed_demo() to authenticated;
