import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pwgofasontumxgzahuph.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request, { params }) {
  const { name } = await params;
  const startedAt = Date.now();

  try {
    let body = {};
    const text = await request.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc(name, body);

    const latencyMs = Date.now() - startedAt;

    if (error) {
      return NextResponse.json({
        ok: false,
        rpc: name,
        error: error.message,
        details: error.details || error.hint,
        code: error.code,
        latency_ms: latencyMs,
      }, { status: 400 });
    }

    // Notificaciones automáticas por Email (Resend)
    if (name === 'confirm_delivery') {
      (async () => {
        try {
          const { notificarServicioFinalizado } = await import('../../../../lib/resend');
          const pedidoId = body.p_pedido_id;
          if (pedidoId) {
            const { data: p } = await supabase.from('pedidos').select('*, repartidores(nombre)').eq('id', pedidoId).maybeSingle();
            if (p) {
              await notificarServicioFinalizado({
                ...p,
                repartidor_nombre: p.repartidores?.nombre || 'Repartidor Domix',
              });
            }
          }
        } catch (e) {
          console.warn('[Notificación Resend Error]', e?.message);
        }
      })();
    } else if (name === 'crear_solicitud') {
      (async () => {
        try {
          const { notificarPedidoCreado } = await import('../../../../lib/resend');
          const pedidoId = typeof data === 'object' ? data?.pedido_id || data?.id : data;
          await notificarPedidoCreado({
            id: pedidoId || 'NUEVO',
            ...body,
          });
        } catch (e) {
          console.warn('[Notificación Resend Error]', e?.message);
        }
      })();
    }

    return NextResponse.json({
      ok: true,
      rpc: name,
      data,
      latency_ms: latencyMs,
      timestamp: new Date().toISOString(),
    }, {
      status: 200,
      headers: {
        'x-execution-latency': `${latencyMs}ms`,
      },
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      rpc: name,
      error: err.message || 'Error interno al ejecutar RPC',
      latency_ms: Date.now() - startedAt,
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-domix-token',
    },
  });
}
