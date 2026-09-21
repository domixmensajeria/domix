# Desplegar Domix en Cloudflare Workers (dominios temporales)

Esto es aparte de EasyPanel — las dos formas de desplegar conviven sin
pisarse, porque `next.config.mjs` apaga el modo Docker (`standalone`)
solo cuando se construye para Cloudflare.

Cada Worker recibe gratis un dominio de prueba:

| App | Nombre del Worker | Dominio temporal |
|---|---|---|
| Cliente | `domix-cliente` | `domix-cliente.<tu-subdominio>.workers.dev` |
| Repartidor | `domix-repartidor` | `domix-repartidor.<tu-subdominio>.workers.dev` |
| Panel | `domix-panel` | `domix-panel.<tu-subdominio>.workers.dev` |

`<tu-subdominio>` es el que Cloudflare te asignó la primera vez que
entraste a Workers & Pages — se ve en el propio dashboard.

## Por qué por el dashboard y no por la terminal

Probé desplegar desde aquí con la CLI (`wrangler`). El adaptador de
Cloudflare (`@opennextjs/cloudflare`) necesita un binario nativo
(`@ast-grep/napi`) para reescribir por dentro el paquete de Next.js, y
en este Windows específico ese binario no carga (`ERR_DLOPEN_FAILED` —
casi siempre falta el runtime de Visual C++, no es un problema del
código ni de la configuración). No vale la pena perseguirlo: **el
dashboard de Cloudflare compila en sus propios servidores Linux**, así
que esa rareza de esta máquina no te afecta allá. Es además la misma
forma en que ya despliegas en EasyPanel — conectar el repo y dejar que
la plataforma construya — así que no cambia tu flujo de trabajo.

## 1. Migraciones de Supabase

Si ya las corriste para EasyPanel, este paso ya está — es la misma
base de datos para las dos formas de desplegar.

## 2. Conectar cada app (repetir 3 veces)

En el dashboard de Cloudflare: **Workers & Pages → Create → Workers →
Import a repository** (o **Connect to Git** si ya existe el Worker).
Autoriza el acceso a `sophieaitech/domix` si no lo has hecho antes.

Para cada una de las tres, la app vive en una subcarpeta del mismo
repositorio, así que hay que decírselo explícitamente:

| Campo | Cliente | Repartidor | Panel |
|---|---|---|---|
| Nombre del Worker | `domix-cliente` | `domix-repartidor` | `domix-panel` |
| Root directory | `cliente-app` | `repartidor-app` | `admin-app` |
| Build command | `npm install && npm run cf:build` | igual | igual |
| Deploy command | `npx wrangler deploy` | igual | igual |

Con eso, cada `git push` a `master` reconstruye y redespliega solo.

## 3. Variables — la misma regla que en EasyPanel, invertida

Las `NEXT_PUBLIC_*` se incrustan en el bundle **durante el build**, así
que van como variables normales del proyecto (pestaña *Variables and
Secrets*, tipo *Text*), no como secreto — ya son públicas de por sí:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-llave-publica
```

Las del panel que sí son secretas van como *Secret* en esa misma
pestaña — Cloudflare las inyecta en cada request, nunca quedan en el
código construido:

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

## 4. WhatsApp

Igual que con EasyPanel: el webhook necesita URL pública para
configurarse en Meta, así que ese paso va después de que el primer
build del panel esté arriba:

```
https://domix-panel.<tu-subdominio>.workers.dev/api/whatsapp
```

## 5. Verificar

Entra al dominio temporal de cada Worker. El de más cuidado es el
panel: entra con `admin@domix.co`, confirma que el Dashboard carga
pedidos reales y no "No hay conexión" — si sale eso, casi siempre es
que faltó una `NEXT_PUBLIC_*` en el build de esa app puntual.

## Cuando quieras un dominio propio en vez del temporal

Workers & Pages → tu Worker → **Settings → Domains & Routes → Add** —
ahí conectas `pedir.domix.co` (o el que quieras) si el dominio ya está
en Cloudflare. El `*.workers.dev` sigue funcionando en paralelo,
igual que ahora.
