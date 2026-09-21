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
