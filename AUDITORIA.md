# Auditoría Domix — 1 de octubre de 2026

Estado: las tres apps en producción (domixmensajeria.com, app.…, admin.…) sobre Supabase propio `pwgofasontumxgzahuph`.

## Hecho y verificado
- **Seguridad por rol (migración 11)**: la base identifica al que llama por el token de sesión (`x-domix-token`). Sin sesión: no se lee ninguna tabla; solo se puede crear un pedido (`crear_solicitud`), seguirlo por código y ver "mis pedidos" por teléfono.
- Probado contra producción: anónimo no ve nada; repartidor solo ve pedidos abiertos y los suyos; no puede quitar a otro un pedido, cambiar precio, marcarse `delivered` sin PIN, desactivarse ni subirse el rol; saldo/retiros ajenos rechazados; PIN visible solo a admin; flujo completo cliente → repartidor → PIN → entregado → seguimiento OK.
- Funciones internas (`asignar_clave`, mantenimiento) cerradas (migración 10).
- Archivos de documentos: solo con sesión admin/repartidor.
- Panel con sondeo cada 8 s (el canal en vivo no lleva sesión).

## Pendiente / riesgos conocidos
1. **Rotar credenciales**: los tokens de Supabase y Cloudflare pegados en el chat deben revocarse; cambiar la clave de prueba `domix2026` antes del uso real.
2. **WhatsApp**: sin credenciales de Meta/Anthropic. Con RLS cerrada, la ruta `/api/whatsapp` necesita el secreto `SUPABASE_SERVICE_ROLE_KEY` en el Worker admin. La bandeja se refresca por sondeo cada 8 s.
4. `mis_pedidos` se consulta solo con el teléfono (igual que antes); quien conozca un teléfono ve sus pedidos.
6. GPS nunca probado en un teléfono real.
7. DESPLIEGUE.md (EasyPanel) quedó obsoleto; CLOUDFLARE.md menciona nombres de Workers antiguos.

## Migración 12
Documentos: cada repartidor solo sube/lee su carpeta (probado). `crear_solicitud` rechaza precios por debajo del piso por distancia. Docs de despliegue actualizados.

## GPS (migración 13)
App del repartidor: descarta posiciones con precisión peor a 150 m, publica si pasaron 5 s y se movió >8 m (o cada 20 s), mantiene la pantalla activa (Wake Lock) y avisa si el permiso está denegado, sin señal o es impreciso (verificado en producción: el aviso aparece). Política lista para guardar historial de ruta (`tracking_points`), aún sin escribir desde la app. Sigue faltando probarlo en un teléfono real en movimiento.

## Migración 14 — Producción y Finanzas (6 de octubre de 2026)
- **Finanzas / Saldo:** `saldo_repartidor` reformulado para retener la comisión de Domix (80% repartidor / 20% empresa) y discriminar pagos en efectivo (`cash`): el dinero cobrado en mano no infla el saldo digital a retirar, y se descuenta el 20% adeudado a la empresa.
- **Seguridad en entrega:** `confirm_delivery` exige que quien confirme sea el repartidor asignado (`courier_id = domix_uid()`) o el admin.
- **Gestión de claves:** `admin_asignar_clave` creada y habilitada en el panel para crear repartidores con contraseña o cambiarla interactivamente.
- **Sincronización de tarifas:** las reglas de despacho del panel se guardan en la base (`branches.pricing_rules`) y la app de cliente las lee en vivo.
- **Seguridad de APIs:** `/api/responder` y `/api/leer-chat` protegidos con validación de rol `admin`/`despachador`. Modelo de Anthropic actualizado a `claude-3-5-sonnet-20241022`.
- **Notificaciones del panel:** sondeo con detección de pedidos entrantes (`pushNotify` sonoro/visual activo).

## Marcha atrás
`database/migracion_11_rollback.sql` restaura el acceso abierto.
