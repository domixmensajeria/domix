import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key').trim();

// Cada petición lleva el token de sesión propio de Domix para que la base
// sepa qué rol llama (ver migración 11). Sin sesión (cliente invitado) no
// se envía nada.
function tokenDeSesion() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem('domix_sesion');
    return raw ? JSON.parse(raw)?.token || null : null;
  } catch { return null; }
}

function fetchConSesion(input, init = {}) {
  const token = tokenDeSesion();
  if (!token) return fetch(input, init);
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.set('x-domix-token', token);
  return fetch(input, { ...init, headers });
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchConSesion },
});
