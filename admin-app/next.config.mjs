/* Si se construye para Cloudflare sin las variables de Supabase, Next.js
   incrusta una URL falsa (ver src/lib/supabaseClient.js) y el sitio sale
   "bien" pero ningún acceso funciona. Mejor que el despliegue falle aquí,
   con un mensaje claro, a que se publique roto sin avisar. */
if (process.env.CF_BUILD && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test((process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim())) {
  throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL (o no es una URL de Supabase válida). Revisa .env.production.');
}
if (process.env.CF_BUILD && !(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()) {
  throw new Error('Falta NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisa .env.production.');
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' empaqueta un servidor Node autosuficiente, para Docker
  // en EasyPanel. El adaptador de Cloudflare (opennextjs-cloudflare) arma
  // su propio paquete a partir de la salida normal de Next.js y no lo
  // necesita — por eso se apaga solo cuando se construye para Cloudflare
  // (ver el script "cf:build" en package.json).
  output: process.env.CF_BUILD ? undefined : 'standalone',
};

export default nextConfig;
