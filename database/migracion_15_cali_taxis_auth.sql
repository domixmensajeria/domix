-- ==============================================================================
-- MIGRACIÓN 15: TAXIS (SERVICIO ESPECIAL), TRANSPORTE INTERMUNICIPAL PLACA BLANCA
-- (CALI <-> BUENAVENTURA), MANDADOS DETALLADOS, PLAYEROS Y VERIFICACIÓN EMAIL
-- ==============================================================================

-- 1. MEJORAS EN TAXIS Y SOLICITUDES DE SERVICIO (service_requests)
-- Ampliar tipos de servicio permitidos
ALTER TABLE public.service_requests 
  DROP CONSTRAINT IF EXISTS service_requests_service_type_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_service_type_check 
    CHECK (service_type IN ('mensajeria', 'encomienda', 'domicilio', 'mandado', 'taxi', 'placa_blanca', 'intermunicipal_encomienda'));

-- Añadir campos para servicio especial de taxi e instrucciones detalladas
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS servicio_especial TEXT DEFAULT 'ninguno',
  ADD COLUMN IF NOT EXISTS instrucciones_detalladas TEXT,
  ADD COLUMN IF NOT EXISTS cliente_email TEXT;

-- 2. AMPLIAR VEHÍCULOS (vehicles)
ALTER TABLE public.vehicles
  DROP CONSTRAINT IF EXISTS vehicles_vehicle_type_check;

ALTER TABLE public.vehicles
  ADD CONSTRAINT vehicles_vehicle_type_check
    CHECK (vehicle_type IN ('moto', 'bicicleta', 'a_pie', 'carro', 'taxi', 'placa_blanca'));

-- Campos en profiles y courier_profiles para identificación completa y email
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS email_confirmado BOOLEAN DEFAULT false;

-- 3. VERIFICACIÓN DE EMAIL (REFERENCIA MODELO TURABARBER CON RESEND)
CREATE TABLE IF NOT EXISTS public.auth_verificaciones_email (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    telefono TEXT,
    codigo_verificacion TEXT NOT NULL, -- 6 dígitos
    token_enlace TEXT UNIQUE NOT NULL,
    rol TEXT NOT NULL DEFAULT 'client' CHECK (rol IN ('client', 'courier', 'driver_taxi', 'driver_placa_blanca', 'admin')),
    confirmado BOOLEAN NOT NULL DEFAULT false,
    confirmado_at TIMESTAMPTZ,
    intentos INTEGER NOT NULL DEFAULT 0,
    expira_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_verif_email ON public.auth_verificaciones_email(email);
CREATE INDEX IF NOT EXISTS idx_auth_verif_token ON public.auth_verificaciones_email(token_enlace);

ALTER TABLE public.auth_verificaciones_email ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso abierto a verificaciones email" ON public.auth_verificaciones_email;
CREATE POLICY "Acceso abierto a verificaciones email" ON public.auth_verificaciones_email FOR ALL USING (true) WITH CHECK (true);

-- 4. TRANSPORTE INTERMUNICIPAL PLACA BLANCA (BUENAVENTURA <-> CALI)
-- Salidas por turnos (mínimo 3 pasajeros para salir)
CREATE TABLE IF NOT EXISTS public.cali_salidas (
    id BIGSERIAL PRIMARY KEY,
    conductor_id UUID REFERENCES public.courier_profiles(id),
    placa TEXT NOT NULL,
    origen TEXT NOT NULL DEFAULT 'Buenaventura' CHECK (origen IN ('Buenaventura', 'Cali')),
    destino TEXT NOT NULL DEFAULT 'Cali' CHECK (destino IN ('Buenaventura', 'Cali')),
    hora_programada TIMESTAMPTZ NOT NULL,
    puestos_totales INTEGER NOT NULL DEFAULT 4,
    puestos_ocupados INTEGER NOT NULL DEFAULT 0,
    minimo_pasajeros INTEGER NOT NULL DEFAULT 3,
    precio_por_puesto NUMERIC NOT NULL DEFAULT 60000,
    estado TEXT NOT NULL DEFAULT 'programada'
      CHECK (estado IN ('programada', 'en_turno', 'esperando_cupo', 'lista_para_salir', 'en_ruta', 'completada', 'cancelada')),
    playero_nombre TEXT,
    playero_telefono TEXT,
    comision_playero NUMERIC NOT NULL DEFAULT 10000,
    comision_playero_pagada BOOLEAN NOT NULL DEFAULT false,
    salida_real_at TIMESTAMPTZ,
    llegada_real_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reservas de puestos por pasajero
CREATE TABLE IF NOT EXISTS public.cali_reservas (
    id BIGSERIAL PRIMARY KEY,
    salida_id BIGINT REFERENCES public.cali_salidas(id) ON DELETE CASCADE,
    pasajero_nombre TEXT NOT NULL,
    pasajero_telefono TEXT NOT NULL,
    pasajero_email TEXT,
    puesto_numero INTEGER NOT NULL CHECK (puesto_numero BETWEEN 1 AND 8),
    abono_pagado NUMERIC NOT NULL DEFAULT 18000, -- 30%
    saldo_pendiente NUMERIC NOT NULL DEFAULT 42000,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
    estado TEXT NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('confirmada', 'trasladada', 'abordado', 'cancelada')),
    salida_anterior_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Encomiendas intermunicipales Cali <-> Buenaventura
CREATE TABLE IF NOT EXISTS public.cali_encomiendas (
    id BIGSERIAL PRIMARY KEY,
    tipo_ruta TEXT NOT NULL CHECK (tipo_ruta IN ('enviar_a_cali', 'traer_de_cali')),
    remitente_nombre TEXT NOT NULL,
    remitente_telefono TEXT NOT NULL,
    remitente_email TEXT,
    destinatario_nombre TEXT NOT NULL,
    destinatario_telefono TEXT NOT NULL,
    direccion_recogida TEXT NOT NULL,
    direccion_entrega TEXT NOT NULL,
    descripcion_paquete TEXT NOT NULL,
    declarado_valor NUMERIC DEFAULT 0,
    tarifa_envio NUMERIC NOT NULL DEFAULT 25000,
    conductor_id UUID REFERENCES public.courier_profiles(id),
    salida_id BIGINT REFERENCES public.cali_salidas(id),
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'asignada', 'recolectada', 'en_transito', 'entregada', 'cancelada')),
    codigo_entrega TEXT NOT NULL DEFAULT substring(md5(random()::text) from 1 for 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS abiertas
ALTER TABLE public.cali_salidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cali_reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cali_encomiendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso salidas cali" ON public.cali_salidas;
CREATE POLICY "Acceso salidas cali" ON public.cali_salidas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso reservas cali" ON public.cali_reservas;
CREATE POLICY "Acceso reservas cali" ON public.cali_reservas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso encomiendas cali" ON public.cali_encomiendas;
CREATE POLICY "Acceso encomiendas cali" ON public.cali_encomiendas FOR ALL USING (true) WITH CHECK (true);

-- 5. FUNCIÓN ATÓMICA DE TRASLADO DE PASAJERO ENTRE VEHÍCULOS
CREATE OR REPLACE FUNCTION public.trasladar_pasajero_cali(
    p_reserva_id BIGINT,
    p_nueva_salida_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reserva RECORD;
    v_salida_origen RECORD;
    v_salida_destino RECORD;
    v_nuevo_puesto INTEGER;
BEGIN
    SELECT * INTO v_reserva FROM public.cali_reservas WHERE id = p_reserva_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reserva no encontrada';
    END IF;

    SELECT * INTO v_salida_origen FROM public.cali_salidas WHERE id = v_reserva.salida_id FOR UPDATE;
    SELECT * INTO v_salida_destino FROM public.cali_salidas WHERE id = p_nueva_salida_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Salida de destino no encontrada';
    END IF;

    IF v_salida_destino.puestos_ocupados >= v_salida_destino.puestos_totales THEN
        RAISE EXCEPTION 'El vehículo de destino (placa %) no tiene cupos disponibles', v_salida_destino.placa;
    END IF;

    v_nuevo_puesto := v_salida_destino.puestos_ocupados + 1;

    UPDATE public.cali_reservas
       SET salida_id = p_nueva_salida_id,
           salida_anterior_id = v_salida_origen.id,
           puesto_numero = v_nuevo_puesto,
           estado = 'confirmada'
     WHERE id = p_reserva_id;

    UPDATE public.cali_salidas
       SET puestos_ocupados = GREATEST(0, puestos_ocupados - 1)
     WHERE id = v_salida_origen.id;

    UPDATE public.cali_salidas
       SET puestos_ocupados = puestos_ocupados + 1,
           estado = CASE 
                      WHEN (puestos_ocupados + 1) >= minimo_pasajeros THEN 'lista_para_salir'
                      ELSE estado
                    END
     WHERE id = v_salida_destino.id;

    RETURN jsonb_build_object(
        'success', true,
        'reserva_id', p_reserva_id,
        'nueva_salida_id', p_nueva_salida_id,
        'nueva_placa', v_salida_destino.placa,
        'nuevo_puesto', v_nuevo_puesto,
        'mensaje', 'Pasajero trasladado exitosamente al vehículo ' || v_salida_destino.placa
    );
END;
$$;

-- 6. FUNCIÓN DE LIQUIDACIÓN DE COMISIÓN PARA PLAYEROS
CREATE OR REPLACE FUNCTION public.liquidar_playero(
    p_salida_id BIGINT,
    p_playero_nombre TEXT,
    p_monto NUMERIC DEFAULT 10000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.cali_salidas
       SET playero_nombre = COALESCE(p_playero_nombre, playero_nombre),
           comision_playero = p_monto,
           comision_playero_pagada = true
     WHERE id = p_salida_id;

    RETURN jsonb_build_object(
        'success', true,
        'salida_id', p_salida_id,
        'playero', p_playero_nombre,
        'comision_liquidada', p_monto,
        'fecha', now()
    );
END;
$$;

-- PERMISOS
GRANT EXECUTE ON FUNCTION public.trasladar_pasajero_cali(BIGINT, BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.liquidar_playero(BIGINT, TEXT, NUMERIC) TO anon, authenticated;
