import { supabase } from './supabaseClient';

export const ESTADOS_CONV = {
  abierta: { label: 'Sin atender', tone: 'amber' },
  atendida: { label: 'Atendida', tone: 'navy' },
  cerrada: { label: 'Cerrada', tone: 'default' },
};

export async function fetchConversaciones() {
  const { data, error } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw error;
  return data || [];
}

export async function fetchMensajes(conversationId) {
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function marcarLeida(conversationId) {
  return supabase
    .from('whatsapp_conversations')
    .update({ unread_count: 0 })
    .eq('id', conversationId);
}

export async function cambiarEstado(conversationId, status) {
  return supabase
    .from('whatsapp_conversations')
    .update({ status })
    .eq('id', conversationId);
}

/* Guarda el borrador que armó la IA, para que no haya que releer el chat
   cada vez que alguien abre la conversación. */
export async function guardarBorrador(conversationId, draft) {
  return supabase
    .from('whatsapp_conversations')
    .update({ ai_draft: draft, ai_draft_at: new Date().toISOString() })
    .eq('id', conversationId);
}

/* El mensaje sale de verdad, por la API de Meta, a través de una ruta del
   servidor: el token no puede llegar al navegador. Esa misma ruta lo
   registra en la conversación, así que aquí no se escribe nada.

   Si Meta lo rechaza (número fuera de la ventana de 24 horas, token
   vencido) se devuelve el motivo tal cual para que el despachador sepa
   qué pasó, en vez de creer que el cliente ya recibió la respuesta. */
export async function registrarSalida(conversationId, body, waId, author = 'domix') {
  try {
    const r = await fetch('/api/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waId, texto: body, conversationId, autor: author }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { error: data?.error || 'No se pudo enviar el mensaje.' };
    return { error: null };
  } catch {
    return { error: 'No hubo conexión con el servidor.' };
  }
}

/* Escucha en vivo: la bandeja se mueve sola cuando entra un mensaje. */
export function suscribirBandeja(onCambio) {
  const canal = supabase
    .channel('bandeja-whatsapp')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, onCambio)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations' }, onCambio)
    .subscribe();
  /* El canal en vivo no lleva la sesión del panel (seguridad por rol):
     la bandeja se refresca sola cada pocos segundos. */
  const t = setInterval(() => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') onCambio();
  }, 8000);
  return () => { clearInterval(t); supabase.removeChannel(canal); };
}
