-- Endurecimiento para el MVP: integridad de rutas de archivos, revocación de
-- accesos por el dueño, ciclo de vida de citas y rendimiento de RLS.

-- ------------------------------------------------------------------
-- Integridad
-- ------------------------------------------------------------------

-- La página pública firma la foto con la clave secreta: la ruta debe estar
-- dentro de la carpeta de la propia mascota para no exponer fotos ajenas.
alter table public.pets
  add constraint pets_photo_path_own_folder
  check (photo_path is null or photo_path like id::text || '/%');

-- Una mascota fallecida no puede estar en modo extraviado.
alter table public.pets
  add constraint pets_lost_only_if_alive
  check (not (status = 'fallecido' and lost_mode));

alter table public.attachments
  add constraint attachments_path_own_folder
  check (storage_path like pet_id::text || '/%');

-- El teléfono se muestra en la placa (tel: y WhatsApp): solo dígitos.
alter table public.profiles
  add constraint profiles_phone_format
  check (phone is null or phone ~ '^\+?[0-9]{10,15}$');

alter table public.profiles
  add constraint profiles_full_name_length
  check (char_length(full_name) <= 120);

-- ------------------------------------------------------------------
-- El dueño retira el acceso de un clínico
-- ------------------------------------------------------------------

create or replace function public.owner_revoke_access(p_pet uuid, p_clinician uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_pet_owner(p_pet) then
    raise exception 'Esta mascota no es tuya' using errcode = '42501';
  end if;
  update public.vet_access
  set expires_at = now()
  where pet_id = p_pet and vet_id = p_clinician and expires_at > now();
  if not found then
    raise exception 'Ese acceso ya no está vigente';
  end if;
  -- Sin acceso no puede preparar la consulta: sus citas pendientes se cancelan.
  update public.appointments
  set status = 'cancelada'
  where pet_id = p_pet and clinician_id = p_clinician and status = 'programada';
end;
$$;

revoke execute on function public.owner_revoke_access(uuid, uuid) from public, anon;
grant execute on function public.owner_revoke_access(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------
-- Citas: solo se cierran una vez, y cancelar recorta el acceso extendido
-- ------------------------------------------------------------------

create or replace function public.set_appointment_status(p_id uuid, p_status public.appointment_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.appointments;
  v_until timestamptz;
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
  if v_row.status <> 'programada' then
    raise exception 'Esta cita ya fue %', v_row.status;
  end if;
  if p_status = 'programada' then
    raise exception 'Estado no válido';
  end if;

  update public.appointments set status = p_status where id = p_id;

  -- Al cancelar, el acceso que se extendió por la cita vuelve a ajustarse a las
  -- citas que sigan programadas (o termina si no queda ninguna).
  if p_status = 'cancelada' and v_row.clinician_id is not null then
    select max(scheduled_at) + interval '1 day' into v_until
    from public.appointments
    where pet_id = v_row.pet_id and clinician_id = v_row.clinician_id and status = 'programada';
    update public.vet_access
    set expires_at = least(expires_at, coalesce(v_until, now()))
    where pet_id = v_row.pet_id and vet_id = v_row.clinician_id
      and source = 'cita' and expires_at > now();
  end if;
end;
$$;

-- ------------------------------------------------------------------
-- Rendimiento: auth.uid() se evalúa una vez por consulta, no por fila
-- ------------------------------------------------------------------

drop policy profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy pets_select on public.pets;
create policy pets_select on public.pets for select to authenticated
  using (created_by = (select auth.uid()) or private.can_read_pet(id));

drop policy pets_insert on public.pets;
create policy pets_insert on public.pets for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy vet_access_select on public.vet_access;
create policy vet_access_select on public.vet_access for select to authenticated
  using (vet_id = (select auth.uid()) or private.is_pet_owner(pet_id));

drop policy appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to authenticated
  using (clinician_id = (select auth.uid()) or private.is_pet_owner(pet_id));

-- Índices para las llaves foráneas (enmiendas, autores y revisiones).
create index if not exists vaccinations_amends_idx on public.vaccinations (amends_id);
create index if not exists vaccinations_author_idx on public.vaccinations (author_id);
create index if not exists conditions_amends_idx on public.conditions (amends_id);
create index if not exists conditions_author_idx on public.conditions (author_id);
create index if not exists attachments_amends_idx on public.attachments (amends_id);
create index if not exists attachments_author_idx on public.attachments (author_id);
create index if not exists pets_created_by_idx on public.pets (created_by);
create index if not exists scan_events_viewer_idx on public.scan_events (viewer_id);
create index if not exists share_codes_created_by_idx on public.share_codes (created_by);
create index if not exists share_codes_used_by_idx on public.share_codes (used_by);
create index if not exists vet_profiles_reviewed_by_idx on public.vet_profiles (reviewed_by);
create index if not exists student_profiles_reviewed_by_idx on public.student_profiles (reviewed_by);
