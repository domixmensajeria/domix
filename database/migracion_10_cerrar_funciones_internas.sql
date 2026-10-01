-- ============================================================
-- Domix — Migración 10: cerrar funciones que ninguna app usa
--
-- Revisando el sistema de punta a punta se probó qué puede hacer la
-- llave pública (la anon, que viaja en cada página). Las tablas de
-- claves, PIN y sesiones estaban cerradas, pero estas tres funciones
-- seguían abiertas a cualquiera que tuviera esa llave:
--
--   asignar_clave        -> cambiarle la clave a CUALQUIER usuario
--                           (incluido el admin del panel). Los ids de
--                           perfil se pueden listar con la misma llave,
--                           así que era una toma de cuenta completa.
--   limpiar_sesiones     -> mantenimiento interno
--   marcar_documentos_por_vencer -> mantenimiento interno
--
-- Ninguna de las tres la llama una app (se verificó con grep en las
-- tres), así que cerrarlas no rompe nada: se siguen pudiendo correr
-- desde el SQL editor o la API de gestión, que no pasan por la llave
-- pública.
--
-- Lo que NO resuelve esto: las demás funciones y tablas siguen
-- abiertas por diseño (los 3 apps usan la misma llave pública y las
-- políticas son "using (true)"). Cerrarlas de verdad exige que la
-- base conozca el rol de quien llama — ver el plan de seguridad por rol.
-- ============================================================

revoke all on function public.asignar_clave(uuid, text)         from public, anon, authenticated;
revoke all on function public.limpiar_sesiones()                from public, anon, authenticated;
revoke all on function public.marcar_documentos_por_vencer()    from public, anon, authenticated;
