-- ==============================================================================
-- MIGRACIÓN 16: DATOS COMPLETOS DE CONDUCTOR (CÉDULA, PLACA, MODELO),
-- SERVICIO ESPECIAL DE TAXI E INSTRUCCIONES DETALLADAS EN TRACKING
-- ==============================================================================

DROP FUNCTION IF EXISTS public.track_service_request(text);

CREATE OR REPLACE FUNCTION public.track_service_request(p_tracking_code text)
RETURNS TABLE (
    id uuid,
    tracking_code text,
    service_type text,
    status text,
    turbo boolean,
    price numeric,
    eta_minutes integer,
    pickup_address text,
    dropoff_address text,
    pickup_lat double precision,
    pickup_lon double precision,
    dropoff_lat double precision,
    dropoff_lon double precision,
    courier_name text,
    courier_phone text,
    courier_cedula text,
    vehicle_plate text,
    vehicle_model text,
    vehicle_type text,
    servicio_especial text,
    instrucciones_detalladas text,
    description text,
    courier_lat double precision,
    courier_lon double precision,
    delivery_pin text,
    created_at timestamp with time zone
) AS $$
    SELECT
        sr.id, 
        sr.tracking_code, 
        sr.service_type, 
        sr.status, 
        sr.turbo, 
        sr.price, 
        sr.eta_minutes,
        sr.pickup_address, 
        sr.dropoff_address,
        sr.pickup_lat, 
        sr.pickup_lon, 
        sr.dropoff_lat, 
        sr.dropoff_lon,
        COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), 
            p.first_name, 
            'Conductor Asignado'
        ) AS courier_name,
        p.phone_number AS courier_phone,
        COALESCE(cp.document_id, 'Verificado') AS courier_cedula,
        COALESCE(v.plate, 'Por asignar') AS vehicle_plate,
        v.model AS vehicle_model,
        COALESCE(v.vehicle_type, sr.service_type) AS vehicle_type,
        COALESCE(sr.servicio_especial, 'ninguno') AS servicio_especial,
        sr.instrucciones_detalladas,
        sr.description,
        cp.last_lat AS courier_lat, 
        cp.last_lon AS courier_lon,
        dp.pin AS delivery_pin,
        sr.created_at
    FROM public.service_requests sr
    LEFT JOIN public.courier_profiles cp ON cp.id = sr.courier_id
    LEFT JOIN public.profiles p ON p.id = cp.id
    LEFT JOIN LATERAL (
        SELECT plate, model, vehicle_type 
        FROM public.vehicles 
        WHERE courier_id = cp.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) v ON true
    LEFT JOIN public.delivery_pins dp ON dp.request_id = sr.id
    WHERE sr.tracking_code = p_tracking_code;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.track_service_request(text) TO anon, authenticated;
