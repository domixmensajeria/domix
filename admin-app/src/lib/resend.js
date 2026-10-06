/**
 * Cliente Resend para envío de notificaciones por correo electrónico
 * Compatible con Node.js, Next.js Server Components y Cloudflare Workers.
 */

import { templatePedidoCreado, templateServicioFinalizado } from './email-templates';

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Domix TuraFood <onboarding@resend.dev>';
const FALLBACK_TEST_EMAIL = 'domixmensajeriasas@gmail.com';

export async function enviarEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM || DEFAULT_FROM;

  if (!apiKey) {
    console.warn('[Resend] Falta RESEND_API_KEY. Notificación por email omitida.');
    return { ok: false, error: 'Falta RESEND_API_KEY' };
  }

  // Asegurar que 'to' sea un arreglo válido
  const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (recipients.length === 0) {
    // Si no se proporcionó destinatario, enviar al buzón de operaciones
    recipients.push(process.env.EMAIL_OPERACIONES || FALLBACK_TEST_EMAIL);
  }

  try {
    const payload = {
      from: fromAddress,
      to: recipients,
      subject,
      html,
    };

    let res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let data = await res.json().catch(() => ({}));

    // Si Resend devuelve error de sandbox (dominio no verificado en Resend),
    // reenviamos automáticamente a la cuenta verificada de pruebas para no perder la alerta.
    if (!res.ok && data?.message?.includes('testing emails to your own email address')) {
      console.warn(`[Resend Sandbox] Reenviando a ${FALLBACK_TEST_EMAIL} mientras se verifica el dominio turafood.com en Resend.`);
      payload.to = [FALLBACK_TEST_EMAIL];
      payload.subject = `[Copia Operaciones] ${subject}`;

      res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      data = await res.json().catch(() => ({}));
    }

    if (!res.ok) {
      console.error('[Resend Error]', res.status, data);
      return { ok: false, status: res.status, error: data?.message || 'Error al enviar email' };
    }

    console.log(`[Resend Success] Email enviado a ${payload.to.join(', ')} con ID: ${data?.id}`);
    return { ok: true, id: data?.id, recipients: payload.to };
  } catch (err) {
    console.error('[Resend Excepción]', err);
    return { ok: false, error: err.message };
  }
}

/**
 * EMAIL 1: Notificación de Pedido Registrado
 */
export async function notificarPedidoCreado(pedido, emailDestino) {
  const targetEmail = emailDestino || pedido.cliente_email || pedido.p_cliente_email;
  const id = pedido.id || pedido.pedido_id || '---';

  const html = templatePedidoCreado(pedido);
  return enviarEmail({
    to: targetEmail,
    subject: `✅ Pedido #${id} Confirmado · Domix TuraFood`,
    html,
  });
}

/**
 * EMAIL 2: Recibo de Servicio Finalizado
 */
export async function notificarServicioFinalizado(pedido, emailDestino) {
  const targetEmail = emailDestino || pedido.cliente_email || pedido.p_cliente_email;
  const id = pedido.id || pedido.pedido_id || '---';

  const html = templateServicioFinalizado(pedido);
  return enviarEmail({
    to: targetEmail,
    subject: `🎉 Pedido #${id} Entregado con Éxito · Recibo de Servicio`,
    html,
  });
}

/**
 * EMAIL 3: Confirmación de Registro de Usuario / Conductor (Modelo turabarber.com)
 */
export async function notificarConfirmacionRegistro({ email, nombre, codigo, rol, token }) {
  const urlConfirmacion = `https://turafood.com/confirmar?token=${token}&email=${encodeURIComponent(email)}`;
  const { templateConfirmacionRegistro } = await import('./email-templates');
  const html = templateConfirmacionRegistro({ nombre, codigo, rol, urlConfirmacion });
  return enviarEmail({
    to: email,
    subject: `🔐 Código de Activación: ${codigo} · Domix TuraFood`,
    html,
  });
}

