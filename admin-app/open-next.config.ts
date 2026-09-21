// Config del adaptador de Cloudflare. El nombre del archivo es fijo —
// opennextjs-cloudflare solo reconoce "open-next.config.ts", ni .js ni
// .mjs — por eso existe este único archivo TypeScript en un proyecto
// que por lo demás es JavaScript puro; no hace falta tsconfig ni la
// dependencia "typescript" para que esto funcione, la propia CLI lo
// compila con esbuild.
//
// Sin caché en R2 a propósito: esta app no usa ISR ni revalidación. Los
// tres endpoints server-side (webhook de WhatsApp, envío de mensajes,
// lectura con IA) son 'force-dynamic', se ejecutan por request.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
