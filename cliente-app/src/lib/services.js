import { supabase } from './supabaseClient';
import { pointAlong } from './geo';

/* Los cinco servicios de Domix, con los textos de la papelería de marca. */
export const SERVICES = [
  { value: 'mensajeria', label: 'Mensajería', desc: 'Envíos de documentos, cartas y correspondencia', icon: 'mail', img: '/assets/svc-moto.webp', from: 6000 },
  { value: 'autorizacion_medica', label: 'Autorizaciones médicas', desc: 'Trámites rápidos y seguros en EPS y clínicas', icon: 'medical_information', img: '/assets/svc-hora.webp', from: 8000 },
  { value: 'encomienda', label: 'Encomiendas', desc: 'Envío de paquetes y mercancías a nivel local', icon: 'inventory_2', img: '/assets/svc-envio.webp', from: 8000 },
  { value: 'domicilio', label: 'Domicilios', desc: 'Restaurantes, tiendas virtuales, maquillaje y más', icon: 'moped', img: '/assets/svc-carro.webp', from: 6000 },
  { value: 'mandado', label: 'Mandados', desc: 'Compras, pagos, recados y diligencias varias', icon: 'shopping_bag', img: '/assets/svc-reserva.webp', from: 7000 },
];

/* Promesa para negocios: "Nosotros somos tu domiciliario". */
export const NEGOCIO_PASOS = [
  { icon: 'shopping_cart', label: 'Tú vendes', tone: 'amber' },
  { icon: 'inventory_2', label: 'Nosotros recogemos', tone: 'navy' },
  { icon: 'moped', label: 'Nosotros entregamos', tone: 'green' },
  { icon: 'payments', label: 'Tú cobras', tone: 'purple' },
];

export function serviceInfo(value) {
  return SERVICES.find((s) => s.value === value) || SERVICES[0];
}

export const STATUS_STEPS = [
  { id: 'requested', label: 'Recibido', desc: 'Buscando repartidor disponible', icon: 'receipt_long' },
  { id: 'assigned', label: 'Asignado', desc: 'Un repartidor va por tu pedido', icon: 'person_pin_circle' },
  { id: 'picked_up', label: 'Recogido', desc: 'Ya tiene tu envío en la mano', icon: 'inventory' },
  { id: 'in_progress', label: 'En camino', desc: 'Va rumbo a la entrega', icon: 'moped' },
  { id: 'delivered', label: 'Entregado', desc: 'Servicio completado', icon: 'task_alt' },
];

export async function createRequest(payload) {
  return supabase.rpc('crear_solicitud', { p: payload });
}

export async function trackRequest(code) {
  const { data, error } = await supabase.rpc('track_service_request', { p_tracking_code: code });
  if (error) throw error;
  return data?.[0] || null;
}

export async function fetchMyRequests(phone) {
  if (!phone) return [];
  const { data, error } = await supabase.rpc('mis_pedidos', { p_phone: phone });
  if (error) throw error;
  return data || [];
}

/* ---------------- Modo DEMO ----------------
   El pedido vive en el propio dispositivo y avanza solo, para poder
   ver el seguimiento completo sin depender de un repartidor real. */

const DEMO_PREFIX = 'domix_demo_';
const STEP_SECONDS = 22;

export function loadDemoRequest(code) {
  try {
    const raw = localStorage.getItem(DEMO_PREFIX + code);
    if (!raw) return null;
    const req = JSON.parse(raw);
    return advanceDemo(req);
  } catch {
    return null;
  }
}

export function listDemoRequests(phone) {
  const rows = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(DEMO_PREFIX)) continue;
      const req = JSON.parse(localStorage.getItem(k));
      if (!phone || req.contact_phone === phone) rows.push(advanceDemo(req));
    }
  } catch { /* ignorar */ }
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/* El pedido demo pasa de estado según el tiempo transcurrido. */
function advanceDemo(req) {
  const elapsed = (Date.now() - new Date(req.created_at).getTime()) / 1000;
  const order = ['requested', 'assigned', 'picked_up', 'in_progress', 'delivered'];
  const idx = Math.min(order.length - 1, Math.floor(elapsed / STEP_SECONDS));
  const status = order[idx];

  const progress = Math.min(1, Math.max(0, (elapsed - STEP_SECONDS * 2) / (STEP_SECONDS * 2)));
  const courier = req.route?.length
    ? pointAlong(req.route, progress)
    : idx >= 2 && req.pickup_point && req.dropoff_point
      ? {
          lat: req.pickup_point.lat + (req.dropoff_point.lat - req.pickup_point.lat) * progress,
          lon: req.pickup_point.lon + (req.dropoff_point.lon - req.pickup_point.lon) * progress,
        }
      : req.pickup_point || null;

  return {
    ...req,
    status,
    courier_name: idx >= 1 ? 'Yeison' : null,
    courier_lat: idx >= 1 ? courier?.lat ?? null : null,
    courier_lon: idx >= 1 ? courier?.lon ?? null : null,
    delivered_at: status === 'delivered' ? new Date().toISOString() : null,
  };
}
