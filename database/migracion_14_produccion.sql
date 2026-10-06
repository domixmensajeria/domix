-- ============================================================
-- Domix — Migración 14: Correcciones Críticas de Producción
--
-- 1. Liquidaciones y Finanzas:
--    - Calcula la comisión de Domix (80% repartidor / 20% Domix).
--    - Discrimina pagos en efectivo de transferencias: el efectivo
--      cobrado en mano no se suma al saldo por retirar (el repartidor
--      ya tiene el dinero físico).
--
-- 2. Seguridad en Entrega:
--    - confirm_delivery exige que quien confirme sea el repartidor
--      asignado a ese pedido (o el administrador).
--
-- 3. Gestión de Claves desde el Panel:
--    - admin_asignar_clave permite al administrador asignar o cambiar
--      la contraseña de cualquier usuario (p. ej. nuevos repartidores).
--
-- 4. Tarifas Dinámicas y Cobertura:
--    - branches es legible por anónimos (para que cliente-app cotice
--      con las tarifas de la sede).
--    - guardar_tarifas_sede permite al admin actualizar las reglas.
-- ============================================================

-- ---------- 1. Liquidación justa y segura ----------
create or replace function public.saldo_repartidor_impl(p_courier_id uuid)
returns table (
    ganado      numeric,
    retirado    numeric,
    pendiente   numeric,
    disponible  numeric,
    entregas    integer
) as $fn$
declare
    v_ganado_total      numeric := 0;
    v_saldo_a_favor     numeric := 0;
    v_entregas          integer := 0;
    v_pagado            numeric := 0;
    v_en_curso          numeric := 0;
begin
    -- Ganancias del repartidor (80% de tarifa + 100% de propina)
    -- y saldo neto a favor teniendo en cuenta método de pago:
    --   - transfer / wallet: Domix recaudó el dinero, Domix le debe el 80% + tip.
    --   - cash: el repartidor cobró el 100% en mano; le debe el 20% a Domix.
    select
        coalesce(sum(round(coalesce(price, 0) * 0.80) + coalesce(tip, 0)), 0),
        coalesce(sum(
            case
                when payment_method in ('transfer', 'wallet')
                    then (round(coalesce(price, 0) * 0.80) + coalesce(tip, 0))
                when payment_method = 'cash' or payment_method is null
                    then - (round(coalesce(price, 0) * 0.20))
                else 0
            end
        ), 0),
        count(*)::int
    into v_ganado_total, v_saldo_a_favor, v_entregas
    from public.service_requests
    where courier_id = p_courier_id and status = 'delivered';

    -- Pagos y retiros
    select
        coalesce(sum(amount) filter (where status = 'paid'), 0),
        coalesce(sum(amount) filter (where status = 'pending'), 0)
    into v_pagado, v_en_curso
    from public.payouts
    where courier_id = p_courier_id;

    return query select
        v_ganado_total,
        v_pagado,
        v_en_curso,
        greatest(0, v_saldo_a_favor - v_pagado - v_en_curso),
        v_entregas;
end;
$fn$ language plpgsql security definer stable;

-- Actualizar wrapper de seguridad
create or replace function public.saldo_repartidor(p_courier_id uuid)
returns TABLE(ganado numeric, retirado numeric, pendiente numeric, disponible numeric, entregas integer)
language plpgsql security definer set search_path = public as $$
begin
  if not (public.domix_rol() = 'admin' or (public.domix_rol() = 'courier' and public.domix_uid() = p_courier_id)) then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  return query select * from public.saldo_repartidor_impl(p_courier_id);
end $$;
grant execute on function public.saldo_repartidor to anon, authenticated;


-- ---------- 2. Seguridad en confirm_delivery ----------
create or replace function public.confirm_delivery(p_request_id uuid, p_pin text)
returns table (ok boolean, motivo text, intentos integer) as $$
declare
    v_pin text;
    v_attempts integer;
    v_status text;
    v_courier_id uuid;
begin
    select dp.pin, dp.attempts, sr.status, sr.courier_id
      into v_pin, v_attempts, v_status, v_courier_id
    from public.delivery_pins dp
    join public.service_requests sr on sr.id = dp.request_id
    where dp.request_id = p_request_id;

    if v_pin is null then
        return query select false, 'pedido_no_encontrado'::text, 0::integer;
        return;
    end if;

    -- Validar que quien confirma sea el repartidor asignado o el administrador
    if not (public.domix_rol() = 'admin' or (public.domix_rol() = 'courier' and public.domix_uid() = v_courier_id)) then
        return query select false, 'no_autorizado'::text, v_attempts;
        return;
    end if;

    if v_status = 'delivered' then
        return query select true, 'ya_entregado'::text, v_attempts;
        return;
    end if;

    if v_status not in ('in_progress', 'picked_up', 'assigned') then
        return query select false, 'estado_invalido'::text, v_attempts;
        return;
    end if;

    if v_attempts >= 5 then
        return query select false, 'bloqueado'::text, v_attempts;
        return;
    end if;

    if v_pin <> trim(p_pin) then
        update public.delivery_pins
           set attempts = attempts + 1
         where request_id = p_request_id;
        return query select false, 'pin_incorrecto'::text, v_attempts + 1;
        return;
    end if;

    update public.service_requests
       set status = 'delivered', delivered_at = timezone('utc'::text, now())
     where id = p_request_id;

    update public.delivery_pins
       set confirmed_at = timezone('utc'::text, now())
     where request_id = p_request_id;

    return query select true, 'entregado'::text, v_attempts;
end;
$$ language plpgsql security definer;
grant execute on function public.confirm_delivery(uuid, text) to anon, authenticated;


-- ---------- 3. Asignación de contraseñas por el Administrador ----------
create or replace function public.admin_asignar_clave(p_profile_id uuid, p_clave text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
    if public.domix_rol() is distinct from 'admin' then
        raise exception 'no autorizado' using errcode = '42501';
    end if;
    if length(trim(p_clave)) < 6 then
        raise exception 'La clave debe tener al menos 6 caracteres' using errcode = '22023';
    end if;
    insert into public.auth_credentials (profile_id, password_hash)
    values (p_profile_id, crypt(trim(p_clave), gen_salt('bf', 10)))
    on conflict (profile_id) do update
        set password_hash = excluded.password_hash,
            failed_attempts = 0,
            locked_until = null,
            updated_at = now();
    return true;
end $$;
grant execute on function public.admin_asignar_clave(uuid, text) to anon, authenticated;


-- ---------- 4. Tarifas y Cobertura abiertas a Consulta Pública ----------
drop policy if exists br_leer on public.branches;
create policy br_leer on public.branches for select using (true);

create or replace function public.guardar_tarifas_sede(p_branch_id uuid, p_rules jsonb)
returns public.branches
language plpgsql security definer set search_path = public as $$
declare
    v_b public.branches;
begin
    if public.domix_rol() is distinct from 'admin' then
        raise exception 'no autorizado' using errcode = '42501';
    end if;
    update public.branches
       set pricing_rules = p_rules
     where id = p_branch_id
    returning * into v_b;
    return v_b;
end $$;
grant execute on function public.guardar_tarifas_sede(uuid, jsonb) to anon, authenticated;
