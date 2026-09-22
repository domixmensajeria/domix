# Desplegar Domix en Cloudflare Workers

Stack completo e independiente, sin nada compartido con el desarrollo
anterior:

| Pieza | Cuenta / proyecto |
|---|---|
| Código | [github.com/domixmensajeria/domix](https://github.com/domixmensajeria/domix) (privado) |
| Base de datos | Supabase, proyecto "Domix Mensajería" (`pwgofasontumxgzahuph`), org Domix, São Paulo |
| Hosting | Cloudflare, cuenta `domixmensajeriasas@gmail.com` |

Cada Worker recibe gratis un dominio de prueba, sin comprar nada:

| App | Nombre del Worker | Dominio temporal |
|---|---|---|
| Cliente | `domix-cliente` | `domix-cliente.<tu-subdominio>.workers.dev` |
| Repartidor | `domix-repartidor` | `domix-repartidor.<tu-subdominio>.workers.dev` |
| Panel | `domix-panel` | `domix-panel.<tu-subdominio>.workers.dev` |

`<tu-subdominio>` es el que Cloudflare asignó a la cuenta la primera
vez que se entró a Workers & Pages — se ve en el propio dashboard.

## Por qué por el dashboard y no por la terminal

El adaptador de Cloudflare (`@opennextjs/cloudflare`) necesita un
binario nativo (`@ast-grep/napi`) para reescribir por dentro el
paquete de Next.js, y en este Windows específico ese binario no carga
(`ERR_DLOPEN_FAILED` — casi siempre falta el runtime de Visual C++, no
es un problema del código ni de la configuración). No vale la pena
perseguirlo: **el dashboard de Cloudflare compila en sus propios
servidores Linux**, así que esa rareza de esta máquina no aplica allá.

## 1. Migraciones de Supabase

Ya corridas — las 9 migraciones están aplicadas en el proyecto nuevo.
Si algún día hace falta rehacerlo desde cero, `database/aplicar_nuevo.sh`
corre cualquier archivo `.sql` contra este proyecto (lee el token de
`.supabase-token-nuevo`, que nunca se sube a git).

## 2. Conectar cada app (repetir 3 veces)

En el dashboard de Cloudflare, con la cuenta `domixmensajeriasas@gmail.com`:
**Workers & Pages → Create → Workers → Import a repository**.
Autoriza el acceso a `domixmensajeria/domix` la primera vez.

Las tres apps viven en subcarpetas del mismo repositorio, así que hay
que decírselo explícitamente:

| Campo | Cliente | Repartidor | Panel |
|---|---|---|---|
| Nombre del Worker | `domix-cliente` | `domix-repartidor` | `domix-panel` |
| Root directory | `cliente-app` | `repartidor-app` | `admin-app` |
| Build command | `npm install && npm run cf:build` | igual | igual |
| Deploy command | `npx wrangler deploy` | igual | igual |

Con eso, cada `git push` a `master` reconstruye y redespliega solo.

## 3. Variables de entorno

Las `NEXT_PUBLIC_*` se incrustan en el bundle **durante el build**, así
que van como variables normales del proyecto (pestaña *Variables and
Secrets*, tipo *Text*) — son las del proyecto nuevo de Supabase, no las
de ningún desarrollo anterior:

```
NEXT_PUBLIC_SUPABASE_URL=https://pwgofasontumxgzahuph.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<la anon key del proyecto nuevo>
```

(La anon key completa está en el `.env.local` de cada app, en este
mismo equipo — no se repite aquí porque este archivo sí queda en git.)

Las del panel que son secretas van como *Secret* en esa misma pestaña
— Cloudflare las inyecta en cada request, nunca quedan en el código
construido:

```
ANTHROPIC_API_KEY=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...
WHATSAPP_APP_SECRET=...
```

**Detalle que rompe todo si se salta:** en Workers estas variables no
llegan solas a `process.env` — hace falta el flag de compatibilidad
`nodejs_compat_populate_process_env`. Ya está puesto en
`admin-app/wrangler.jsonc`, así que si usas ese archivo tal cual no
tienes que hacer nada más aquí; solo entra si algún día borras o
reescribes ese archivo.

## 4. Cuentas para entrar y probar

Sembradas en el proyecto nuevo de Supabase, base limpia en ceros:

| App | Usuario |
|---|---|
| Panel | `admin@domix.co` / `domix2026` |
| Repartidor | `+573157924906` (Yeison Mosquera) / `yeison123` |
| Cliente | Sin login — así se diseñó a propósito |

## 5. WhatsApp

El webhook necesita URL pública para configurarse en Meta, así que ese
paso va después de que el primer build del panel esté arriba:

```
https://domix-panel.<tu-subdominio>.workers.dev/api/whatsapp
```

## 6. Verificar

Entra al dominio temporal de cada Worker. El de más cuidado es el
panel: entra con `admin@domix.co`, confirma que el Dashboard carga (en
ceros, es normal) y no "No hay conexión" — si sale eso, casi siempre es
que faltó una `NEXT_PUBLIC_*` en el build de esa app puntual.

## Cuando quieras un dominio propio en vez del temporal

Workers & Pages → tu Worker → **Settings → Domains & Routes → Add** —
ahí conectas `pedir.domix.co` (o el que quieras) si el dominio ya está
en Cloudflare. El `*.workers.dev` sigue funcionando en paralelo,
igual que ahora.
