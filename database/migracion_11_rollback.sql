-- Marcha atrás de la migración 11: vuelve al acceso abierto temporal
drop function if exists public.admin_delivery_pin(p_request_id uuid);
alter function public.admin_delivery_pin_impl rename to admin_delivery_pin;
grant execute on function public.admin_delivery_pin to anon, authenticated;
drop function if exists public.resolver_retiro(p_retiro_id uuid, p_estado text, p_referencia text, p_nota text);
alter function public.resolver_retiro_impl rename to resolver_retiro;
grant execute on function public.resolver_retiro to anon, authenticated;
drop function if exists public.revisar_documento(p_doc_id uuid, p_estado text, p_nota text);
alter function public.revisar_documento_impl rename to revisar_documento;
grant execute on function public.revisar_documento to anon, authenticated;
drop function if exists public.guardar_cuenta_retiro(p_courier_id uuid, p_metodo text, p_cuenta text);
alter function public.guardar_cuenta_retiro_impl rename to guardar_cuenta_retiro;
grant execute on function public.guardar_cuenta_retiro to anon, authenticated;
drop function if exists public.guardar_preferencias(p_courier_id uuid, p_zona text, p_horario text);
alter function public.guardar_preferencias_impl rename to guardar_preferencias;
grant execute on function public.guardar_preferencias to anon, authenticated;
drop function if exists public.guardar_vehiculo(p_courier_id uuid, p_tipo text, p_placa text, p_modelo text, p_color text, p_year integer);
alter function public.guardar_vehiculo_impl rename to guardar_vehiculo;
grant execute on function public.guardar_vehiculo to anon, authenticated;
drop function if exists public.registrar_documento(p_courier_id uuid, p_doc_type text, p_path text, p_expires_at date);
alter function public.registrar_documento_impl rename to registrar_documento;
grant execute on function public.registrar_documento to anon, authenticated;
drop function if exists public.saldo_repartidor(p_courier_id uuid);
alter function public.saldo_repartidor_impl rename to saldo_repartidor;
grant execute on function public.saldo_repartidor to anon, authenticated;
drop function if exists public.solicitar_retiro(p_courier_id uuid, p_monto numeric, p_metodo text, p_cuenta text);
alter function public.solicitar_retiro_impl rename to solicitar_retiro;
grant execute on function public.solicitar_retiro to anon, authenticated;

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
