import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

/* Webhook de WhatsApp Business (Meta Cloud API).

   Meta hace dos cosas contra esta ruta:
   - GET  para verificar que la URL es nuestra, una sola vez al configurarla.
   - POST cada vez que alguien nos escribe.

   Es un endpoint abierto a internet, así que todo POST se comprueba
   contra la firma de Meta antes de tocar la base de datos. Sin eso
   cualquiera podría meter pedidos falsos en la bandeja del despachador. */

export const dynamic = 'force-dynamic';

function supabaseServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[webhook whatsapp] ADVERTENCIA: Falta SUPABASE_SERVICE_ROLE_KEY. Con RLS activo (Migración 11), las inserciones anónimas serán rechazadas.');
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ---------- Verificación inicial ---------- */
export async function GET(request) {
  const p = new URL(request.url).searchParams;
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!esperado) {
    return new Response('Falta WHATSAPP_VERIFY_TOKEN en el servidor', { status: 503 });
  }
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === esperado) {
    // Meta espera el reto de vuelta en texto plano, tal cual.
    return new Response(p.get('hub.challenge') || '', { status: 200 });
  }
  return new Response('Token de verificación incorrecto', { status: 403 });
}

/* Comparación en tiempo constante: comparar firmas con === filtra
   información sobre cuántos caracteres acertó quien lo intenta. */
function firmaValida(crudo, cabecera) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  if (!secreto) return { ok: false, motivo: 'Falta WHATSAPP_APP_SECRET en el servidor' };
  if (!cabecera?.startsWith('sha256=')) return { ok: false, motivo: 'Petición sin firma' };

  const mia = 'sha256=' + crypto.createHmac('sha256', secreto).update(crudo, 'utf8').digest('hex');
  const a = Buffer.from(mia);
  const b = Buffer.from(cabecera);
  if (a.length !== b.length) return { ok: false, motivo: 'Firma que no corresponde' };
  return { ok: crypto.timingSafeEqual(a, b), motivo: 'Firma que no corresponde' };
}

/* ---------- Mensajes entrantes ---------- */
export async function POST(request) {
  const crudo = await request.text();

  const firma = firmaValida(crudo, request.headers.get('x-hub-signature-256'));
  if (!firma.ok) {
    return Response.json({ error: firma.motivo }, { status: 401 });
  }

  const supabase = supabaseServidor();
  if (!supabase) {
    return Response.json({ error: 'Supabase no está configurado en el servidor.' }, { status: 503 });
  }

  let cuerpo;
  try { cuerpo = JSON.parse(crudo); } catch {
    return Response.json({ error: 'Cuerpo inválido.' }, { status: 400 });
  }

  let guardados = 0;

  for (const entrada of cuerpo.entry || []) {
    for (const cambio of entrada.changes || []) {
      const valor = cambio.value || {};
      const nombres = new Map(
        (valor.contacts || []).map((c) => [c.wa_id, c.profile?.name || null]),
      );

      for (const msg of valor.messages || []) {
        // Solo los que entran; los ecos de lo que nosotros enviamos ya
        // quedaron registrados al mandarlos.
        if (msg.from === valor.metadata?.display_phone_number) continue;

        const conversacion = await conversacionDe(supabase, msg.from, nombres.get(msg.from));
        if (!conversacion) continue;

        const { error } = await supabase.from('whatsapp_messages').insert({
          conversation_id: conversacion.id,
          wa_message_id: msg.id,
          direction: 'entrante',
          author: 'cliente',
          body: textoDe(msg),
          media_type: msg.type !== 'text' ? msg.type : null,
          status: 'recibido',
        });

        // wa_message_id es único: si Meta reintenta el mismo mensaje, el
        // choque es la señal de que ya lo teníamos, no un fallo.
        if (!error) guardados += 1;
      }
    }
  }

  // A Meta se le responde 200 siempre que hayamos entendido la petición.
  // Un error aquí hace que reintente y duplique.
  return Response.json({ ok: true, guardados });
}

async function conversacionDe(supabase, waId, nombre) {
  const { data: existente } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('wa_id', waId)
    .maybeSingle();

  if (existente) {
    if (nombre) await supabase.from('whatsapp_conversations').update({ display_name: nombre }).eq('id', existente.id);
    return existente;
  }

  const { data } = await supabase
    .from('whatsapp_conversations')
    .insert({ wa_id: waId, display_name: nombre, status: 'abierta' })
    .select('id')
    .single();

  return data;
}

/* Meta manda cada tipo de mensaje con una forma distinta. Lo que no es
   texto se deja anotado para que el despachador sepa que hay algo que
   mirar en WhatsApp. */
function textoDe(msg) {
  switch (msg.type) {
    case 'text': return msg.text?.body || '';
    case 'image': return msg.image?.caption || '[Envió una foto]';
    case 'document': return msg.document?.caption || `[Envió un archivo: ${msg.document?.filename || 'sin nombre'}]`;
    case 'audio': return '[Envió una nota de voz]';
    case 'video': return msg.video?.caption || '[Envió un video]';
    case 'location': return `[Compartió su ubicación: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
    case 'contacts': return '[Compartió un contacto]';
    case 'button': return msg.button?.text || '[Tocó un botón]';
    case 'interactive': return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Respondió una opción]';
    default: return `[Mensaje de tipo ${msg.type}]`;
  }
}
