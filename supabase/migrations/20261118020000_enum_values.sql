-- =====================================================================
-- Scan-Paw · Valores nuevos de enums
-- Van en su propia migración: un valor agregado con ADD VALUE no puede
-- usarse dentro de la misma transacción en la que se crea.
-- =====================================================================

-- Entradas del expediente registradas por estudiantes ("No profesionista").
alter type public.record_source add value if not exists 'estudiante';

-- Acceso extendido automáticamente hasta la fecha de una cita.
alter type public.access_source add value if not exists 'cita';
