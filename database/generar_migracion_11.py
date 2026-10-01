"""Genera migracion_11_seguridad_por_rol.sql y su marcha atrás.
Las funciones con guardia se envuelven (original -> *_impl) en vez de reescribirse."""
import os

AQUI = os.path.dirname(os.path.abspath(__file__))

WR = [  # nombre, argumentos (con defaults), resultado, nombres, guardia, escalar
    ('admin_delivery_pin', 'p_request_id uuid', 'text', ['p_request_id'], 'admin', True),
    ('resolver_retiro', 'p_retiro_id uuid, p_estado text, p_referencia text DEFAULT NULL::text, p_nota text DEFAULT NULL::text', 'payouts', ['p_retiro_id', 'p_estado', 'p_referencia', 'p_nota'], 'admin', True),
    ('revisar_documento', 'p_doc_id uuid, p_estado text, p_nota text DEFAULT NULL::text', 'courier_documents', ['p_doc_id', 'p_estado', 'p_nota'], 'admin', True),
    ('guardar_cuenta_retiro', 'p_courier_id uuid, p_metodo text, p_cuenta text', 'courier_profiles', ['p_courier_id', 'p_metodo', 'p_cuenta'], 'own', True),
    ('guardar_preferencias', 'p_courier_id uuid, p_zona text, p_horario text', 'courier_profiles', ['p_courier_id', 'p_zona', 'p_horario'], 'own', True),
    ('guardar_vehiculo', 'p_courier_id uuid, p_tipo text, p_placa text DEFAULT NULL::text, p_modelo text DEFAULT NULL::text, p_color text DEFAULT NULL::text, p_year integer DEFAULT NULL::integer', 'vehicles', ['p_courier_id', 'p_tipo', 'p_placa', 'p_modelo', 'p_color', 'p_year'], 'own', True),
    ('registrar_documento', 'p_courier_id uuid, p_doc_type text, p_path text, p_expires_at date DEFAULT NULL::date', 'courier_documents', ['p_courier_id', 'p_doc_type', 'p_path', 'p_expires_at'], 'own', True),
    ('saldo_repartidor', 'p_courier_id uuid', 'TABLE(ganado numeric, retirado numeric, pendiente numeric, disponible numeric, entregas integer)', ['p_courier_id'], 'own', False),
    ('solicitar_retiro', 'p_courier_id uuid, p_monto numeric, p_metodo text DEFAULT NULL::text, p_cuenta text DEFAULT NULL::text', 'TABLE(ok boolean, motivo text, retiro_id uuid, disponible numeric)', ['p_courier_id', 'p_monto', 'p_metodo', 'p_cuenta'], 'own', False),
]

CABECERA = """-- ============================================================
-- Domix — Migración 11: seguridad por rol
--
-- Hasta aquí las tres apps compartían la llave pública y las tablas
-- decían "using (true)": cualquiera con la llave leía y escribía todo.
-- Ahora la base sabe quién llama: cada app manda el token de sesión en
-- la cabecera x-domix-token y las políticas deciden por rol.
--
--   admin    -> todo
--   courier  -> su perfil, sus documentos/vehículo/pagos, los pedidos
--               abiertos y los suyos
--   anónimo  -> solo crear un pedido (crear_solicitud), seguirlo por su
--               código y ver "mis pedidos" por teléfono (RPCs)
--
-- Marcha atrás: database/migracion_11_rollback.sql
-- ============================================================

create or replace function public.domix_uid() returns uuid
language sql stable security definer set search_path = public as $$
  select s.profile_id
    from public.sessions s join public.profiles p on p.id = s.profile_id
   where s.token = nullif(current_setting('request.headers', true)::json ->> 'x-domix-token', '')
     and s.expires_at > now() and p.is_active
   limit 1;
$$;

create or replace function public.domix_rol() returns text
language sql stable security definer set search_path = public as $$
  select p.role
    from public.sessions s join public.profiles p on p.id = s.profile_id
   where s.token = nullif(current_setting('request.headers', true)::json ->> 'x-domix-token', '')
     and s.expires_at > now() and p.is_active
   limit 1;
$$;
grant execute on function public.domix_uid(), public.domix_rol() to anon, authenticated;

-- ---------- Pedidos del cliente invitado (sin tocar la tabla) ----------
create or replace function public.crear_solicitud(p jsonb) returns public.service_requests
language plpgsql security definer set search_path = public as $$
declare r public.service_requests;
begin
  r := jsonb_populate_record(null::public.service_requests, p);
  insert into public.service_requests (
    service_type, contact_name, contact_phone, description, pickup_address, dropoff_address,
    pickup_lat, pickup_lon, dropoff_lat, dropoff_lon, distance_km, price, price_breakdown,
    max_budget, payment_method, turbo, eta_minutes, source, branch_id, tip, status, is_demo)
  values (
    r.service_type, r.contact_name, r.contact_phone, r.description, r.pickup_address, r.dropoff_address,
    r.pickup_lat, r.pickup_lon, r.dropoff_lat, r.dropoff_lon, r.distance_km, r.price, r.price_breakdown,
    r.max_budget, coalesce(r.payment_method, 'cash'), coalesce(r.turbo, false), r.eta_minutes, coalesce(r.source, 'app'), r.branch_id,
    coalesce(r.tip, 0), 'requested', false)
  returning * into r;
  return r;
end $$;
grant execute on function public.crear_solicitud(jsonb) to anon, authenticated;

create or replace function public.mis_pedidos(p_phone text) returns setof public.service_requests
language sql stable security definer set search_path = public as $$
  select * from public.service_requests
   where contact_phone = p_phone and coalesce(p_phone, '') <> ''
   order by created_at desc limit 30;
$$;
grant execute on function public.mis_pedidos(text) to anon, authenticated;

-- ---------- Funciones con guardia de rol ----------
"""

POLITICAS = """
-- ---------- Políticas ----------
drop policy if exists "Acceso abierto a sedes (sin login, temporal)" on public.branches;
drop policy if exists "Acceso abierto a documentos (sin login, temporal)" on public.courier_documents;
drop policy if exists "Acceso abierto a perfiles de repartidor (sin login, temporal)" on public.courier_profiles;
drop policy if exists "Acceso abierto a pagos (sin login, temporal)" on public.payouts;
drop policy if exists "Acceso abierto a perfiles (sin login, temporal)" on public.profiles;
drop policy if exists "Acceso abierto a solicitudes (sin login, temporal)" on public.service_requests;
drop policy if exists "Acceso abierto a tracking (sin login, temporal)" on public.tracking_points;
drop policy if exists "Acceso abierto a vehiculos (sin login, temporal)" on public.vehicles;
drop policy if exists "Panel gestiona las conversaciones" on public.whatsapp_conversations;
drop policy if exists "Panel gestiona los mensajes" on public.whatsapp_messages;

create policy sr_admin on public.service_requests for all
  using (public.domix_rol() = 'admin') with check (public.domix_rol() = 'admin');
create policy sr_courier_leer on public.service_requests for select
  using (public.domix_rol() = 'courier' and (courier_id = public.domix_uid() or status = 'requested'));
create policy sr_courier_actualizar on public.service_requests for update
  using (public.domix_rol() = 'courier' and (courier_id = public.domix_uid() or (status = 'requested' and courier_id is null)))
  with check (public.domix_rol() = 'courier' and courier_id = public.domix_uid());

create policy prof_admin on public.profiles for all
  using (public.domix_rol() = 'admin') with check (public.domix_rol() = 'admin');
create policy prof_propio on public.profiles for select using (id = public.domix_uid());

create policy cp_admin on public.courier_profiles for all
  using (public.domix_rol() = 'admin') with check (public.domix_rol() = 'admin');
create policy cp_propio_leer on public.courier_profiles for select using (id = public.domix_uid());
create policy cp_propio_actualizar on public.courier_profiles for update
  using (id = public.domix_uid() and public.domix_rol() = 'courier')
  with check (id = public.domix_uid());

create policy pay_admin on public.payouts for all
  using (public.domix_rol() = 'admin') with check (public.domix_rol() = 'admin');
create policy pay_propio on public.payouts for select using (courier_id = public.domix_uid());

create policy doc_admin on public.courier_documents for all
  using (public.domix_rol() = 'admin') with check (public.domix_rol() = 'admin');
create policy doc_propio on public.courier_documents for select using (courier_id = public.domix_uid());

create policy veh_admin on public.vehicles for all
  using (public.domix_rol() = 'admin') with check (public.domix_rol() = 'admin');
create policy veh_propio on public.vehicles for select using (courier_id = public.domix_uid());

create policy br_admin on public.branches for all
  using (public.domix_rol() = 'admin') with check (public.domix_rol() = 'admin');
create policy br_leer on public.branches for select using (public.domix_rol() in ('admin', 'courier'));

create policy tp_admin on public.tracking_points for all
  using (public.domix_rol() = 'admin') with check (public.domix_rol() = 'admin');
create policy wc_admin on public.whatsapp_conversations for all
  using (public.domix_rol() = 'admin') with check (public.domix_rol() = 'admin');
create policy wm_admin on public.whatsapp_messages for all
  using (public.domix_rol() = 'admin') with check (public.domix_rol() = 'admin');

alter view public.retiros_pendientes set (security_invoker = true);

-- ---------- Un repartidor no puede tocar lo que no es suyo ----------
create or replace function public.proteger_pedido() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and public.domix_rol() is distinct from 'admin' then
    if new.status = 'delivered' and old.status is distinct from 'delivered' then
      raise exception 'La entrega se confirma con el PIN' using errcode = '42501';
    end if;
    if (new.price, new.tip, new.tracking_code, new.service_type, new.contact_phone, new.pickup_address, new.dropoff_address, new.branch_id, new.client_id)
       is distinct from
       (old.price, old.tip, old.tracking_code, old.service_type, old.contact_phone, old.pickup_address, old.dropoff_address, old.branch_id, old.client_id) then
      raise exception 'Campo no editable' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_proteger_pedido on public.service_requests;
create trigger trg_proteger_pedido before update on public.service_requests
  for each row execute function public.proteger_pedido();

create or replace function public.proteger_repartidor() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and public.domix_rol() is distinct from 'admin' then
    if (new.is_active, new.rating, new.total_deliveries, new.branch_id, new.payout_method, new.payout_account, new.document_id, new.work_zone, new.preferred_schedule)
       is distinct from
       (old.is_active, old.rating, old.total_deliveries, old.branch_id, old.payout_method, old.payout_account, old.document_id, old.work_zone, old.preferred_schedule) then
      raise exception 'Campo no editable' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_proteger_repartidor on public.courier_profiles;
create trigger trg_proteger_repartidor before update on public.courier_profiles
  for each row execute function public.proteger_repartidor();

-- ---------- Archivos: solo quien tiene sesión ----------
drop policy if exists "Domix lee documentos" on storage.objects;
drop policy if exists "Domix reemplaza documentos" on storage.objects;
drop policy if exists "Domix sube documentos" on storage.objects;
create policy "Domix lee documentos" on storage.objects for select
  using (bucket_id = 'documentos' and public.domix_rol() in ('admin', 'courier'));
create policy "Domix sube documentos" on storage.objects for insert
  with check (bucket_id = 'documentos' and public.domix_rol() in ('admin', 'courier'));
create policy "Domix reemplaza documentos" on storage.objects for update
  using (bucket_id = 'documentos' and public.domix_rol() in ('admin', 'courier'));
"""

ATRAS = """
drop trigger if exists trg_proteger_pedido on public.service_requests;
drop trigger if exists trg_proteger_repartidor on public.courier_profiles;
alter view public.retiros_pendientes reset (security_invoker);
do $$ declare t text; p record; begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
  foreach t in array array['branches','courier_documents','courier_profiles','payouts','profiles','service_requests','tracking_points','vehicles','whatsapp_conversations','whatsapp_messages'] loop
    execute format('create policy "abierto temporal" on public.%I for all using (true) with check (true)', t);
  end loop;
end $$;
drop policy if exists "Domix lee documentos" on storage.objects;
drop policy if exists "Domix reemplaza documentos" on storage.objects;
drop policy if exists "Domix sube documentos" on storage.objects;
create policy "Domix lee documentos" on storage.objects for select using (bucket_id = 'documentos');
create policy "Domix sube documentos" on storage.objects for insert with check (bucket_id = 'documentos');
create policy "Domix reemplaza documentos" on storage.objects for update using (bucket_id = 'documentos');
"""


def firma(args):
    return ', '.join(a.split(' DEFAULT')[0] for a in args.split(', '))


up = [CABECERA]
down = ['-- Marcha atrás de la migración 11: vuelve al acceso abierto temporal']
for n, args, res, names, g, esc in WR:
    guardia = ("public.domix_rol() = 'admin'" if g == 'admin' else
               f"(public.domix_rol() = 'admin' or (public.domix_rol() = 'courier' and public.domix_uid() = {names[0]}))")
    llamada = f"public.{n}_impl({', '.join(names)})"
    cuerpo = f"return {llamada};" if esc else f"return query select * from {llamada};"
    up.append(f"""alter function public.{n} rename to {n}_impl;
revoke all on function public.{n}_impl from public, anon, authenticated;
create function public.{n}({args}) returns {res}
language plpgsql security definer set search_path = public as $$
begin
  if not {guardia} then raise exception 'no autorizado' using errcode = '42501'; end if;
  {cuerpo}
end $$;
grant execute on function public.{n} to anon, authenticated;
""")
    down.append(f"drop function if exists public.{n}({firma(args)});\n"
                f"alter function public.{n}_impl rename to {n};\n"
                f"grant execute on function public.{n} to anon, authenticated;")
up.append(POLITICAS)
down.append(ATRAS)
open(os.path.join(AQUI, 'migracion_11_seguridad_por_rol.sql'), 'w', encoding='utf8').write('\n'.join(up))
open(os.path.join(AQUI, 'migracion_11_rollback.sql'), 'w', encoding='utf8').write('\n'.join(down))
print('ok')
