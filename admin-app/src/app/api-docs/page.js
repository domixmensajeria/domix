'use client';

import { useState } from 'react';
import { Icon } from '../../components/ui';

const ENDPOINTS = [
  {
    id: 'rpc-crear-solicitud',
    method: 'POST',
    path: '/api/rpc/crear_solicitud',
    category: 'Despacho & Pedidos',
    title: 'Crear Pedido / Solicitud',
    description: 'Genera una orden en el sistema, calcula cobertura por sede y genera el código de confirmación de 4 dígitos.',
    defaultBody: JSON.stringify({
      p_cliente_telefono: '+573001234567',
      p_cliente_nombre: 'María Camila Valencia',
      p_origen_direccion: 'Cra 2 # 3-45 Centro, Buenaventura',
      p_destino_direccion: 'Calle 5 # 8-20 Bellavista, Buenaventura',
      p_origen_lat: 3.8821,
      p_origen_lng: -77.0312,
      p_destino_lat: 3.8895,
      p_destino_lng: -77.0254,
      p_descripcion: 'Almuerzo ejecutivo + jugo natural sellado',
      p_valor_declarado: 25000,
      p_costo_envio: 8000,
      p_metodo_pago: 'efectivo',
      p_canal: 'web'
    }, null, 2),
  },
  {
    id: 'rpc-saldo-repartidor',
    method: 'POST',
    path: '/api/rpc/saldo_repartidor',
    category: 'Finanzas 80/20',
    title: 'Consultar Saldo Repartidor',
    description: 'Calcula ingresos brutos, comisión 20% Domix, retención de efectivo cobrado en mano y saldo neto pendiente.',
    defaultBody: JSON.stringify({
      p_repartidor_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    }, null, 2),
  },
  {
    id: 'rpc-confirm-delivery',
    method: 'POST',
    path: '/api/rpc/confirm_delivery',
    category: 'Despacho & Pedidos',
    title: 'Confirmar Entrega de Pedido',
    description: 'Valida el código de seguridad de 4 dígitos de entrega. Cambia el estado a entregado y liquida la carrera.',
    defaultBody: JSON.stringify({
      p_pedido_id: 1,
      p_codigo_entrega: '8241',
      p_repartidor_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    }, null, 2),
  },
  {
    id: 'rpc-tomar-pedido',
    method: 'POST',
    path: '/api/rpc/tomar_pedido',
    category: 'Despacho & Pedidos',
    title: 'Tomar Carrera Atómica',
    description: 'Asigna el pedido de forma atómica al repartidor para evitar colisiones con otros domiciliarios.',
    defaultBody: JSON.stringify({
      p_pedido_id: 1,
      p_repartidor_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    }, null, 2),
  },
  {
    id: 'rpc-actualizar-ubicacion',
    method: 'POST',
    path: '/api/rpc/actualizar_ubicacion_repartidor',
    category: 'Telemetría GPS',
    title: 'Actualizar GPS Repartidor',
    description: 'Reporta la telemetría espacial del repartidor a PostGIS para seguimiento en el mapa del panel.',
    defaultBody: JSON.stringify({
      p_repartidor_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      p_lat: 3.8845,
      p_lng: -77.0298
    }, null, 2),
  },
  {
    id: 'rpc-admin-asignar-clave',
    method: 'POST',
    path: '/api/rpc/admin_asignar_clave',
    category: 'Seguridad Flota',
    title: 'Asignar Clave Bcrypt a Repartidor',
    description: 'Guarda el hash bcrypt de la contraseña del repartidor para acceso seguro a la app móvil.',
    defaultBody: JSON.stringify({
      p_repartidor_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      p_hash: '$2b$10$abcdef1234567890abcdef1234567890abcdef1234567890'
    }, null, 2),
  },
  {
    id: 'data-pedidos',
    method: 'GET',
    path: '/api/data/pedidos?limit=10',
    category: 'Consultas REST',
    title: 'Listar Pedidos Recientes',
    description: 'Consulta los pedidos ordenados cronológicamente desde la base de datos Supabase.',
    defaultBody: '',
  },
  {
    id: 'data-repartidores',
    method: 'GET',
    path: '/api/data/repartidores',
    category: 'Consultas REST',
    title: 'Listar Flota de Repartidores',
    description: 'Obtiene todos los repartidores registrados y su estado de actividad.',
    defaultBody: '',
  },
  {
    id: 'data-branches',
    method: 'GET',
    path: '/api/data/branches',
    category: 'Consultas REST',
    title: 'Sedes y Reglas de Tarificación',
    description: 'Consulta las sedes operativas y las reglas dinámicas de precios (nocturno, lluvia, etc.).',
    defaultBody: '',
  },
  {
    id: 'api-leer-chat',
    method: 'POST',
    path: '/api/leer-chat',
    category: 'Inteligencia Artificial',
    title: 'Analizar Conversación IA (Claude)',
    description: 'Extrae automáticamente origen, destino, producto y tarifa desde un chat de WhatsApp.',
    defaultBody: JSON.stringify({
      messages: [
        { sender: 'cliente', texto: 'Hola buenas tardes, necesito un domicilio de la Galería Central a Bellavista', hora: '12:04' },
        { sender: 'domix', texto: '¡Hola! Claro que sí, ¿qué producto transportas?', hora: '12:05' },
        { sender: 'cliente', texto: 'Es un almuerzo en bolsa sellada. Pago en efectivo $8.000.', hora: '12:05' }
      ],
      cliente: {
        nombre: 'Carlos Murillo',
        telefono: '+573128901234'
      }
    }, null, 2),
  },
  {
    id: 'email-pedido-creado',
    method: 'POST',
    path: '/api/notificaciones/email',
    category: 'Emails Resend PRO',
    title: 'Email: Pedido Registrado & PIN',
    description: 'Dispara el Email 1 adaptable con código de entrega PIN de 4 dígitos, detalle de itinerario y botón de rastreo.',
    defaultBody: JSON.stringify({
      tipo: 'pedido_creado',
      destinatario: 'domixmensajeriasas@gmail.com',
      pedido: {
        id: 104,
        cliente_nombre: 'María Camila Valencia',
        origen_direccion: 'Cra 2 # 3-45 Centro, Buenaventura',
        destino_direccion: 'Calle 5 # 8-20 Bellavista, Buenaventura',
        codigo_entrega: '8241',
        costo_envio: 8000,
        metodo_pago: 'efectivo',
        descripcion: 'Almuerzo ejecutivo + bebida sellada'
      }
    }, null, 2),
  },
  {
    id: 'email-servicio-finalizado',
    method: 'POST',
    path: '/api/notificaciones/email',
    category: 'Emails Resend PRO',
    title: 'Email: Recibo Servicio Finalizado',
    description: 'Dispara el Email 2 con comprobante digital, total pagado, datos del repartidor y solicitud de calificación.',
    defaultBody: JSON.stringify({
      tipo: 'pedido_entregado',
      destinatario: 'domixmensajeriasas@gmail.com',
      pedido: {
        id: 104,
        cliente_nombre: 'María Camila Valencia',
        origen_direccion: 'Cra 2 # 3-45 Centro, Buenaventura',
        destino_direccion: 'Calle 5 # 8-20 Bellavista, Buenaventura',
        costo_envio: 8000,
        metodo_pago: 'efectivo',
        repartidor_nombre: 'Yeison Mosquera'
      }
    }, null, 2),
  },
];

export default function ApiDocsPage() {
  const [selectedId, setSelectedId] = useState(ENDPOINTS[0].id);
  const [requestBody, setRequestBody] = useState(ENDPOINTS[0].defaultBody);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [status, setStatus] = useState(null);
  const [latency, setLatency] = useState(null);

  const selected = ENDPOINTS.find((e) => e.id === selectedId) || ENDPOINTS[0];

  const handleSelect = (ep) => {
    setSelectedId(ep.id);
    setRequestBody(ep.defaultBody);
    setResponse(null);
    setStatus(null);
    setLatency(null);
  };

  const handleExecute = async () => {
    setLoading(true);
    setResponse(null);
    setStatus(null);
    const start = Date.now();

    try {
      const opts = {
        method: selected.method,
        headers: {
          'Content-Type': 'application/json',
          'x-domix-token': typeof window !== 'undefined' ? localStorage.getItem('domix_token') || 'token_admin_demo' : '',
        },
      };

      if (selected.method === 'POST' && requestBody) {
        opts.body = requestBody;
      }

      const res = await fetch(selected.path, opts);
      const elapsed = Date.now() - start;
      setStatus(res.status);
      setLatency(elapsed);

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        setResponse(JSON.stringify(json, null, 2));
      } else {
        const text = await res.text();
        setResponse(text);
      }
    } catch (err) {
      setResponse(`Error al conectar con el servidor: ${err.message}`);
      setStatus(500);
      setLatency(Date.now() - start);
    } finally {
      setLoading(false);
    }
  };

  const curlCommand = selected.method === 'GET'
    ? `curl -X GET "${typeof window !== 'undefined' ? window.location.origin : ''}${selected.path}" \\\n  -H "x-domix-token: $TOKEN"`
    : `curl -X POST "${typeof window !== 'undefined' ? window.location.origin : ''}${selected.path}" \\\n  -H "Content-Type: application/json" \\\n  -H "x-domix-token: $TOKEN" \\\n  -d '${requestBody.replace(/\n/g, '').replace(/\s+/g, ' ')}'`;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, borderBottom: '1px solid #202428', paddingBottom: 18 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
              Servidor de APIs & Swagger
            </h1>
            <span style={{ background: 'rgba(95,191,69,0.15)', color: '#8FD46E', padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em' }}>
              TURAFOOD API v1.0
            </span>
          </div>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
            Consola interactiva y documentación OpenAPI para pruebas en caliente de endpoints y RPCs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href="/swagger"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#5FBF45',
              color: '#0b0d0e',
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(95,191,69,0.3)',
            }}
          >
            <Icon name="open_in_new" size={17} />
            Abrir Swagger UI Oficial
          </a>
          <a
            href="/api/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#1a1e22',
              border: '1px solid #2d343b',
              color: '#cbd5e1',
              padding: '9px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <Icon name="code" size={17} />
            Ver openapi.json
          </a>
        </div>
      </div>

      {/* Grid Layout: Menú de Endpoints + Consola de Pruebas */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Sidebar de Endpoints */}
        <div style={{ background: '#121517', border: '1px solid #1f2429', borderRadius: 12, padding: 12, maxHeight: '82vh', overflowY: 'auto' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 8px 10px' }}>
            Endpoints Disponibles
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {ENDPOINTS.map((ep) => {
              const active = ep.id === selectedId;
              const isPost = ep.method === 'POST';
              return (
                <button
                  key={ep.id}
                  onClick={() => handleSelect(ep)}
                  style={{
                    background: active ? '#1a2024' : 'transparent',
                    border: active ? '1px solid #5FBF45' : '1px solid transparent',
                    borderRadius: 8,
                    padding: '10px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        fontFamily: "'IBM Plex Mono', monospace",
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: isPost ? 'rgba(56,189,248,0.15)' : 'rgba(95,191,69,0.15)',
                        color: isPost ? '#38bdf8' : '#8FD46E',
                      }}
                    >
                      {ep.method}
                    </span>
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{ep.category}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#fff' : '#cbd5e1' }}>
                    {ep.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', fontFamily: "'IBM Plex Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ep.path}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel Central: Consola Interactiva */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card Detalle de Endpoint */}
          <div style={{ background: '#121517', border: '1px solid #1f2429', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    fontFamily: "'IBM Plex Mono', monospace",
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: selected.method === 'POST' ? 'rgba(56,189,248,0.2)' : 'rgba(95,191,69,0.2)',
                    color: selected.method === 'POST' ? '#38bdf8' : '#8FD46E',
                  }}
                >
                  {selected.method}
                </span>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: "'IBM Plex Mono', monospace" }}>
                  {selected.path}
                </span>
              </div>
              <button
                onClick={handleExecute}
                disabled={loading}
                style={{
                  background: loading ? '#2c333a' : '#5FBF45',
                  color: loading ? '#94a3b8' : '#0b0d0e',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 10px rgba(95,191,69,0.25)',
                }}
              >
                <Icon name={loading ? 'hourglass_top' : 'play_arrow'} size={18} />
                {loading ? 'Ejecutando...' : 'Ejecutar / Probar'}
              </button>
            </div>

            <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
              {selected.description}
            </p>

            {/* Editor de Payload (si es POST) */}
            {selected.method === 'POST' && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Cuerpo de la Solicitud (JSON Body)
                  </label>
                  <button
                    onClick={() => setRequestBody(selected.defaultBody)}
                    style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                  >
                    Restablecer valores de prueba
                  </button>
                </div>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={10}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#090a0b',
                    border: '1px solid #22282e',
                    borderRadius: 8,
                    padding: 12,
                    color: '#86efac',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    resize: 'vertical',
                  }}
                />
              </div>
            )}
          </div>

          {/* Respuesta en Vivo */}
          <div style={{ background: '#121517', border: '1px solid #1f2429', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Respuesta del Servidor
              </div>
              {status !== null && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: status >= 200 && status < 300 ? 'rgba(95,191,69,0.2)' : 'rgba(239,68,68,0.2)',
                      color: status >= 200 && status < 300 ? '#8FD46E' : '#f87171',
                    }}
                  >
                    STATUS: {status}
                  </span>
                  {latency !== null && (
                    <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: "'IBM Plex Mono', monospace" }}>
                      {latency} ms
                    </span>
                  )}
                </div>
              )}
            </div>

            <pre
              style={{
                margin: 0,
                background: '#090a0b',
                border: '1px solid #22282e',
                borderRadius: 8,
                padding: 14,
                color: response ? '#cbd5e1' : '#64748b',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                lineHeight: 1.5,
                maxHeight: 380,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {response || (loading ? 'Esperando respuesta del servidor...' : 'Presiona "Ejecutar / Probar" para recibir la respuesta en tiempo real.')}
            </pre>
          </div>

          {/* Comando cURL Equivalente */}
          <div style={{ background: '#121517', border: '1px solid #1f2429', borderRadius: 12, padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Comando cURL Equivalente para Terminal
            </div>
            <pre
              style={{
                margin: 0,
                background: '#090a0b',
                border: '1px solid #22282e',
                borderRadius: 8,
                padding: 12,
                color: '#38bdf8',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11.5,
                lineHeight: 1.5,
                overflowX: 'auto',
              }}
            >
              {curlCommand}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
