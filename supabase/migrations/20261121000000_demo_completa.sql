-- =====================================================================
-- Scan-Paw · Demostración con una sola cuenta
--   1. El administrador de la plataforma puede tener perfil de MVZ
--      verificado (y por lo tanto espacio clínico y de clínica).
--   2. Datos de demostración extensos: dueños, MVZ, estudiante, clínica con
--      agenda, mascota extraviada con escaneos, verificaciones pendientes.
-- Las personas de la demo son cuentas sin contraseña ni acceso, con correo
-- @demo.scan-paw.invalid; las mascotas llevan microchip DEMO-…; las clínicas
-- terminan en "(ejemplo)". Restablecer la demo borra exactamente eso.
-- =====================================================================

create or replace function private.is_verified_vet()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.vet_profiles v
    join public.profiles p on p.id = v.user_id
    where v.user_id = auth.uid() and p.role in ('vet', 'admin') and v.status = 'approved'
  );
$$;

create or replace function private.user_is_verified_clinician(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    left join public.vet_profiles v on v.user_id = p.id
    left join public.student_profiles s on s.user_id = p.id
    where p.id = p_user
      and ((p.role in ('vet', 'admin') and v.status = 'approved') or (p.role = 'student' and s.status = 'approved'))
  );
$$;

-- Persona de demostración: cuenta sin contraseña que no puede iniciar sesión.
create or replace function private.demo_person(
  p_slug text, p_name text, p_phone text, p_role public.user_role default 'owner'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_id, p_slug || '@demo.scan-paw.invalid', jsonb_build_object('full_name', p_name));
  update public.profiles
  set role = p_role, full_name = p_name, phone = p_phone, privacy_accepted_at = now() - interval '60 days'
  where id = v_id;
  return v_id;
end;
$$;

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
  delete from public.pets where microchip like 'DEMO-%';
  delete from public.tags where batch = 'demo';
  delete from public.clinics where name like '%(ejemplo)';
  delete from auth.users where email like '%@demo.scan-paw.invalid';
end;
$$;

drop function if exists public.admin_seed_demo_clinical(uuid, uuid);

create or replace function public.admin_seed_demo()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_me_name text;
  v_me_ced text := '00000000';
  v_today timestamptz := (date_trunc('day', now() at time zone 'America/Mexico_City')) at time zone 'America/Mexico_City';
  v_d date := (now() at time zone 'America/Mexico_City')::date;
  -- personas
  u_laura uuid; u_diego uuid; u_sofia uuid; u_andres uuid; u_paola uuid; u_marco uuid;
  u_ricardo uuid; u_ana uuid; u_carlos uuid; u_fer uuid;
  -- clínicas
  c_valle uuid := gen_random_uuid(); c_norte uuid := gen_random_uuid();
  v_clinic text := 'Clínica Veterinaria Del Valle (ejemplo)';
  -- mascotas
  p_luna uuid := gen_random_uuid(); p_michi uuid := gen_random_uuid(); p_rocky uuid := gen_random_uuid();
  p_pelusa uuid := gen_random_uuid(); p_toby uuid := gen_random_uuid(); p_nala uuid := gen_random_uuid();
  p_max uuid := gen_random_uuid(); p_kira uuid := gen_random_uuid();
  -- placas
  t_luna uuid := gen_random_uuid(); t_rocky uuid := gen_random_uuid(); t_toby uuid := gen_random_uuid();
  t_max uuid := gen_random_uuid();
  v_luna_tag text := private.random_code(10); v_rocky_tag text := private.random_code(10);
  v_new_tag text := private.random_code(10); v_new_code text := private.random_code(8);
  -- consultas
  q_toby uuid := gen_random_uuid();
  v_laura text := 'MVZ Laura Méndez (ejemplo)';
  v_diego text := 'MVZ Diego Ramírez (ejemplo)';
  v_sofia text := 'Sofía Torres (estudiante, ejemplo)';
begin
  if not private.is_admin() then
    raise exception 'Solo administradores' using errcode = '42501';
  end if;
  perform public.admin_reset_demo();
  if exists (select 1 from public.clinic_members where user_id = v_me and status <> 'baja') then
    raise exception 'Tu cuenta pertenece a una clínica real; sal de ella para cargar la demo';
  end if;
  perform set_config('scanpaw.demo_seed', 'on', true);

  -- La cuenta del administrador también es MVZ verificado: puede usar todos los espacios.
  select full_name into v_me_name from public.profiles where id = v_me;
  insert into public.vet_profiles (user_id, cedula, clinic_name, status, review_note, reviewed_by, reviewed_at)
  values (v_me, v_me_ced, v_clinic, 'approved', 'Perfil de demostración del administrador', v_me, now())
  on conflict (user_id) do update set status = 'approved', clinic_name = excluded.clinic_name;
  select cedula into v_me_ced from public.vet_profiles where user_id = v_me;

  -- ------------------------------- Personas -------------------------------
  u_laura := private.demo_person('laura', v_laura, '5550000001', 'vet');
  u_diego := private.demo_person('diego', v_diego, '5550000002', 'vet');
  u_sofia := private.demo_person('sofia', v_sofia, '5550000003', 'student');
  u_andres := private.demo_person('andres', 'MVZ Andrés Lara (ejemplo)', '5550000004', 'vet');
  u_paola := private.demo_person('paola', 'MVZ Paola Ruiz (ejemplo)', '5550000005', 'vet');
  u_marco := private.demo_person('marco', 'Marco Gil (estudiante, ejemplo)', '5550000006', 'student');
  u_ricardo := private.demo_person('ricardo', 'Ricardo Salas (ejemplo)', '5550000007');
  u_ana := private.demo_person('ana', 'Ana López (ejemplo)', '5550000008');
  u_carlos := private.demo_person('carlos', 'Carlos Méndez (ejemplo)', '5550000009');
  u_fer := private.demo_person('fernanda', 'Fernanda Ruiz (ejemplo)', '5550000010');

  insert into public.vet_profiles (user_id, cedula, clinic_name, status, reviewed_by, reviewed_at, created_at) values
    (u_laura, '10000001', v_clinic, 'approved', v_me, now() - interval '90 days', now() - interval '95 days'),
    (u_diego, '10000002', v_clinic, 'approved', v_me, now() - interval '80 days', now() - interval '85 days'),
    (u_andres, '10000004', v_clinic, 'pending', null, null, now() - interval '1 day'),
    -- misma cédula que Diego: el panel la marca como "Cédula repetida".
    (u_paola, '10000002', 'Consultorio Paola Ruiz', 'pending', null, null, now() - interval '2 days');
  insert into public.student_profiles (user_id, university, enrollment_id, status, reviewed_by, reviewed_at, created_at) values
    (u_sofia, 'UNAM FMVZ', 'A0001234', 'approved', v_me, now() - interval '40 days', now() - interval '45 days'),
    (u_marco, 'UAM Xochimilco', 'B0002345', 'pending', null, null, now() - interval '3 hours');

  -- ------------------------------- Clínicas -------------------------------
  insert into public.clinics (id, name, address, phone, rfc, status, reviewed_by, reviewed_at, plan_status, plan_until, created_by, created_at) values
    (c_valle, v_clinic, 'Av. Coyoacán 1234, Del Valle, CDMX', '5551234567', 'CVV200115AB1', 'verificada', v_me,
     now() - interval '60 days', 'activa', now() + interval '24 days', v_me, now() - interval '62 days'),
    (c_norte, 'Hospital Veterinario Norte (ejemplo)', 'Av. Politécnico 500, Lindavista, CDMX', '5559876543',
     'HVN191020KJ3', 'pendiente', null, null, 'sin_plan', null, u_ricardo, now() - interval '5 hours');
  insert into public.clinic_members (clinic_id, user_id, role, status, validated_by, validated_at, joined_at) values
    (c_valle, v_me, 'admin', 'activo', v_me, now() - interval '62 days', now() - interval '62 days'),
    (c_valle, u_laura, 'clinico', 'activo', v_me, now() - interval '58 days', now() - interval '59 days'),
    (c_valle, u_diego, 'clinico', 'activo', v_me, now() - interval '50 days', now() - interval '51 days'),
    (c_valle, u_sofia, 'clinico', 'activo', v_me, now() - interval '30 days', now() - interval '31 days'),
    (c_valle, u_andres, 'clinico', 'pendiente', null, null, now() - interval '1 day'),
    (c_norte, u_ricardo, 'admin', 'activo', u_ricardo, now() - interval '5 hours', now() - interval '5 hours');
  update public.vet_profiles set validated_by_clinic = c_valle where user_id in (u_laura, u_diego);
  update public.student_profiles set validated_by_clinic = c_valle where user_id = u_sofia;

  -- ------------------------------- Mascotas -------------------------------
  insert into public.pets (id, name, species, breed, sex, birth_date, color, sterilized, microchip, created_by,
                           show_photo, status, deceased_at, lost_mode, lost_message, created_at) values
    (p_luna, 'Luna', 'perro', 'Golden Retriever', 'hembra', v_d - interval '5 years 8 months',
     'Dorado, mancha clara en el pecho', true, 'DEMO-0001', v_me, true, 'activo', null, false, null, now() - interval '400 days'),
    (p_michi, 'Michi', 'gato', 'Doméstico de pelo corto', 'macho', v_d - interval '7 years 4 months',
     'Atigrado gris', true, 'DEMO-0002', v_me, true, 'activo', null, false, null, now() - interval '380 days'),
    (p_rocky, 'Rocky', 'perro', 'Mestizo', 'macho', v_d - interval '3 years 2 months',
     'Negro con pecho blanco, collar rojo', false, 'DEMO-0003', v_me, true, 'activo', null, true,
     'Se perdió cerca del Parque de los Venados. Es asustadizo: no lo persigas, llámame. Toma medicamento diario.',
     now() - interval '300 days'),
    (p_pelusa, 'Pelusa', 'gato', 'Persa', 'hembra', v_d - interval '16 years',
     'Blanca', true, 'DEMO-0004', v_me, false, 'fallecido', v_d - 90, false, null, now() - interval '700 days'),
    (p_toby, 'Toby', 'perro', 'Beagle', 'macho', v_d - interval '4 years 1 month',
     'Tricolor', true, 'DEMO-0005', u_ana, true, 'activo', null, false, null, now() - interval '200 days'),
    (p_nala, 'Nala', 'gato', 'Siamés', 'hembra', v_d - interval '2 years 6 months',
     'Crema con puntas café', true, 'DEMO-0006', u_ana, true, 'activo', null, false, null, now() - interval '150 days'),
    (p_max, 'Max', 'perro', 'Schnauzer miniatura', 'macho', v_d - interval '9 years',
     'Sal y pimienta', true, 'DEMO-0007', u_carlos, true, 'activo', null, true,
     'Desapareció el martes en la colonia Narvarte. Tiene diabetes: necesita insulina.', now() - interval '500 days'),
    (p_kira, 'Kira', 'perro', 'Pastor alemán', 'hembra', v_d - interval '6 years 3 months',
     'Negro y fuego', false, 'DEMO-0008', u_fer, true, 'activo', null, false, null, now() - interval '250 days');

  -- -------------------------------- Placas --------------------------------
  insert into public.tags (id, public_token, activation_code, batch, status, pet_id, activated_at) values
    (t_luna, v_luna_tag, private.random_code(8), 'demo', 'activa', p_luna, now() - interval '200 days'),
    (t_rocky, v_rocky_tag, private.random_code(8), 'demo', 'activa', p_rocky, now() - interval '280 days'),
    (t_toby, private.random_code(10), private.random_code(8), 'demo', 'activa', p_toby, now() - interval '190 days'),
    (t_max, private.random_code(10), private.random_code(8), 'demo', 'activa', p_max, now() - interval '480 days');
  insert into public.tags (public_token, activation_code, batch) values
    (v_new_tag, v_new_code, 'demo'),
    (private.random_code(10), private.random_code(8), 'demo'),
    (private.random_code(10), private.random_code(8), 'demo');

  -- Escaneos: Rocky extraviado (con ubicación) y un MVZ que abrió a Luna.
  insert into public.scan_events (tag_id, pet_id, kind, viewer_id, latitude, longitude, created_at) values
    (t_rocky, p_rocky, 'publico', null, 19.3711, -99.1570, now() - interval '26 hours'),
    (t_rocky, p_rocky, 'publico', null, 19.3742, -99.1601, now() - interval '5 hours'),
    (t_rocky, p_rocky, 'publico', null, null, null, now() - interval '40 minutes'),
    (t_luna, p_luna, 'vet', u_laura, null, null, now() - interval '40 days'),
    (t_toby, p_toby, 'vet', v_me, null, null, now() - interval '1 day'),
    (t_max, p_max, 'vet', u_diego, null, null, now() - interval '3 days');

  -- ------------------------- Accesos de clínicos -------------------------
  insert into public.vet_access (pet_id, vet_id, source, granted_at, expires_at) values
    (p_luna, u_laura, 'escaneo', now() - interval '40 days', now() - interval '33 days'),
    (p_luna, u_laura, 'cita', now() - interval '1 day', v_today + interval '3 days'),
    (p_luna, u_diego, 'codigo', now() - interval '2 days', now() + interval '5 days'),
    (p_michi, u_laura, 'cita', now() - interval '14 days', v_today + interval '2 days'),
    (p_rocky, u_diego, 'escaneo', now() - interval '60 days', now() - interval '53 days'),
    (p_toby, v_me, 'escaneo', now() - interval '1 day', now() + interval '6 days'),
    (p_toby, u_laura, 'codigo', now() - interval '3 days', now() + interval '4 days'),
    (p_nala, v_me, 'codigo', now() - interval '6 days', now() + interval '20 hours'),
    (p_max, v_me, 'escaneo', now() - interval '3 days', now() + interval '4 days'),
    (p_max, u_diego, 'escaneo', now() - interval '3 days', now() + interval '4 days'),
    (p_kira, v_me, 'cita', now() - interval '10 days', v_today + interval '2 days'),
    (p_kira, u_sofia, 'cita', now() - interval '20 days', v_today + interval '5 days');

  -- -------------------------------- Citas --------------------------------
  insert into public.appointments (pet_id, clinician_id, pet_name, clinician_name, clinic_name, clinic_id, created_by,
                                   scheduled_at, reason, status, created_at) values
    (p_toby, v_me, 'Toby', v_me_name, v_clinic, c_valle, v_me, v_today + interval '10 hours', 'Revisión de otitis', 'programada', now() - interval '3 days'),
    (p_nala, v_me, 'Nala', v_me_name, v_clinic, c_valle, v_me, v_today + interval '12 hours 30 minutes', 'Refuerzo de triple felina', 'programada', now() - interval '6 days'),
    (p_max, u_diego, 'Max', v_diego, v_clinic, c_valle, v_me, v_today + interval '16 hours', 'Control de glucosa tras el extravío', 'programada', now() - interval '2 days'),
    (p_kira, v_me, 'Kira', v_me_name, v_clinic, c_valle, v_me, v_today + interval '1 day 9 hours 30 minutes', 'Desparasitación', 'programada', now() - interval '10 days'),
    (p_michi, u_laura, 'Michi', v_laura, v_clinic, c_valle, v_me, v_today + interval '1 day 17 hours', 'Control renal: creatinina y SDMA', 'programada', now() - interval '14 days'),
    (p_luna, u_laura, 'Luna', v_laura, v_clinic, c_valle, u_laura, v_today + interval '2 days 11 hours', 'Seguimiento de dermatitis', 'programada', now() - interval '1 day'),
    (p_toby, null, 'Toby', null, v_clinic, c_valle, v_me, v_today + interval '3 days 13 hours', 'Limpieza dental', 'programada', now() - interval '1 day'),
    (p_kira, u_sofia, 'Kira', v_sofia, v_clinic, c_valle, v_me, v_today + interval '4 days 10 hours', 'Fisioterapia de cadera (supervisada)', 'programada', now() - interval '5 days'),
    (p_toby, v_me, 'Toby', v_me_name, v_clinic, c_valle, v_me, v_today - interval '3 days' + interval '11 hours', 'Consulta por rascado de oído', 'completada', now() - interval '6 days'),
    (p_nala, u_laura, 'Nala', v_laura, v_clinic, c_valle, v_me, v_today - interval '1 day' + interval '18 hours', 'Revisión general', 'cancelada', now() - interval '8 days');

  -- ------------------------------- Vacunas -------------------------------
  insert into public.vaccinations (pet_id, vaccine, batch_number, applied_on, next_due, notes, source, author_id, author_name, author_cedula, created_at) values
    (p_luna, 'Antirrábica', 'RB-22841', v_d - 363, v_d + 2, null, 'vet', u_laura, v_laura, '10000001', now() - interval '363 days'),
    (p_luna, 'Múltiple canina (séxtuple)', 'MX-11970', v_d - 410, v_d - 45, 'Refuerzo anual pendiente.', 'vet', u_laura, v_laura, '10000001', now() - interval '410 days'),
    (p_luna, 'Bordetella (tos de las perreras)', null, v_d - 190, v_d + 175, 'Aplicada antes de la guardería.', 'propietario', v_me, v_me_name, null, now() - interval '190 days'),
    (p_michi, 'Triple felina', 'TF-5521', v_d - 150, v_d + 215, null, 'vet', u_laura, v_laura, '10000001', now() - interval '150 days'),
    (p_michi, 'Antirrábica', 'RB-23310', v_d - 150, v_d + 215, null, 'vet', u_laura, v_laura, '10000001', now() - interval '150 days'),
    (p_rocky, 'Antirrábica', 'RB-24002', v_d - 60, v_d + 305, null, 'vet', u_diego, v_diego, '10000002', now() - interval '60 days'),
    (p_rocky, 'Múltiple canina (séxtuple)', 'MX-12544', v_d - 60, v_d + 305, null, 'vet', u_diego, v_diego, '10000002', now() - interval '60 days'),
    (p_pelusa, 'Triple felina', 'TF-3310', v_d - 500, v_d - 135, null, 'vet', u_laura, v_laura, '10000001', now() - interval '500 days'),
    (p_toby, 'Antirrábica', 'RB-23901', v_d - 340, v_d + 25, null, 'vet', u_laura, v_laura, '10000001', now() - interval '340 days'),
    (p_toby, 'Múltiple canina (séxtuple)', 'MX-12011', v_d - 340, v_d + 25, null, 'vet', u_laura, v_laura, '10000001', now() - interval '340 days'),
    (p_nala, 'Triple felina', 'TF-5102', v_d - 380, v_d - 15, 'Toca refuerzo anual.', 'vet', u_laura, v_laura, '10000001', now() - interval '380 days'),
    (p_max, 'Antirrábica', 'RB-21877', v_d - 200, v_d + 165, null, 'vet', u_diego, v_diego, '10000002', now() - interval '200 days'),
    (p_kira, 'Antirrábica', 'RB-22950', v_d - 120, v_d + 245, null, 'vet', u_laura, v_laura, '10000001', now() - interval '120 days'),
    (p_kira, 'Leptospirosis', null, v_d - 400, v_d - 35, 'Registrada por la dueña con la cartilla anterior.', 'propietario', u_fer, 'Fernanda Ruiz (ejemplo)', null, now() - interval '250 days');

  -- ------------------------ Alergias y crónicos ------------------------
  insert into public.conditions (pet_id, kind, description, severity, active, notes, source, author_id, author_name, author_cedula, created_at) values
    (p_luna, 'alergia', 'Penicilina', 'grave', true, 'Reacción con urticaria y edema facial en 2023.', 'vet', u_laura, v_laura, '10000001', now() - interval '700 days'),
    (p_luna, 'cronica', 'Dermatitis atópica', 'moderada', true, 'Baños con clorhexidina cada 15 días. Brotes en primavera.', 'vet', u_laura, v_laura, '10000001', now() - interval '300 days'),
    (p_michi, 'cronica', 'Enfermedad renal crónica, estadio 2 (IRIS)', 'moderada', true, 'Dieta renal. Control de creatinina y SDMA cada 3 meses.', 'vet', u_laura, v_laura, '10000001', now() - interval '120 days'),
    (p_michi, 'alergia', 'Pollo (alimentaria)', 'leve', true, 'Vómito ocasional. Evitar premios con pollo.', 'propietario', v_me, v_me_name, null, now() - interval '60 days'),
    (p_rocky, 'cronica', 'Epilepsia idiopática', 'moderada', true, 'Fenobarbital 2.5 mg/kg cada 12 h. No suspender.', 'vet', u_diego, v_diego, '10000002', now() - interval '60 days'),
    (p_toby, 'cronica', 'Otitis externa recurrente', 'leve', true, 'Limpieza ótica semanal.', 'vet', v_me, v_me_name, v_me_ced, now() - interval '3 days'),
    (p_nala, 'alergia', 'Picadura de pulga (DAPP)', 'leve', true, null, 'propietario', u_ana, 'Ana López (ejemplo)', null, now() - interval '100 days'),
    (p_max, 'cronica', 'Diabetes mellitus', 'grave', true, 'Insulina NPH 0.5 UI/kg cada 12 h con alimento.', 'vet', u_diego, v_diego, '10000002', now() - interval '400 days'),
    (p_max, 'alergia', 'Meloxicam', 'moderada', true, 'Vómito y diarrea con AINE.', 'vet', u_diego, v_diego, '10000002', now() - interval '300 days'),
    (p_kira, 'cronica', 'Displasia de cadera bilateral', 'moderada', true, 'Control de peso y fisioterapia.', 'vet', u_laura, v_laura, '10000001', now() - interval '200 days');

  -- -------------------------------- Peso --------------------------------
  insert into public.weights (pet_id, measured_on, weight_kg, source, author_id, author_name, author_cedula, created_at) values
    (p_luna, v_d - 420, 29.4, 'vet', u_laura, v_laura, '10000001', now() - interval '420 days'),
    (p_luna, v_d - 300, 30.1, 'vet', u_laura, v_laura, '10000001', now() - interval '300 days'),
    (p_luna, v_d - 120, 31.0, 'propietario', v_me, v_me_name, null, now() - interval '120 days'),
    (p_michi, v_d - 240, 5.1, 'vet', u_laura, v_laura, '10000001', now() - interval '240 days'),
    (p_michi, v_d - 120, 4.9, 'propietario', v_me, v_me_name, null, now() - interval '120 days'),
    (p_rocky, v_d - 200, 21.8, 'propietario', v_me, v_me_name, null, now() - interval '200 days'),
    (p_toby, v_d - 340, 12.9, 'vet', u_laura, v_laura, '10000001', now() - interval '340 days'),
    (p_toby, v_d - 90, 13.6, 'propietario', u_ana, 'Ana López (ejemplo)', null, now() - interval '90 days'),
    (p_max, v_d - 200, 8.9, 'vet', u_diego, v_diego, '10000002', now() - interval '200 days'),
    (p_kira, v_d - 200, 34.0, 'vet', u_laura, v_laura, '10000001', now() - interval '200 days'),
    (p_kira, v_d - 100, 35.2, 'vet', u_laura, v_laura, '10000001', now() - interval '100 days');

  -- ------------------------------ Consultas ------------------------------
  insert into public.consultations (id, pet_id, visit_date, reason, weight_kg, temperature_c, findings, diagnosis, treatment,
                                    owner_instructions, clinic_name, source, author_id, author_name, author_cedula, created_at) values
    (gen_random_uuid(), p_luna, v_d - 30, 'Prurito y lamido de patas', 31.6, 38.7,
     'Eritema interdigital en miembros anteriores. Sin lesiones en oídos. Condición corporal 6/9.',
     'Brote de dermatitis atópica',
     'Oclacitinib 16 mg VO cada 12 h por 14 días, después cada 24 h. Baño con clorhexidina al 2 % cada 3 días.',
     'Dale media tableta en la mañana y media en la noche durante 2 semanas; después solo una vez al día. Báñala cada 3 días con el champú indicado. Si se rasca hasta sangrar, avísanos.',
     v_clinic, 'vet', u_laura, v_laura, '10000001', now() - interval '30 days'),
    (gen_random_uuid(), p_luna, v_d - 363, 'Vacunación anual', 30.4, 38.5,
     'Paciente sano. Mucosas rosadas, ganglios normales.', 'Sana', 'Antirrábica.', 'Todo bien. Regresa en un año para su refuerzo.',
     v_clinic, 'vet', u_laura, v_laura, '10000001', now() - interval '363 days'),
    (gen_random_uuid(), p_michi, v_d - 14, 'Control renal trimestral', 4.8, 38.4,
     'Mucosas rosadas, hidratación adecuada. Pérdida de 300 g en 8 meses.',
     'Enfermedad renal crónica estable, estadio 2 (IRIS)',
     'Continuar dieta renal. Repetir creatinina y SDMA en 3 meses. Valorar presión arterial en la próxima visita.',
     'Sigue con su alimento renal y deja siempre agua fresca. Pésalo cada mes; si baja más de medio kilo o deja de comer un día, tráelo.',
     v_clinic, 'vet', u_laura, v_laura, '10000001', now() - interval '14 days'),
    (gen_random_uuid(), p_rocky, v_d - 60, 'Convulsión aislada', 22.3, 38.9,
     'Examen neurológico normal entre episodios. Química sanguínea sin alteraciones.',
     'Epilepsia idiopática', 'Fenobarbital 2.5 mg/kg VO cada 12 h. Niveles séricos en 30 días.',
     'Dale su pastilla cada 12 horas, siempre a la misma hora, y nunca la suspendas. Si convulsiona más de 5 minutos, ven de inmediato.',
     v_clinic, 'vet', u_diego, v_diego, '10000002', now() - interval '60 days'),
    (q_toby, p_toby, v_d - 3, 'Rascado y mal olor en oído derecho', 13.8, 39.1,
     'Conducto auditivo derecho eritematoso con secreción café. Citología: levaduras abundantes.',
     'Otitis externa por Malassezia',
     'Limpieza ótica y gotas de clotrimazol + gentamicina, 5 gotas cada 12 h por 10 días.',
     'Ponle 5 gotas en el oído derecho en la mañana y en la noche por 10 días, y masajea la base de la oreja. No uses cotonetes. Revisión hoy.',
     v_clinic, 'vet', v_me, v_me_name, v_me_ced, now() - interval '3 days'),
    (gen_random_uuid(), p_max, v_d - 100, 'Control de diabetes', 9.1, 38.6,
     'Glucemia 180 mg/dL. Fructosamina en rango. Sin cataratas.', 'Diabetes mellitus controlada',
     'Mantener insulina NPH 0.5 UI/kg cada 12 h.', 'Sigue con su insulina después de cada comida. Si lo ves muy decaído o tembloroso, dale miel en las encías y llámanos.',
     v_clinic, 'vet', u_diego, v_diego, '10000002', now() - interval '100 days'),
    (gen_random_uuid(), p_kira, v_d - 20, 'Revisión de cadera', 35.6, 38.3,
     'Dolor leve a la extensión de ambas caderas. Masa muscular conservada.',
     'Displasia de cadera, sin progresión aparente',
     'Condroprotector diario. Fisioterapia 2 veces por semana.',
     'Paseos cortos en pasto, sin saltos ni escaleras. Ayúdala a bajar unos kilos.',
     v_clinic, 'estudiante', u_sofia, v_sofia, null, now() - interval '20 days');

  -- ------------------------------- Anexos -------------------------------
  -- Los PDF los sube la aplicación a estas rutas justo después.
  insert into public.attachments (pet_id, kind, title, storage_path, mime_type, size_bytes, notes, source, author_id, author_name, author_cedula, created_at) values
    (p_luna, 'estudio', 'Hemograma y química sanguínea', p_luna || '/demo-hemograma.pdf', 'application/pdf', 2048,
     'Valores dentro de rango. Eosinófilos ligeramente elevados.', 'vet', u_laura, v_laura, '10000001', now() - interval '30 days'),
    (p_toby, 'estudio', 'Citología ótica', p_toby || '/demo-hemograma.pdf', 'application/pdf', 2048,
     'Levaduras compatibles con Malassezia.', 'vet', v_me, v_me_name, v_me_ced, now() - interval '3 days');

  -- ----------------------------- Membresías -----------------------------
  insert into public.memberships (pet_id, plan, status, current_period_end, provider) values
    (p_luna, 'anual', 'activa', now() + interval '200 days', 'demo'),
    (p_rocky, 'mensual', 'activa', now() + interval '12 days', 'demo'),
    (p_michi, 'mensual', 'cancelada', now() + interval '6 days', 'demo');

  perform set_config('scanpaw.demo_seed', 'off', true);
  return jsonb_build_object(
    'luna', p_luna, 'michi', p_michi, 'toby', p_toby,
    'luna_tag', v_luna_tag, 'rocky_tag', v_rocky_tag, 'new_tag', v_new_tag, 'new_code', v_new_code
  );
end;
$$;

revoke execute on function public.admin_reset_demo() from public, anon;
revoke execute on function public.admin_seed_demo() from public, anon;
grant execute on function public.admin_reset_demo() to authenticated;
grant execute on function public.admin_seed_demo() to authenticated;
grant execute on all functions in schema private to anon, authenticated;
-- Crear personas de demostración solo ocurre dentro de admin_seed_demo.
revoke execute on function private.demo_person(text, text, text, public.user_role) from public, anon, authenticated;
