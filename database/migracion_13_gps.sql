-- Migración 13: historial de ruta. El repartidor puede registrar sus puntos
-- (solo los suyos, solo en pedidos que tiene asignados) y el admin los lee.
create policy tp_courier_insert on public.tracking_points for insert
  with check (public.domix_rol() = 'courier' and courier_id = public.domix_uid());
create index if not exists tracking_points_request_idx on public.tracking_points (request_id, recorded_at);
