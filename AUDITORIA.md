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

## Marcha atrás
`database/migracion_11_rollback.sql` restaura el acceso abierto.
