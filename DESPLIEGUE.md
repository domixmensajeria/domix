> **Obsoleto**: Domix ya no se despliega con EasyPanel. Ver CLOUDFLARE.md.

# Desplegar Domix en EasyPanel

Tres aplicaciones, tres servicios, una sola base de datos en Supabase.

| App | Carpeta | Quién la usa | Dominio sugerido |
|---|---|---|---|
| Cliente | `cliente-app` | El público de Buenaventura | `pedir.domix.co` |
| Repartidor | `repartidor-app` | La flota | `repartidor.domix.co` |
| Panel | `admin-app` | La oficina | `panel.domix.co` |

## Antes de empezar

Corre las migraciones en Supabase, en orden, desde `database/`:

```
schema.sql
migracion_02_sedes_tracking_turbo.sql
migracion_03_pin_de_entrega.sql
migracion_04_whatsapp.sql
migracion_05_acceso.sql
migracion_06_claves_aparte.sql
migracion_07_documentos_vehiculo_retiros.sql
```

## Crear cada servicio

En EasyPanel: **Create Service → App → Source: GitHub**, apuntando a este
repositorio y a la rama `master`.

Para cada uno:

- **Build method:** Dockerfile
- **Build context:** la carpeta de la app (`cliente-app`, `repartidor-app`
  o `admin-app`)
- **Dockerfile path:** `Dockerfile`
- **Puerto:** `3000`

## Las variables: dónde va cada una

Esta es la parte donde es fácil equivocarse.

Las que empiezan por `NEXT_PUBLIC_` **se incrustan en el paquete que baja
el navegador durante el build**. Si las pones solo como variables de
entorno del contenedor, la aplicación se construye apuntando a una base
de datos que no existe y no funciona nada. Van como **Build Arguments**:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-llave-publica
```

Las del panel que son secretas van como **Environment Variables** del
servicio, nunca como argumentos de build, para que no queden dentro de
la imagen ni viajen al navegador:

```
ANTHROPIC_API_KEY=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_APP_SECRET=...
```

`WHATSAPP_APP_SECRET` es el *App Secret* de tu aplicación en Meta. Con él
se comprueba la firma de cada mensaje entrante: el webhook está abierto a
internet, y sin esa comprobación cualquiera podría meter pedidos falsos
en la bandeja del despachador. Si falta, el webhook rechaza todo.

## WhatsApp

El webhook de Meta necesita una URL pública, así que se configura
**después** de que el panel esté desplegado y con dominio:

```
https://panel.domix.co/api/whatsapp
```

Con el mismo `WHATSAPP_VERIFY_TOKEN` que pusiste en el servicio.

## Antes de abrirlo al público

- [ ] Rotar el token personal de Supabase usado en desarrollo, en
      supabase.com/dashboard/account/tokens
- [ ] Cambiar las contraseñas del panel y de los repartidores que se
      usaron para probar
- [ ] Revisar que el balde `documentos` siga en privado: guarda cédulas
      y licencias, y solo debe leerse con enlaces firmados
