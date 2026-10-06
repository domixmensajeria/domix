import { NextResponse } from 'next/server';
import { notificarPedidoCreado, notificarServicioFinalizado, enviarEmail } from '../../../../lib/resend';

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
    }

    const { tipo = 'pedido_creado', pedido = {}, destinatario, asunto, mensaje } = body;

    let resultado;
    if (tipo === 'pedido_creado') {
      resultado = await notificarPedidoCreado(pedido, destinatario);
    } else if (tipo === 'pedido_entregado') {
      resultado = await notificarServicioFinalizado(pedido, destinatario);
    } else if (tipo === 'personalizado') {
      resultado = await enviarEmail({
        to: destinatario,
        subject: asunto || 'Notificación Domix TuraFood',
        html: `<div style="font-family:sans-serif;padding:20px;background:#111;color:#eee;">${mensaje || ''}</div>`,
      });
    } else {
      return NextResponse.json({
        error: `Tipo de notificación no soportado: ${tipo}. Usa 'pedido_creado' o 'pedido_entregado'`,
      }, { status: 400 });
    }

    if (!resultado.ok) {
      return NextResponse.json({
        ok: false,
        error: resultado.error || 'Fallo en el envío del correo',
        status: resultado.status || 500,
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      tipo,
      email_id: resultado.id,
      destinatarios: resultado.recipients,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err.message || 'Error interno del servidor de correo',
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
