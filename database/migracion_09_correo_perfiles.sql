-- ============================================================
-- Domix — Migración 09: la columna que faltaba en el historial
--
-- iniciar_sesion() (migración 05) siempre buscó por celular O por
-- correo: "where phone_number = ... or lower(email) = ...". Pero
-- ninguna migración creó nunca la columna email — se agregó a mano en
-- el proyecto original durante el desarrollo, y esa migración nunca
-- quedó escrita. Postgres no valida las columnas de un cuerpo
-- plpgsql al crear la función, solo al ejecutarla, así que el
-- CREATE FUNCTION pasaba sin quejarse y el hueco quedó invisible
-- hasta armar un proyecto nuevo desde cero.
-- ============================================================

alter table public.profiles add column if not exists email text;

create unique index if not exists profiles_email_unico
    on public.profiles (lower(email))
    where email is not null;
