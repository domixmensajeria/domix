-- Migración 12: documentos solo del dueño y piso de precio en el servidor.

drop policy if exists "Domix lee documentos" on storage.objects;
drop policy if exists "Domix sube documentos" on storage.objects;
drop policy if exists "Domix reemplaza documentos" on storage.objects;
create policy "Domix lee documentos" on storage.objects for select using (
  bucket_id = 'documentos' and (public.domix_rol() = 'admin'
    or (public.domix_rol() = 'courier' and (storage.foldername(name))[1] = public.domix_uid()::text)));
create policy "Domix sube documentos" on storage.objects for insert with check (
  bucket_id = 'documentos' and (public.domix_rol() = 'admin'
    or (public.domix_rol() = 'courier' and (storage.foldername(name))[1] = public.domix_uid()::text)));
create policy "Domix reemplaza documentos" on storage.objects for update using (
  bucket_id = 'documentos' and (public.domix_rol() = 'admin'
    or (public.domix_rol() = 'courier' and (storage.foldername(name))[1] = public.domix_uid()::text)));

create or replace function public.crear_solicitud(p jsonb) returns public.service_requests
language plpgsql security definer set search_path = public as $$
declare r public.service_requests; piso numeric;
begin
  r := jsonb_populate_record(null::public.service_requests, p);
  piso := 6000 + greatest(0, coalesce(r.distance_km, 0) - 2) * 1200;
  if r.price is null or r.price < floor(piso * 0.95 / 100) * 100 or r.price > 1000000 then
    raise exception 'Precio no válido' using errcode = '22023';
  end if;
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
