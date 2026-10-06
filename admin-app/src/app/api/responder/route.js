import { createClient } from '@supabase/supabase-js';

/* Enviar un mensaje de WhatsApp desde el panel.

   Sale por el servidor porque el token de Meta no puede llegar al
   navegador: con él se puede escribir a nombre de Domix a cualquiera. */

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const sesionToken = request.headers.get('x-domix-token');
  if (!sesionToken) {
    return Response.json({ error: 'No autorizado. Se requiere sesión.' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return Response.json({ error: 'Servicio no configurado en el servidor.' }, { status: 503 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: sesionData, error: sesionError } = await supabase.rpc('validar_sesion', { p_token: sesionToken });
  if (sesionError || !sesionData?.length || !['admin', 'despachador'].includes(sesionData[0]?.rol)) {
    return Response.json({ error: 'Sesión inválida o permisos insuficientes.' }, { status: 403 });
  }

  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !token) {
    return Response.json(
      { error: 'Falta configurar WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN en el servidor.' },
      { status: 503 },
    );
  }

  let waId, texto, conversationId, autor;
  try {
    ({ waId, texto, conversationId, autor = 'domix' } = await request.json());
  } catch {
    return Response.json({ error: 'Petición inválida.' }, { status: 400 });
  }

  if (!waId || !texto?.trim()) {
    return Response.json({ error: 'Falta el número o el mensaje.' }, { status: 400 });
  }

  const envio = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: waId,
      type: 'text',
      text: { body: texto },
    }),
  });

  const respuesta = await envio.json().catch(() => ({}));

  if (!envio.ok) {
    // El mensaje de Meta explica mejor que un genérico qué pasó: número
    // fuera de la ventana de 24 horas, plantilla requerida, token vencido.
    return Response.json(
      { error: respuesta?.error?.message || 'WhatsApp rechazó el mensaje.' },
      { status: envio.status },
    );
  }

  // Queda registrado en la conversación para que el chat del panel
  // muestre lo mismo que ve el cliente en su teléfono.
  if (conversationId) {
    await supabase.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      wa_message_id: respuesta?.messages?.[0]?.id || null,
      direction: 'saliente',
      author: autor,
      body: texto,
      status: 'enviado',
    });
  }

  return Response.json({ ok: true, id: respuesta?.messages?.[0]?.id || null });
}
