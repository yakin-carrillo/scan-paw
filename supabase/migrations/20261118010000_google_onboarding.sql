-- =====================================================================
-- Scan-Paw · Inicio de sesión con Google + registro guiado
-- Con OAuth el perfil nace sin teléfono, sin rol elegido y sin
-- consentimiento. El usuario completa esos datos en /bienvenida una sola
-- vez, mediante complete_onboarding().
-- =====================================================================

-- Google entrega el nombre en "full_name" o "name".
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- Todos nacen como propietario; el rol MVZ solo se elige en el registro guiado.
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'owner',
    left(coalesce(meta ->> 'full_name', meta ->> 'name', ''), 120)
  );
  return new;
end;
$$;

create or replace function public.complete_onboarding(
  p_role text,
  p_full_name text,
  p_phone text,
  p_cedula text default null,
  p_clinic text default null
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

  if p_role not in ('owner', 'vet') then
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
  end if;
end;
$$;

revoke execute on function public.complete_onboarding(text, text, text, text, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, text, text, text) to authenticated;
