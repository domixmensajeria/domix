-- ==============================================================================
-- MIGRACIÓN 17: MODELO DE LIQUIDACIÓN 70% REPARTIDOR / CONDUCTOR - 30% DOMIX
-- ==============================================================================
-- Regla de negocio:
-- Por cada servicio (ej. $10.000 COP):
-- - 70% ($7.000 COP) para el repartidor/conductor + 100% de la propina.
-- - 30% ($3.000 COP) para la plataforma Domix.
-- Si el pago fue en efectivo (cash): el repartidor recaudó el 100% en mano,
-- por lo que debe el 30% a la plataforma.
-- Si el pago fue digital (transfer / wallet): Domix recaudó el dinero,
-- por lo que Domix le transfiere el 70% + propinas.

CREATE OR REPLACE FUNCTION public.saldo_repartidor_impl(p_courier_id uuid)
RETURNS TABLE (
    ganado      numeric,
    retirado    numeric,
    pendiente   numeric,
    disponible  numeric,
    entregas    integer
) AS $fn$
DECLARE
    v_ganado_total      numeric := 0;
    v_saldo_a_favor     numeric := 0;
    v_entregas          integer := 0;
    v_pagado            numeric := 0;
    v_en_curso          numeric := 0;
BEGIN
    SELECT
        COALESCE(SUM(ROUND(COALESCE(price, 0) * 0.70) + COALESCE(tip, 0)), 0),
        COALESCE(SUM(
            CASE
                WHEN payment_method IN ('transfer', 'wallet')
                    THEN (ROUND(COALESCE(price, 0) * 0.70) + COALESCE(tip, 0))
                WHEN payment_method = 'cash' OR payment_method IS NULL
                    THEN - (ROUND(COALESCE(price, 0) * 0.30))
                ELSE 0
            END
        ), 0),
        COUNT(*)::int
    INTO v_ganado_total, v_saldo_a_favor, v_entregas
    FROM public.service_requests
    WHERE courier_id = p_courier_id AND status = 'delivered';

    -- Pagos y retiros solicitados
    SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = 'paid'), 0),
        COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)
    INTO v_pagado, v_en_curso
    FROM public.payouts
    WHERE courier_id = p_courier_id;

    RETURN QUERY SELECT
        v_ganado_total,
        v_pagado,
        v_en_curso,
        GREATEST(0, v_saldo_a_favor - v_pagado - v_en_curso),
        v_entregas;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.saldo_repartidor(p_courier_id uuid)
RETURNS TABLE(ganado numeric, retirado numeric, pendiente numeric, disponible numeric, entregas integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.saldo_repartidor_impl(p_courier_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.saldo_repartidor(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.saldo_repartidor_impl(uuid) TO anon, authenticated;
