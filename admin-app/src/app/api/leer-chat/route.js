import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

/* Lee una conversación de WhatsApp y arma el borrador del pedido.
   Corre en el servidor: la clave nunca llega al navegador. */

const Borrador = z.object({
  es_pedido: z.boolean().describe('true solo si el cliente está pidiendo un servicio de mensajería'),
  service_type: z.enum(['mensajeria', 'encomienda', 'domicilio', 'mandado', 'autorizacion_medica']),
  contact_name: z.string().describe('nombre del cliente, o cadena vacía si no lo dijo'),
  contact_phone: z.string().describe('celular de contacto, o cadena vacía'),
  pickup_address: z.string().describe('de dónde se recoge, tal como lo dijo el cliente'),
  dropoff_address: z.string().describe('a dónde se entrega'),
  description: z.string().describe('qué se lleva y cualquier detalle útil para el repartidor'),
  turbo: z.boolean().describe('true si el cliente expresó urgencia'),
  confianza: z.enum(['alta', 'media', 'baja']),
  falta: z.array(z.string()).describe('datos que faltan y hay que preguntarle al cliente'),
  respuesta_sugerida: z.string().describe('respuesta corta y cordial para enviarle por WhatsApp'),
});

const INSTRUCCIONES = `Eres el asistente de despacho de Domix, una empresa de mensajería y logística de Buenaventura, Valle del Cauca, Colombia.

Lees conversaciones de WhatsApp de clientes y extraes el pedido para que un despachador humano solo confirme.

Los servicios de Domix son:
- mensajeria: documentos, cartas y correspondencia
- encomienda: paquetes y mercancías
- domicilio: comida, tiendas, farmacias
- mandado: compras, pagos y diligencias que hace el repartidor
- autorizacion_medica: trámites en EPS y clínicas

Reglas:
- Las direcciones escríbelas tal como las dijo el cliente. No inventes números ni barrios.
- Buenaventura se organiza por barrios (Centro, El Jorge, Pueblo Nuevo, Juan XXIII, Cristo Rey, Bellavista, La Independencia). Si el cliente solo dice el barrio, eso es suficiente.
- Si algo no está en el chat, déjalo vacío y anótalo en "falta". Nunca lo supongas.
- Marca turbo solo si el cliente dice que es urgente, rápido o para ya.
- La respuesta sugerida es en español colombiano, cordial y breve. Si faltan datos, pregúntalos ahí.
- Si el mensaje no es un pedido (un saludo, una queja, una pregunta de precios), pon es_pedido en false y responde igual con algo útil.`;

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

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'Falta configurar ANTHROPIC_API_KEY en el servidor.' },
      { status: 503 },
    );
  }

  let mensajes;
  try {
    ({ mensajes } = await request.json());
  } catch {
    return Response.json({ error: 'Petición inválida.' }, { status: 400 });
  }

  if (!Array.isArray(mensajes) || mensajes.length === 0) {
    return Response.json({ error: 'La conversación está vacía.' }, { status: 400 });
  }

  const chat = mensajes
    .map((m) => `${m.direction === 'entrante' ? 'Cliente' : 'Domix'}: ${m.body || '[archivo]'}`)
    .join('\n');

  try {
    const client = new Anthropic();
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const respuesta = await client.messages.parse({
      model,
      max_tokens: 4000,
      system: INSTRUCCIONES,
      output_config: {
        format: zodOutputFormat(Borrador),
        effort: 'medium',
      },
      messages: [{ role: 'user', content: `Conversación de WhatsApp:\n\n${chat}` }],
    });

    if (!respuesta.parsed_output) {
      return Response.json({ error: 'No se pudo interpretar la conversación.' }, { status: 502 });
    }

    return Response.json({ borrador: respuesta.parsed_output });
  } catch (e) {
    // Se registra en el servidor; al panel solo va un mensaje corto.
    console.error('[leer-chat]', e);
    const status = e?.status === 429 ? 429 : 502;
    return Response.json(
      { error: status === 429 ? 'La IA está saturada, intenta en un momento.' : 'La IA no respondió.' },
      { status },
    );
  }
}
