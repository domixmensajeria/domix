/**
 * Plantillas de Correo Electrónico PRO y Responsive para Domix / TuraFood
 * Diseñadas para alta legibilidad en clientes móviles (Gmail, Apple Mail, Outlook)
 * y compatibles con estándares HTML de correo electrónico.
 */

function baseLayout({ title, previewText, children }) {
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!-- Preheader preview text -->
  <span style="display:none;font-size:1px;color:#0b0d0e;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${previewText || title}
  </span>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0d0e;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    table { border-collapse: separate; }
    a { text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; padding: 12px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-text-center { text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b0d0e;color:#e2e8f0;">
  <center style="width:100%;table-layout:fixed;background-color:#0b0d0e;padding:30px 0;">
    <table class="email-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;margin:0 auto;background-color:#121517;border-radius:16px;border:1px solid #1f2429;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,0.45);">
      
      <!-- HEADER / BRANDING -->
      <tr>
        <td style="background:linear-gradient(180deg, #181d21 0%, #121517 100%);padding:28px 32px;border-bottom:1px solid #22282e;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="left" valign="middle">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:38px;height:38px;background:#5FBF45;border-radius:10px;text-align:center;vertical-align:middle;font-weight:900;color:#0b0d0e;font-size:22px;line-height:38px;">
                      D
                    </td>
                    <td style="padding-left:12px;">
                      <span style="font-size:20px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;display:inline-block;">
                        Domi<span style="color:#5FBF45;">X</span>
                      </span>
                      <span style="display:inline-block;width:5px;height:5px;background:#5FBF45;border-radius:50%;margin-left:2px;vertical-align:baseline;"></span>
                      <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">
                        turafood.com · Mensajería & Logística
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
              <td align="right" valign="middle">
                <span style="background:rgba(95,191,69,0.12);border:1px solid rgba(95,191,69,0.3);color:#8FD46E;padding:6px 12px;border-radius:99px;font-size:11px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;display:inline-block;">
                  Servicio Activo
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CONTENT BODY -->
      <tr>
        <td style="padding:32px 32px 28px;">
          ${children}
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background-color:#0d0f11;padding:24px 32px;border-top:1px solid #1c2024;text-align:center;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding-bottom:12px;">
                <a href="https://turafood.com" style="color:#94a3b8;font-size:12px;font-weight:600;margin:0 10px;text-decoration:none;">turafood.com</a>
                <span style="color:#334155;">•</span>
                <a href="https://wa.me/573157924906" style="color:#5FBF45;font-size:12px;font-weight:700;margin:0 10px;text-decoration:none;">Soporte WhatsApp</a>
                <span style="color:#334155;">•</span>
                <a href="https://panel.turafood.com" style="color:#94a3b8;font-size:12px;font-weight:600;margin:0 10px;text-decoration:none;">Acceso Clientes</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="font-size:11px;color:#64748b;line-height:1.6;">
                © 2026 Domix Mensajería S.A.S. / TuraFood · Operaciones Buenaventura, Valle del Cauca.<br>
                Este correo fue enviado automáticamente para confirmar tu servicio logístico.
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </center>
</body>
</html>`;
}

/**
 * EMAIL 1: Notificación de Pedido Registrado y en Camino
 */
export function templatePedidoCreado(pedido) {
  const id = pedido.id || pedido.pedido_id || '---';
  const cliente = pedido.cliente_nombre || pedido.p_cliente_nombre || 'Cliente';
  const origen = pedido.origen_direccion || pedido.p_origen_direccion || 'Punto acordado';
  const destino = pedido.destino_direccion || pedido.p_destino_direccion || 'Destino cliente';
  const codigo = pedido.codigo_entrega || pedido.codigo_confirmacion || pedido.p_codigo_entrega || '----';
  const descripcion = pedido.descripcion || pedido.p_descripcion || 'Paquete / Mensajería rápida';
  const costo = Number(pedido.costo_envio || pedido.p_costo_envio || 8000).toLocaleString('es-CO');
  const metodoPago = (pedido.metodo_pago || pedido.p_metodo_pago || 'efectivo').toUpperCase();
  const urlRastreo = `https://turafood.com/rastreo?id=${id}`;

  const content = `
    <!-- STATUS BADGE -->
    <div style="margin-bottom:20px;">
      <span style="background:rgba(56,189,248,0.15);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">
        ● Pedido Registrado · En Preparación
      </span>
    </div>

    <!-- MAIN HEADING -->
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.3;">
      ¡Hola, ${cliente}! Tu servicio #${id} está confirmado.
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Hemos recibido tu solicitud y nuestro sistema logístico está coordinando la recogida con la flota de repartidores más cercana.
    </p>

    <!-- PIN SECURITY BOX -->
    <div style="background:#090a0b;border:1px solid #252b31;border-radius:12px;padding:20px;text-align:center;margin-bottom:26px;">
      <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">
        Código de Seguridad de Entrega (PIN)
      </div>
      <div style="font-family:'Courier New', Courier, monospace;font-size:36px;font-weight:900;color:#5FBF45;letter-spacing:0.18em;margin-bottom:6px;">
        ${codigo}
      </div>
      <div style="font-size:12px;color:#94a3b8;line-height:1.4;">
        ⚠️ <strong style="color:#e2e8f0;">Muy importante:</strong> Entrégale este código al domiciliario <em>únicamente</em> cuando recibas tu entrega en mano.
      </div>
    </div>

    <!-- ITINERARIO / RUTA -->
    <div style="background:#16191c;border:1px solid #22282e;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
      <div style="font-size:12px;font-weight:800;color:#cbd5e1;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;border-bottom:1px solid #242a30;padding-bottom:8px;">
        Detalle del Itinerario
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
        <tr>
          <td width="28" valign="top" style="padding-top:2px;">
            <div style="width:14px;height:14px;border-radius:50%;background:#5FBF45;border:3px solid #16191c;"></div>
          </td>
          <td valign="top">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Punto de Recogida (Origen)</div>
            <div style="font-size:13px;color:#ffffff;font-weight:600;margin-top:2px;">${origen}</div>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
        <tr>
          <td width="28" valign="top" style="padding-top:2px;">
            <div style="width:14px;height:14px;border-radius:50%;background:#38bdf8;border:3px solid #16191c;"></div>
          </td>
          <td valign="top">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Punto de Entrega (Destino)</div>
            <div style="font-size:13px;color:#ffffff;font-weight:600;margin-top:2px;">${destino}</div>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px dashed #242a30;padding-top:12px;margin-top:8px;">
        <tr>
          <td>
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Contenido / Paquete</div>
            <div style="font-size:12.5px;color:#cbd5e1;margin-top:2px;">${descripcion}</div>
          </td>
          <td align="right" valign="bottom">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Valor Envío</div>
            <div style="font-size:16px;color:#5FBF45;font-weight:800;margin-top:2px;">$${costo} COP</div>
            <div style="font-size:10px;color:#94a3b8;">Pago: ${metodoPago}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA BUTTON -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <a href="${urlRastreo}" style="background-color:#5FBF45;color:#0b0d0e;font-size:14px;font-weight:800;padding:14px 32px;border-radius:10px;display:inline-block;text-align:center;letter-spacing:-0.01em;box-shadow:0 4px 16px rgba(95,191,69,0.35);">
            Rastrear Mi Pedido en Tiempo Real &rarr;
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#64748b;text-align:center;">
      ¿Tienes dudas con este servicio? Contáctanos de inmediato por <a href="https://wa.me/573157924906" style="color:#5FBF45;font-weight:700;">WhatsApp aquí</a>.
    </p>
  `;

  return baseLayout({
    title: `Pedido #${id} Confirmado · Domix TuraFood`,
    previewText: `Tu pedido #${id} está en camino. Tu código de entrega es ${codigo}.`,
    children: content,
  });
}

/**
 * EMAIL 2: Recibo y Comprobante de Servicio Finalizado
 */
export function templateServicioFinalizado(pedido) {
  const id = pedido.id || pedido.pedido_id || '---';
  const cliente = pedido.cliente_nombre || pedido.p_cliente_nombre || 'Cliente';
  const origen = pedido.origen_direccion || pedido.p_origen_direccion || 'Punto de recogida';
  const destino = pedido.destino_direccion || pedido.p_destino_direccion || 'Destino de entrega';
  const costo = Number(pedido.costo_envio || pedido.p_costo_envio || 8000).toLocaleString('es-CO');
  const repartidor = pedido.repartidor_nombre || 'Repartidor Domix';
  const metodoPago = (pedido.metodo_pago || pedido.p_metodo_pago || 'efectivo').toUpperCase();
  const fecha = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  const content = `
    <!-- STATUS BADGE -->
    <div style="margin-bottom:20px;">
      <span style="background:rgba(95,191,69,0.18);border:1px solid rgba(95,191,69,0.4);color:#8FD46E;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">
        ✔ Servicio Entregado con Éxito
      </span>
    </div>

    <!-- MAIN HEADING -->
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.3;">
      ¡Entrega completada! Gracias por elegir Domix, ${cliente}.
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Tu carrera #${id} ha sido finalizada y verificada exitosamente en destino a las ${fecha}. Aquí tienes tu comprobante digital de servicio.
    </p>

    <!-- RECIBO DIGITAL -->
    <div style="background:#16191c;border:1px solid #22282e;border-radius:12px;padding:22px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom:1px solid #242a30;padding-bottom:14px;margin-bottom:14px;">
        <tr>
          <td>
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Comprobante de Servicio</div>
            <div style="font-size:15px;color:#ffffff;font-weight:800;margin-top:2px;">Orden #${id}</div>
          </td>
          <td align="right">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Atendido por</div>
            <div style="font-size:13px;color:#8FD46E;font-weight:700;margin-top:2px;">🛵 ${repartidor}</div>
          </td>
        </tr>
      </table>

      <!-- DETALLE DE COBRO -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
        <tr>
          <td style="font-size:13px;color:#94a3b8;padding:6px 0;">Trayecto Recorrido:</td>
          <td align="right" style="font-size:13px;color:#ffffff;padding:6px 0;font-weight:600;">${origen} &rarr; ${destino}</td>
        </tr>
        <tr>
          <td style="font-size:13px;color:#94a3b8;padding:6px 0;">Método de Pago:</td>
          <td align="right" style="font-size:13px;color:#ffffff;padding:6px 0;font-weight:600;">${metodoPago}</td>
        </tr>
        <tr>
          <td style="font-size:14px;color:#ffffff;font-weight:800;padding:12px 0 4px;border-top:1px solid #242a30;">TOTAL PAGADO:</td>
          <td align="right" style="font-size:18px;color:#5FBF45;font-weight:900;padding:12px 0 4px;border-top:1px solid #242a30;">$${costo} COP</td>
        </tr>
      </table>
    </div>

    <!-- CALIFICACIÓN Y FEEDBACK -->
    <div style="background:#090a0b;border:1px solid #252b31;border-radius:12px;padding:20px;text-align:center;margin-bottom:26px;">
      <div style="font-size:13px;font-weight:700;color:#ffffff;margin-bottom:8px;">
        ¿Cómo estuvo tu experiencia de entrega hoy?
      </div>
      <div style="font-size:24px;margin-bottom:12px;letter-spacing:4px;">
        ⭐⭐⭐⭐⭐
      </div>
      <a href="https://turafood.com/calificar?id=${id}" style="color:#5FBF45;font-size:13px;font-weight:700;text-decoration:underline;">
        Dejar una reseña al repartidor &rarr;
      </a>
    </div>

    <!-- CTA PEDIR DE NUEVO -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">
      <tr>
        <td align="center">
          <a href="https://turafood.com" style="background-color:#1e2429;border:1px solid #333d45;color:#ffffff;font-size:14px;font-weight:700;padding:13px 28px;border-radius:10px;display:inline-block;text-align:center;">
            Solicitar Otro Domicilio en TuraFood
          </a>
        </td>
      </tr>
    </table>
  `;

  return baseLayout({
    title: `Comprobante de Servicio #${id} · Entregado`,
    previewText: `Tu pedido #${id} fue entregado exitosamente por ${repartidor}. Total: $${costo} COP.`,
    children: content,
  });
}

/**
 * EMAIL 3: Confirmación de Registro y Activación de Cuenta (Modelo turabarber.com)
 * Aplicable tanto a Clientes como a Conductores (Taxis y Placa Blanca)
 */
export function templateConfirmacionRegistro({ nombre, codigo, rol, urlConfirmacion }) {
  const nombreLimpio = nombre || 'Usuario';
  const rolTexto = rol === 'taxista' 
    ? 'Conductor de Taxi (Urbano)'
    : rol === 'placa_blanca'
    ? 'Conductor Intermunicipal (Placa Blanca Cali)'
    : rol === 'repartidor'
    ? 'Repartidor / Mensajero'
    : 'Cliente / Pasajero';

  const content = `
    <!-- STATUS BADGE -->
    <div style="margin-bottom:20px;">
      <span style="background:rgba(95,191,69,0.18);border:1px solid rgba(95,191,69,0.4);color:#8FD46E;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;">
        ● Verificación de Cuenta Requerida
      </span>
    </div>

    <!-- MAIN HEADING -->
    <h1 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.3;">
      ¡Bienvenido a Domix / TuraFood, ${nombreLimpio}!
    </h1>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.6;">
      Has iniciado tu proceso de registro como <strong style="color:#ffffff;">${rolTexto}</strong>. Para activar tu cuenta y comenzar a operar en la plataforma, verifica tu correo con el código a continuación.
    </p>

    <!-- VERIFICATION CODE BOX -->
    <div style="background:#090a0b;border:1px solid #252b31;border-radius:12px;padding:24px 20px;text-align:center;margin-bottom:26px;">
      <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">
        Código de Verificación (6 dígitos)
      </div>
      <div style="font-family:'Courier New', Courier, monospace;font-size:40px;font-weight:900;color:#5FBF45;letter-spacing:0.25em;margin-bottom:8px;">
        ${codigo}
      </div>
      <div style="font-size:12px;color:#94a3b8;line-height:1.4;">
        Este código es válido durante los próximos 30 minutos.
      </div>
    </div>

    <!-- CTA LINK -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td align="center">
          <a href="${urlConfirmacion}" style="background-color:#5FBF45;color:#0b0d0e;font-size:14px;font-weight:800;padding:14px 34px;border-radius:10px;display:inline-block;text-align:center;letter-spacing:-0.01em;box-shadow:0 4px 16px rgba(95,191,69,0.35);">
            Activar y Confirmar mi Cuenta &rarr;
          </a>
        </td>
      </tr>
    </table>

    <div style="background:#16191c;border:1px solid #22282e;border-radius:10px;padding:16px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
        Si no creaste una cuenta en Domix / TuraFood, puedes desestimar este mensaje con tranquilidad.
      </p>
    </div>
  `;

  return baseLayout({
    title: `Código de Activación: ${codigo} · Domix TuraFood`,
    previewText: `Tu código de confirmación es ${codigo}. Activa tu cuenta de ${rolTexto}.`,
    children: content,
  });
}

